'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Trash2, Loader2, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getLocalizedText } from '@/types/multi-language'
import { getStateLabel, getStateBadge } from '@/lib/state-transitions'
import type { EstadoReserva } from '@prisma/client'
import { exportarAsistentesTourCompartido } from '@/lib/exportUtils'
import ReservaDetailSheet, { type ReservaDetail } from '@/components/admin/ReservaDetailSheet'

interface Reserva {
  id: string
  codigo: string
  nombreCliente: string
  emailCliente: string
  whatsappCliente?: string
  fecha: string
  hora: string
  numeroPasajeros: number
  estado: EstadoReserva
  precioTotal: number
  metodoPago?: string
  createdAt: string
  servicio?: { nombre: any; tipo?: string }
  asistentes?: Array<{
    id: string
    nombre: string
    tipoDocumento: string
    numeroDocumento: string
  }>
  [key: string]: any
}

interface TourCompartidoViewProps {
  reservas: Reserva[]
  onReservationDeleted?: (id: string) => void
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function TourCompartidoView({ reservas, onReservationDeleted }: TourCompartidoViewProps) {
  const todayISO = new Date().toISOString().split('T')[0]
  const todayDate = new Date()

  const [calYear, setCalYear] = useState(todayDate.getFullYear())
  const [calMonth, setCalMonth] = useState(todayDate.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('TODOS')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const datesWithReservas = useMemo(() => {
    const set = new Set<string>()
    reservas.forEach((r) => set.add(r.fecha.split('T')[0]))
    return set
  }, [reservas])

  const estadosDisponibles = useMemo(
    () => Array.from(new Set(reservas.map((r) => r.estado))),
    [reservas]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reservas.filter((r) => {
      if (estadoFilter !== 'TODOS' && r.estado !== estadoFilter) return false
      if (selectedDate && r.fecha.split('T')[0] !== selectedDate) return false
      if (q) {
        return (
          r.codigo.toLowerCase().includes(q) ||
          r.nombreCliente.toLowerCase().includes(q) ||
          r.emailCliente.toLowerCase().includes(q) ||
          (r.whatsappCliente || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [reservas, estadoFilter, selectedDate, search])

  const grupos = useMemo(() => {
    const map = new Map<string, {
      fecha: string
      reservas: Reserva[]
      cupoTotal: number
      servicioNombre: string
    }>()
    filtered.forEach((r) => {
      const key = r.fecha.split('T')[0]
      if (!map.has(key)) {
        map.set(key, {
          fecha: key,
          reservas: [],
          cupoTotal: 0,
          servicioNombre: r.servicio?.nombre
            ? getLocalizedText(r.servicio.nombre, 'ES')
            : 'Tour Compartido',
        })
      }
      const g = map.get(key)!
      g.reservas.push(r)
      g.cupoTotal += r.numeroPasajeros
    })
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [filtered])

  // Calendar grid cells
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstDay + 1
    if (day < 1 || day > daysInMonth) return null
    const mm = String(calMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return { day, iso: `${calYear}-${mm}-${dd}` }
  })

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) }
    else setCalMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) }
    else setCalMonth((m) => m + 1)
  }

  const handleDelete = async (id: string, codigo: string) => {
    if (!window.confirm(`Eliminar la reserva ${codigo}? Esta accion borra del sistema y actualiza Google Calendar.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reservas/by-id/${id}/delete`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Error al eliminar')
      onReservationDeleted?.(id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error eliminando la reserva')
    } finally {
      setDeletingId(null)
    }
  }

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const reservasForSheet = useMemo(
    () =>
      reservas.map((r) => ({
        ...r,
        metodoPago: r.metodoPago || 'EFECTIVO',
        estado: r.estado as string,
      })) as unknown as ReservaDetail[],
    [reservas]
  )

  if (reservas.length === 0) {
    return (
      <div className="border border-neutral-200 rounded-lg bg-white p-12 text-center">
        <p className="text-sm text-neutral-400">No hay reservas de Tour Compartido</p>
      </div>
    )
  }

  const hasFilters = !!(search || estadoFilter !== 'TODOS')

  return (
    <div className="grid grid-cols-[272px_1fr] gap-4 items-start">
      {/* Left panel */}
      <div className="space-y-3">
        {/* Mini Calendar */}
        <div className="border border-neutral-200 rounded-lg bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="area-tactil-completa p-1 rounded hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft size={13} className="text-neutral-500" />
            </button>
            <span className="text-xs font-semibold text-neutral-700">
              {MESES[calMonth]} {calYear}
            </span>
            <button
              onClick={nextMonth}
              className="area-tactil-completa p-1 rounded hover:bg-neutral-100 transition-colors"
            >
              <ChevronRight size={13} className="text-neutral-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-neutral-400 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />
              const hasRes = datesWithReservas.has(cell.iso)
              const isSelected = selectedDate === cell.iso
              const isToday = cell.iso === todayISO
              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedDate(isSelected ? null : cell.iso)}
                  disabled={!hasRes}
                  className={[
                    'relative flex flex-col items-center justify-center h-8 w-full rounded text-xs transition-colors',
                    isSelected
                      ? 'bg-amber-500 text-white font-semibold'
                      : hasRes
                      ? 'hover:bg-amber-50 text-neutral-800 cursor-pointer'
                      : 'text-neutral-300 cursor-default',
                    isToday && !isSelected ? 'font-semibold text-amber-600' : '',
                  ].join(' ')}
                >
                  {cell.day}
                  {hasRes && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400" />
                  )}
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="mt-3 w-full text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Ver todos los dias
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="border border-neutral-200 rounded-lg bg-white p-4 space-y-2.5">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
            Filtros
          </p>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
              size={13}
            />
            <Input
              placeholder="Codigo, cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs border-neutral-200 bg-white"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="h-8 text-xs border-neutral-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS" className="text-xs">
                Todos los estados
              </SelectItem>
              {estadosDisponibles.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {getStateLabel(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setEstadoFilter('TODOS') }}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="border border-neutral-200 rounded-lg bg-white p-4">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">
            Resumen
          </p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-neutral-500">Fechas con tours</span>
              <span className="text-xs font-medium text-neutral-800">{grupos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-neutral-500">Reservas</span>
              <span className="text-xs font-medium text-neutral-800">{filtered.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-neutral-500">Total pasajeros</span>
              <span className="text-xs font-medium text-neutral-800">
                {filtered.reduce((s, r) => s + r.numeroPasajeros, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: grouped list */}
      <div className="space-y-3">
        {grupos.length === 0 ? (
          <div className="border border-neutral-200 rounded-lg bg-white p-12 text-center">
            <p className="text-sm text-neutral-400">
              No se encontraron reservas con los filtros aplicados
            </p>
          </div>
        ) : (
          grupos.map((grupo) => (
            <div
              key={grupo.fecha}
              className="border border-neutral-200 rounded-lg bg-white overflow-hidden"
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <div>
                  <p className="text-sm font-semibold text-neutral-800 capitalize">
                    {fmtDate(grupo.fecha)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{grupo.servicioNombre}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <Users size={13} className="text-neutral-400" />
                    <span className="font-semibold text-neutral-800">{grupo.cupoTotal}</span>
                    <span>pasajeros</span>
                    <span className="text-neutral-300 mx-0.5">·</span>
                    <span>
                      {grupo.reservas.length}{' '}
                      {grupo.reservas.length === 1 ? 'reserva' : 'reservas'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-neutral-200"
                    onClick={() => {
                      const asistentes = grupo.reservas.flatMap((r) =>
                        (r.asistentes || []).map((a) => ({
                          nombre: a.nombre,
                          tipoDocumento: a.tipoDocumento,
                          numeroDocumento: a.numeroDocumento,
                          reservaCodigo: r.codigo,
                          clienteNombre: r.nombreCliente,
                        }))
                      )
                      exportarAsistentesTourCompartido(
                        asistentes,
                        grupo.fecha,
                        grupo.servicioNombre
                      )
                    }}
                  >
                    <Download size={12} />
                    Excel
                  </Button>
                </div>
              </div>

              {/* Reservation rows */}
              <div className="divide-y divide-neutral-100">
                {grupo.reservas.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-xs font-bold text-amber-600 w-20 shrink-0">
                        {r.codigo}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-800 truncate">
                          {r.nombreCliente}
                        </p>
                        <p className="text-[11px] text-neutral-400 truncate">{r.emailCliente}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                        {r.numeroPasajeros} pax · {r.hora}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${getStateBadge(r.estado)}`}
                      >
                        {getStateLabel(r.estado)}
                      </span>
                      <span className="text-xs font-medium text-neutral-800 w-24 text-right whitespace-nowrap">
                        ${Number(r.precioTotal).toLocaleString('es-CO')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(r.id, r.codigo)
                        }}
                        disabled={deletingId === r.id}
                        className="p-1.5 rounded border border-neutral-200 text-neutral-400 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Eliminar reserva"
                      >
                        {deletingId === r.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ReservaDetailSheet
        reservaId={selectedId}
        reservas={reservasForSheet}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
