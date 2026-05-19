'use client'

import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getStateLabel, getStateBadge } from '@/lib/state-transitions'
import { getLocalizedText } from '@/types/multi-language'
import type { EstadoReserva } from '@prisma/client'


export interface ReservaDetail {
  id: string
  codigo: string
  nombreCliente: string
  emailCliente: string
  whatsappCliente?: string
  fecha: string
  hora: string
  estado: string
  metodoPago: string
  precioTotal: number
  esCotizacion?: boolean
  servicioId?: string
  servicio?: { nombre: string }
  aliado?: { nombre: string; codigo: string }
  esReservaAliado?: boolean
  clientePaga?: boolean
  comisionAliado?: number
  conductor?: { nombre: string }
  vehiculo?: { nombre: string }
  numeroPasajeros?: number
  notas?: string
  datos?: Record<string, any>
}

interface ReservaDetailSheetProps {
  reservaId: string | null
  reservas: ReservaDetail[]
  onClose: () => void
}

const fmtDate = (iso: string) => {
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function ReservaDetailSheet({
  reservaId,
  reservas,
  onClose,
}: ReservaDetailSheetProps) {
  const router = useRouter()
  const reserva = reservas.find((r) => r.id === reservaId) ?? null

  return (
    <Sheet open={!!reservaId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto p-0">
        {reserva && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
              <SheetHeader className="space-y-0">
                <SheetTitle className="font-mono text-lg font-bold text-amber-600 tracking-wide">
                  {reserva.codigo}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Detalle de la reserva {reserva.codigo}
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center gap-2 flex-wrap mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getStateBadge(reserva.estado)}`}
                >
                  {getStateLabel(reserva.estado as EstadoReserva)}
                </span>
                {reserva.esCotizacion && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md font-medium">
                    Cotización
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-8 text-xs gap-1.5 border-neutral-200"
                  onClick={() => {
                    onClose()
                    router.push(`/admin/dashboard/reservas/${reserva.id}`)
                  }}
                >
                  Abrir completo
                  <ExternalLink size={12} />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Cliente */}
              <Section title="Cliente">
                <Field label="Nombre" value={reserva.nombreCliente} />
                <Field label="Email" value={reserva.emailCliente} />
                {reserva.whatsappCliente && (
                  <Field label="WhatsApp" value={reserva.whatsappCliente} />
                )}
              </Section>

              <Separator />

              {/* Servicio */}
              <Section title="Servicio">
                <Field
                  label="Tipo"
                  value={
                    reserva.servicio?.nombre
                      ? getLocalizedText(reserva.servicio.nombre, 'ES')
                      : '—'
                  }
                />
                <Field label="Fecha" value={fmtDate(reserva.fecha)} />
                <Field label="Hora" value={reserva.hora} />
                {reserva.numeroPasajeros !== undefined && (
                  <Field label="Pasajeros" value={String(reserva.numeroPasajeros)} />
                )}
                {reserva.datos?.lugarRecogida && (
                  <Field label="Recogida" value={reserva.datos.lugarRecogida} />
                )}
              </Section>

              <Separator />

              {/* Asignación */}
              <Section title="Asignación">
                <Field
                  label="Conductor"
                  value={reserva.conductor?.nombre ?? 'Sin asignar'}
                />
                <Field
                  label="Vehículo"
                  value={reserva.vehiculo?.nombre ?? 'Sin asignar'}
                />
              </Section>

              <Separator />

              {/* Pago */}
              <Section title="Pago">
                <Field
                  label="Total"
                  value={`$${Number(reserva.precioTotal).toLocaleString('es-CO')}`}
                />
                <Field
                  label="Método"
                  value={reserva.metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}
                />
                {reserva.esReservaAliado && reserva.aliado && (
                  <Field
                    label="Aliado"
                    value={`${reserva.aliado.nombre} (${reserva.aliado.codigo})`}
                  />
                )}
                {(reserva.esReservaAliado || reserva.esCotizacion) && (
                  <Field
                    label="Cliente paga"
                    value={reserva.clientePaga !== false ? 'Sí' : 'No'}
                  />
                )}
              </Section>

              {reserva.notas && (
                <>
                  <Separator />
                  <Section title="Notas">
                    <p className="text-sm text-neutral-700 leading-relaxed">{reserva.notas}</p>
                  </Section>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-neutral-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-neutral-900 text-right">{value}</span>
    </div>
  )
}
