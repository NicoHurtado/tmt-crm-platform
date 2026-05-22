'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, RefreshCw, ChevronsUpDown, Check, FileDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getStateLabel, getStateBadge } from '@/lib/state-transitions'
import { getLocalizedText } from '@/types/multi-language'
import ReservaDetailSheet, { type ReservaDetail } from '@/components/admin/ReservaDetailSheet'
import TourCompartidoView from '@/components/admin/TourCompartidoView'
import type { EstadoReserva } from '@prisma/client'
import { exportarReservasExcel } from '@/lib/exportUtils'

interface Reserva extends ReservaDetail {
  createdAt: string
  esCotizacion?: boolean
  esReservaAliado?: boolean
  servicio?: { nombre: string; esCompartido?: boolean }
  asistentes?: Array<{ id: string; nombre: string; tipoDocumento: string; numeroDocumento: string }>
  pagoConductor?: boolean
}

const ESTADOS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING_PAYMENT', label: 'Pendiente de Pago' },
  { value: 'CONFIRMED_UNASSIGNED', label: 'Confirmada · Sin Asignar' },
  { value: 'CONFIRMED_ASSIGNED', label: 'Confirmada · Asignada' },
  { value: 'IN_PROGRESS', label: 'En Curso' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'PAYMENT_FAILED', label: 'Pago Fallido' },
]

const PAGOS = [
  { value: 'ALL', label: 'Todos los pagos' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
]

const CLIENTE_PAGA_OPTS = [
  { value: 'ALL', label: 'Pago cliente (todos)' },
  { value: 'paga', label: 'Cliente paga' },
  { value: 'no-paga', label: 'No paga' },
]

const PER_PAGE_OPTIONS = [20, 50, 100]

const todayISO = () => new Date().toISOString().split('T')[0]

export default function ReservasPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const servicioIdParam = searchParams.get('servicioId') ?? ''

  const [activeTab, setActiveTab] = useState<'todas' | 'tour-compartido'>('todas')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('ALL')
  const [pago, setPago] = useState('ALL')
  const [clientePagaFilter, setClientePagaFilter] = useState('ALL')
  const [servicioFilter, setServicioFilter] = useState('ALL')
  const [aliadoFilter, setAliadoFilter] = useState('ALL')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [servicioOpen, setServicioOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login')
  }, [status, router])

  const fetchReservas = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await fetch('/api/reservas')
      const d = await r.json()
      setReservas(d.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchReservas()
  }, [status])

  useEffect(() => {
    setPage(1)
  }, [search, estado, pago, clientePagaFilter, servicioFilter, aliadoFilter, fechaDesde, fechaHasta, servicioIdParam])

  // Unique services for dropdown
  const serviciosUnicos = useMemo(() => {
    const seen = new Map<string, string>()
    reservas.forEach((r) => {
      if (r.servicioId && r.servicio?.nombre) {
        const nombre = getLocalizedText(r.servicio.nombre, 'ES')
        if (!seen.has(r.servicioId)) seen.set(r.servicioId, nombre)
      }
    })
    return Array.from(seen.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [reservas])

  // Unique aliados for dropdown
  const aliadosUnicos = useMemo(() => {
    const seen = new Map<string, string>()
    reservas.forEach((r) => {
      if (r.esReservaAliado && r.aliado) {
        const key = r.aliado.codigo
        if (!seen.has(key)) seen.set(key, r.aliado.nombre)
      }
    })
    return Array.from(seen.entries())
      .map(([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [reservas])

  const filtered = useMemo(() => {
    return reservas
      .filter((r) => {
        if (servicioIdParam && r.servicioId !== servicioIdParam) return false
        if (estado !== 'ALL' && r.estado !== estado) return false
        if (pago !== 'ALL' && r.metodoPago !== pago) return false
        if (servicioFilter !== 'ALL' && r.servicioId !== servicioFilter) return false
        if (aliadoFilter !== 'ALL' && r.aliado?.codigo !== aliadoFilter) return false
        if (clientePagaFilter === 'paga' && r.clientePaga === false) return false
        if (clientePagaFilter === 'no-paga' && r.clientePaga !== false) return false
        const fechaISO = r.fecha.split('T')[0]
        if (fechaDesde && fechaISO < fechaDesde) return false
        if (fechaHasta && fechaISO > fechaHasta) return false
        if (search) {
          const q = search.toLowerCase()
          const nombre = getLocalizedText(r.servicio?.nombre ?? '', 'ES').toLowerCase()
          return (
            r.codigo.toLowerCase().includes(q) ||
            r.nombreCliente.toLowerCase().includes(q) ||
            r.emailCliente?.toLowerCase().includes(q) ||
            nombre.includes(q)
          )
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [reservas, search, estado, pago, clientePagaFilter, servicioFilter, aliadoFilter, fechaDesde, fechaHasta, servicioIdParam])

  const tourCompartidoReservas = useMemo(
    () => reservas.filter((r) => (r.servicio as any)?.esCompartido),
    [reservas]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const hasFilters = !!(search || estado !== 'ALL' || pago !== 'ALL' || clientePagaFilter !== 'ALL' || servicioFilter !== 'ALL' || aliadoFilter !== 'ALL' || fechaDesde || fechaHasta || servicioIdParam)

  const clearFilters = () => {
    setSearch('')
    setEstado('ALL')
    setPago('ALL')
    setClientePagaFilter('ALL')
    setServicioFilter('ALL')
    setAliadoFilter('ALL')
    setFechaDesde('')
    setFechaHasta('')
  }

  const setHoy = () => {
    const hoy = todayISO()
    setFechaDesde(hoy)
    setFechaHasta(hoy)
  }

  const fmtDate = (iso: string) => {
    const d = iso.split('T')[0]
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const handleTogglePagoConductor = async (reservaId: string, currentValue: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, pagoConductor: !currentValue } : r))
    try {
      await fetch(`/api/reservas/by-id/${reservaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoConductor: !currentValue }),
      })
    } catch {
      setReservas(prev => prev.map(r => r.id === reservaId ? { ...r, pagoConductor: currentValue } : r))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      {/* Service filter banner */}
      {servicioIdParam && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <span>Mostrando solo reservas del servicio seleccionado</span>
          <button
            onClick={() => router.push('/admin/dashboard/reservas')}
            className="text-blue-500 hover:text-blue-700 font-medium underline ml-4"
          >
            Ver todas las reservas
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reservas</h1>
          {!loading && (
            <p className="text-sm text-neutral-500 mt-0.5">
              {activeTab === 'todas'
                ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
                : `${tourCompartidoReservas.length} reserva${tourCompartidoReservas.length !== 1 ? 's' : ''} de tour compartido`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReservas(true)}
            disabled={refreshing}
            className="gap-1.5 text-sm border-neutral-200 h-9"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
          {activeTab === 'todas' && !loading && filtered.length > 0 && (
            <button
              onClick={() => exportarReservasExcel(filtered, 'nueva')}
              className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <FileDown size={12} />
              Descargar resultados ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('todas')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'todas'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Todas las reservas
        </button>
        <button
          onClick={() => setActiveTab('tour-compartido')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'tour-compartido'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Tour Compartido
          {!loading && tourCompartidoReservas.length > 0 && (
            <span className="text-[11px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">
              {tourCompartidoReservas.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'tour-compartido' && (
        <TourCompartidoView
          reservas={tourCompartidoReservas as any}
          onReservationDeleted={(id) => setReservas((prev) => prev.filter((r) => r.id !== id))}
        />
      )}

      {activeTab === 'todas' && <>
      {/* Filters — row 1: search, estado, pago, pago cliente */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
          <Input
            placeholder="Código, cliente, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm border-neutral-200 bg-white"
          />
        </div>

        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-[190px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e.value} value={e.value} className="text-sm">
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pago} onValueChange={setPago}>
          <SelectTrigger className="w-[140px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGOS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-sm">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clientePagaFilter} onValueChange={setClientePagaFilter}>
          <SelectTrigger className="w-[165px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENTE_PAGA_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-sm">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters — row 2: servicio, aliado, rango fechas */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={servicioOpen} onOpenChange={setServicioOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={servicioOpen}
              className="w-[220px] h-9 text-sm border-neutral-200 bg-white font-normal justify-between px-3"
            >
              <span className="truncate text-left">
                {servicioFilter !== 'ALL'
                  ? (serviciosUnicos.find((s) => s.id === servicioFilter)?.nombre ?? 'Todos los servicios')
                  : 'Todos los servicios'}
              </span>
              <ChevronsUpDown size={13} className="ml-2 shrink-0 text-neutral-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar servicio..." className="h-9 text-sm" />
              <CommandEmpty className="py-4 text-center text-xs text-neutral-400">
                Sin resultados
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="ALL"
                  onSelect={() => { setServicioFilter('ALL'); setServicioOpen(false) }}
                  className="text-sm"
                >
                  <Check
                    size={13}
                    className={`mr-2 ${servicioFilter === 'ALL' ? 'opacity-100' : 'opacity-0'}`}
                  />
                  Todos los servicios
                </CommandItem>
                {serviciosUnicos.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.nombre}
                    onSelect={() => { setServicioFilter(s.id); setServicioOpen(false) }}
                    className="text-sm"
                  >
                    <Check
                      size={13}
                      className={`mr-2 shrink-0 ${servicioFilter === s.id ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {s.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        <Select value={aliadoFilter} onValueChange={setAliadoFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue placeholder="Todos los aliados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm">Todos los aliados</SelectItem>
            {aliadosUnicos.map((a) => (
              <SelectItem key={a.codigo} value={a.codigo} className="text-sm">
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500 whitespace-nowrap">Desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-9 border border-neutral-200 rounded-md px-3 text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
          />
          <span className="text-xs text-neutral-500 whitespace-nowrap">Hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-9 border border-neutral-200 rounded-md px-3 text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-sm border-neutral-200 bg-white px-3 whitespace-nowrap"
            onClick={() => {
              const hoy = todayISO()
              if (fechaDesde === hoy && fechaHasta === hoy) {
                setFechaDesde('')
                setFechaHasta('')
              } else {
                setHoy()
              }
            }}
          >
            {fechaDesde === todayISO() && fechaHasta === todayISO() ? 'Todos' : 'Hoy'}
          </Button>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-sm text-neutral-500"
            onClick={clearFilters}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50 hover:bg-neutral-50">
              {['Creada', 'Código', 'Cliente', 'Servicio', 'Fecha', 'Estado', 'Pago', 'Pago cliente', 'Aliado', 'Total', 'Comisión', 'Pago conductor'].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="text-xs font-semibold text-neutral-500 py-2.5 first:pl-5 last:pr-5 whitespace-nowrap"
                  >
                    {h}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j} className="py-3 first:pl-5 last:pr-5">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-16 text-center text-sm text-neutral-400">
                  No se encontraron reservas
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-neutral-50 transition-colors"
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell className="py-3 pl-5">
                    <div>
                      <p className="text-xs text-neutral-700 whitespace-nowrap">
                        {fmtDate(r.createdAt)}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {new Date(r.createdAt).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs font-bold text-neutral-800 whitespace-nowrap">
                        {r.codigo}
                      </span>
                      {r.esCotizacion && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 rounded font-medium w-fit">
                          Cotización
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-xs text-neutral-800 whitespace-nowrap">
                      {r.nombreCliente}
                    </p>
                    <p className="text-[11px] text-neutral-400 max-w-[150px] truncate">
                      {r.emailCliente}
                    </p>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-700">
                      {r.servicio?.nombre ? getLocalizedText(r.servicio.nombre, 'ES') : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-xs text-neutral-700 whitespace-nowrap">
                      {fmtDate(r.fecha)}
                    </p>
                    <p className="text-[11px] text-neutral-400">{r.hora}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${getStateBadge(r.estado)}`}
                    >
                      {getStateLabel(r.estado as EstadoReserva)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${r.metodoPago === 'EFECTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                    >
                      {r.metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {(r.esReservaAliado || r.esCotizacion) ? (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${
                          r.clientePaga !== false
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {r.clientePaga !== false ? 'Cliente paga' : 'No paga'}
                      </span>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {r.esReservaAliado && r.aliado ? (
                      <span className="text-xs text-neutral-700 whitespace-nowrap">
                        {r.aliado.nombre}
                      </span>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs font-medium text-neutral-800 whitespace-nowrap">
                      ${Number(r.precioTotal).toLocaleString('es-CO')}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {r.esReservaAliado && r.comisionAliado && Number(r.comisionAliado) > 0 ? (
                      <span className="text-xs font-medium text-purple-700 whitespace-nowrap">
                        ${Number(r.comisionAliado).toLocaleString('es-CO')}
                      </span>
                    ) : (
                      <span className="text-neutral-300 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 pr-5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleTogglePagoConductor(r.id, r.pagoConductor ?? false, e)}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-colors ${
                        r.pagoConductor
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                      }`}
                      title={r.pagoConductor ? 'Conductor pagado — clic para desmarcar' : 'Conductor no pagado — clic para marcar como pagado'}
                    >
                      {r.pagoConductor ? <Check size={13} /> : <X size={13} />}
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Mostrar</span>
              <Select
                value={String(perPage)}
                onValueChange={(v) => {
                  setPerPage(Number(v))
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs border-neutral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-neutral-500">por página</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-500 mr-2">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} de{' '}
                {filtered.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-neutral-200"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={13} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-neutral-200"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>

      </>}

      <ReservaDetailSheet
        reservaId={selectedId}
        reservas={reservas}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
