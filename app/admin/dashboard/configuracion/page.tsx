'use client'

import { useState, useEffect } from 'react'
import { Save, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface VehiculoConfig {
  id: string
  nombre: string
  capacidadMinima: number
  capacidadMaxima: number
  activo: boolean
}

export default function ConfiguracionPage() {
  const [vehiculos, setVehiculos] = useState<VehiculoConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVehiculos = async () => {
      try {
        const res = await fetch('/api/vehiculos')
        const data = await res.json()
        setVehiculos(data.data || [])
      } catch (error) {
        console.error('Error fetching vehiculos:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchVehiculos()
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[900px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Parámetros globales del sistema</p>
      </div>

      {/* Vehiculos + capacidades */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Vehículos y rangos de capacidad</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Gestiona los vehículos desde la sección{' '}
              <a
                href="/admin/dashboard/vehiculos"
                className="text-neutral-700 underline underline-offset-2"
              >
                Vehículos
              </a>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {vehiculos.map((v, idx) => (
              <div
                key={v.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < vehiculos.length - 1 ? 'border-b border-neutral-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-neutral-800">{v.nombre}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium h-5 ${v.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
                  >
                    {v.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <span className="text-xs text-neutral-500">
                  {v.capacidadMinima}–{v.capacidadMaxima} pasajeros
                </span>
              </div>
            ))}
            {vehiculos.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-neutral-400">
                No hay vehículos registrados
              </div>
            )}
          </div>
        )}
      </section>

      {/* Servicios incluidos — preparado para FASE 2 */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Servicios incluidos por defecto</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Configuración disponible en FASE 2</p>
        </div>
        <div className="border border-neutral-200 rounded-lg bg-white px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
            <Info size={14} />
            Esta sección estará disponible en la próxima fase de implementación
          </div>
        </div>
      </section>

      {/* Variables del sistema */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Variables del sistema</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Parámetros globales de la plataforma</p>
        </div>
        <div className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-100">
          {[
            { label: 'WhatsApp de contacto', value: '+57 313 XXX XXXX', editable: false },
            { label: 'Email de notificaciones', value: 'reservas@transportesmedellin.com', editable: false },
            { label: 'Moneda', value: 'COP (Peso colombiano)', editable: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <Label className="text-sm text-neutral-700">{item.label}</Label>
              <span className="text-sm text-neutral-500">{item.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
