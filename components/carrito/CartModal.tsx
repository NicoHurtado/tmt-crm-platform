'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, ShoppingCart, Calendar, Users, MapPin, ArrowRight, Banknote, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CartItem {
  id: string
  servicioId: string
  servicioNombre: string
  fecha: string
  hora: string
  numeroPasajeros: number
  precioTotal: number
  municipio?: string
  otroMunicipio?: string
  lugarRecogida?: string
  trasladoDestino?: string
  trasladoTipo?: string
  aeropuertoTipo?: string
  aeropuertoNombre?: string
  metodoPago?: string
  [key: string]: any
}

interface CartModalProps {
  isOpen: boolean
  onClose: () => void
}

const fmt = (n: number) => `$${n.toLocaleString('es-CO')} COP`

export const CartModal = ({ isOpen, onClose }: CartModalProps) => {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'TARJETA' | 'EFECTIVO'>('EFECTIVO')

  useEffect(() => {
    if (isOpen) loadCart()
  }, [isOpen])

  const loadCart = () => {
    try {
      const stored = localStorage.getItem('medellin-travel-cart')
      if (stored) {
        const items: CartItem[] = JSON.parse(stored)
        setCartItems(Array.isArray(items) ? items : [])
        const firstMethod = items[0]?.metodoPago
        if (firstMethod === 'EFECTIVO' || firstMethod === 'TARJETA') {
          setSelectedPaymentMethod(firstMethod)
        }
      } else {
        setCartItems([])
        setSelectedPaymentMethod('EFECTIVO')
      }
    } catch {
      setCartItems([])
    }
  }

  const removeItem = (id: string) => {
    const updated = cartItems.filter((i) => i.id !== id)
    setCartItems(updated)
    localStorage.setItem('medellin-travel-cart', JSON.stringify(updated))
    window.dispatchEvent(new Event('cartUpdated'))
  }

  const clearCart = () => {
    if (!confirm('Vaciar el carrito? Esta accion no se puede deshacer.')) return
    setCartItems([])
    localStorage.removeItem('medellin-travel-cart')
    window.dispatchEvent(new Event('cartUpdated'))
  }

  const subtotal = cartItems.reduce((s, i) => s + i.precioTotal, 0)
  const commission = selectedPaymentMethod === 'TARJETA' ? Math.round(subtotal * 0.06) : 0
  const total = subtotal + commission

  const boldPreviewFee = Math.round(subtotal * 0.06)
  const boldPreviewTotal = subtotal + boldPreviewFee

  const getRoute = (item: CartItem) => {
    if (item.aeropuertoTipo) {
      const airport = 'Aeropuerto ' + (item.aeropuertoNombre?.replace(/_/g, ' ') || '')
      const place = item.lugarRecogida || 'Medellín'
      return item.aeropuertoTipo === 'DESDE' || item.aeropuertoTipo === 'LLEGADA'
        ? { from: airport, to: place }
        : { from: place, to: airport }
    }
    if (item.trasladoTipo) {
      const muni = item.municipio === 'OTRO' ? item.otroMunicipio || 'Municipio' : item.municipio
      if (item.trasladoTipo === 'DESDE_UBICACION')
        return { from: item.lugarRecogida || 'Mi ubicacion', to: item.trasladoDestino || muni }
      if (item.trasladoTipo === 'DESDE_MUNICIPIO')
        return { from: item.lugarRecogida || muni, to: item.trasladoDestino || 'Mi ubicacion' }
    }
    const dest = item.trasladoDestino || (item.municipio !== 'OTRO' ? item.municipio : item.otroMunicipio)
    if (item.lugarRecogida || dest) return { from: item.lugarRecogida, to: dest }
    return null
  }

  const proceedToCheckout = async () => {
    if (!cartItems.length) return
    setIsProcessing(true)
    try {
      const res = await fetch('/api/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems,
          idioma: cartItems[0]?.idioma || 'ES',
          metodoPago: selectedPaymentMethod,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Error al crear el pedido')
      }
      const { data: pedido } = await res.json()
      localStorage.removeItem('medellin-travel-cart')
      window.dispatchEvent(new Event('cartUpdated'))
      router.refresh()
      router.push(`/tracking/${pedido.codigo}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al procesar el pedido')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={18} className="text-neutral-700" />
            <h2 className="text-base font-semibold text-neutral-900">Carrito</h2>
            {cartItems.length > 0 && (
              <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">
                {cartItems.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400">
              <ShoppingCart size={40} strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-600">Tu carrito esta vacio</p>
                <p className="text-xs mt-1">Agrega servicios para comenzar</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {cartItems.map((item) => {
                const route = getRoute(item)
                const dateStr = item.fecha
                  ? new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : ''

                return (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-neutral-900 leading-snug flex-1">
                        {item.servicioNombre}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {dateStr && (
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Calendar size={12} className="shrink-0 text-neutral-400" />
                          <span>{dateStr} · {item.hora}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Users size={12} className="shrink-0 text-neutral-400" />
                        <span>
                          {item.numeroPasajeros} pasajero{item.numeroPasajeros !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {route && (route.from || route.to) && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                          <MapPin size={12} className="shrink-0 text-neutral-400" />
                          {route.from && <span className="truncate max-w-[130px]">{route.from}</span>}
                          {route.from && route.to && (
                            <ArrowRight size={11} className="shrink-0 text-neutral-300" />
                          )}
                          {route.to && <span className="truncate max-w-[130px]">{route.to}</span>}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <span className="text-sm font-semibold text-amber-600">
                        {fmt(item.precioTotal)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4 space-y-4">
            {/* Payment method */}
            <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
              <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
                <p className="text-xs font-semibold text-neutral-600">Metodo de pago</p>
              </div>

              {/* Efectivo */}
              <button
                onClick={() => setSelectedPaymentMethod('EFECTIVO')}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-100 transition-colors text-left ${
                  selectedPaymentMethod === 'EFECTIVO' ? 'bg-green-50' : 'hover:bg-neutral-50'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedPaymentMethod === 'EFECTIVO' ? 'border-green-500' : 'border-neutral-300'
                }`}>
                  {selectedPaymentMethod === 'EFECTIVO' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  selectedPaymentMethod === 'EFECTIVO' ? 'bg-green-100' : 'bg-neutral-100'
                }`}>
                  <Banknote size={14} className={selectedPaymentMethod === 'EFECTIVO' ? 'text-green-600' : 'text-neutral-400'} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-neutral-900">Pago en efectivo</p>
                  <p className="text-[11px] text-neutral-500">Pagas al conductor el dia del servicio</p>
                </div>
                <span className="text-xs font-bold text-neutral-800 shrink-0">{fmt(subtotal)}</span>
              </button>

              {/* Tarjeta */}
              <button
                onClick={() => setSelectedPaymentMethod('TARJETA')}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  selectedPaymentMethod === 'TARJETA' ? 'bg-amber-50' : 'hover:bg-neutral-50'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedPaymentMethod === 'TARJETA' ? 'border-amber-500' : 'border-neutral-300'
                }`}>
                  {selectedPaymentMethod === 'TARJETA' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                  selectedPaymentMethod === 'TARJETA' ? 'bg-amber-100' : 'bg-neutral-100'
                }`}>
                  <CreditCard size={14} className={selectedPaymentMethod === 'TARJETA' ? 'text-amber-600' : 'text-neutral-400'} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-neutral-900">Pagar con tarjeta</p>
                  <p className="text-[11px] text-neutral-500">
                    +6% comision · {fmt(boldPreviewFee)} adicional
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-neutral-800">{fmt(boldPreviewTotal)}</p>
                </div>
              </button>
            </div>

            {/* Price summary */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {commission > 0 && (
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Comision tarjeta (6%)</span>
                  <span>{fmt(commission)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1.5 border-t border-neutral-200">
                <span>Total</span>
                <span className="text-amber-600">{fmt(total)}</span>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={proceedToCheckout}
              disabled={isProcessing}
              className="w-full bg-[#D6A75D] hover:bg-[#C5964A] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm tracking-wide"
            >
              {isProcessing
                ? 'Procesando...'
                : selectedPaymentMethod === 'EFECTIVO'
                ? 'Confirmar pedido en efectivo'
                : 'Proceder al pago con tarjeta'}
            </button>

            <div className="text-center">
              <button
                onClick={clearCart}
                disabled={isProcessing}
                className="text-xs text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                Vaciar carrito
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
