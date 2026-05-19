'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Plus, Clock, ChevronDown, ChevronUp, Eye, Copy, Check, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import QuoteWizard from '@/components/admin/QuoteWizard'
import { getLocalizedText } from '@/types/multi-language'
import { getStateLabel, getStateBadge } from '@/lib/state-transitions'

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

export default function CotizacionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'crear' | 'historial'>('crear')
  const [services, setServices] = useState<any[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [municipalExpanded, setMunicipalExpanded] = useState(false)

  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('ALL')
  const [metodoPagoFilter, setMetodoPagoFilter] = useState('ALL')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 15

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/admin/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/servicios')
      .then((r) => r.json())
      .then((d) => setServices(d.data || []))
      .catch(console.error)
      .finally(() => setLoadingServices(false))
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated' || activeTab !== 'historial') return
    setLoadingHistory(true)
    fetch('/api/admin/cotizaciones')
      .then((r) => r.json())
      .then((d) => setCotizaciones(d.data || []))
      .catch(console.error)
      .finally(() => setLoadingHistory(false))
  }, [status, activeTab])

  useEffect(() => setPage(1), [search, estadoFilter, metodoPagoFilter])

  const handleSelectService = (svc: any) => {
    setSelectedService(svc)
    setWizardOpen(true)
  }

  const handleWizardClose = () => {
    setWizardOpen(false)
    setSelectedService(null)
    if (activeTab === 'historial') {
      setLoadingHistory(true)
      fetch('/api/admin/cotizaciones')
        .then((r) => r.json())
        .then((d) => setCotizaciones(d.data || []))
        .catch(console.error)
        .finally(() => setLoadingHistory(false))
    }
  }

  const copyTrackingLink = (codigo: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/tracking/${codigo}`)
    setCopiedCode(codigo)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso).toISOString().split('T')[0]
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const estados = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'PENDING_PAYMENT', label: 'Pendiente de Pago' },
    { value: 'CONFIRMED_UNASSIGNED', label: 'Confirmada · Sin Asignar' },
    { value: 'CONFIRMED_ASSIGNED', label: 'Confirmada · Asignada' },
    { value: 'IN_PROGRESS', label: 'En Curso' },
    { value: 'COMPLETED', label: 'Completada' },
    { value: 'CANCELLED', label: 'Cancelada' },
    { value: 'PAYMENT_FAILED', label: 'Pago Fallido' },
  ]

  const filtered = useMemo(
    () =>
      cotizaciones.filter((c) => {
        if (estadoFilter !== 'ALL' && c.estado !== estadoFilter) return false
        if (metodoPagoFilter !== 'ALL' && c.metodoPago !== metodoPagoFilter) return false
        if (search) {
          const q = search.toLowerCase()
          const nombre = getLocalizedText(c.servicio?.nombre ?? '', 'ES').toLowerCase()
          return (
            c.codigo.toLowerCase().includes(q) ||
            c.nombreCliente.toLowerCase().includes(q) ||
            c.emailCliente?.toLowerCase().includes(q) ||
            nombre.includes(q)
          )
        }
        return true
      }),
    [cotizaciones, search, estadoFilter, metodoPagoFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const municipalServices = services.filter((s) => s.esMunicipal)
  const otherServices = services.filter((s) => !s.esMunicipal)

  return (
    <div className="flex flex-col gap-0 w-full">
      {/* Header with tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-6 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-neutral-900">Cotizaciones</h1>
        </div>
        <div className="flex gap-0">
          <TabBtn
            active={activeTab === 'crear'}
            icon={<Plus size={14} />}
            label="Nueva cotización"
            onClick={() => setActiveTab('crear')}
          />
          <TabBtn
            active={activeTab === 'historial'}
            icon={<Clock size={14} />}
            label={`Historial${cotizaciones.length > 0 ? ` (${cotizaciones.length})` : ''}`}
            onClick={() => setActiveTab('historial')}
          />
        </div>
      </div>

      <div className="p-6">
        {/* ── TAB CREAR ── */}
        {activeTab === 'crear' && (
          <div>
            {loadingServices ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Other services */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {otherServices.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => handleSelectService(svc)}
                      className="text-left p-4 border border-neutral-200 rounded-lg hover:border-amber-400 hover:bg-amber-50/40 transition-all group bg-white"
                    >
                      <div className="flex items-center gap-3">
                        {svc.imagen && (
                          <div className="relative w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <Image
                              src={svc.imagen}
                              alt={getLocalizedText(svc.nombre, 'ES')}
                              fill
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 group-hover:text-amber-700 truncate">
                            {getLocalizedText(svc.nombre, 'ES')}
                          </p>
                          {svc.descripcion && (
                            <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                              {getLocalizedText(svc.descripcion, 'ES')}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Municipal services collapsible */}
                {municipalServices.length > 0 && (
                  <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => setMunicipalExpanded(!municipalExpanded)}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center">
                          <span className="text-blue-600 text-lg">🗺</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-neutral-800">Transporte Municipal</p>
                          <p className="text-xs text-neutral-400">
                            {municipalServices.length} municipios
                          </p>
                        </div>
                      </div>
                      {municipalExpanded ? (
                        <ChevronUp size={16} className="text-neutral-400" />
                      ) : (
                        <ChevronDown size={16} className="text-neutral-400" />
                      )}
                    </button>

                    {municipalExpanded && (
                      <div className="border-t border-neutral-100 p-4 bg-neutral-50">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                          {municipalServices.map((svc) => (
                            <button
                              key={svc.id}
                              onClick={() => handleSelectService(svc)}
                              className="text-left p-3 bg-white border border-neutral-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition-all"
                            >
                              <p className="text-sm font-medium text-neutral-700 truncate">
                                {getLocalizedText(svc.nombre, 'ES')}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB HISTORIAL ── */}
        {activeTab === 'historial' && (
          <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                <Input
                  placeholder="Código, cliente, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm border-neutral-200 bg-white"
                />
              </div>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[200px] h-9 text-sm border-neutral-200 bg-white">
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
              <Select value={metodoPagoFilter} onValueChange={setMetodoPagoFilter}>
                <SelectTrigger className="w-[160px] h-9 text-sm border-neutral-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-sm">Todos los métodos</SelectItem>
                  <SelectItem value="TARJETA" className="text-sm">Tarjeta</SelectItem>
                  <SelectItem value="EFECTIVO" className="text-sm">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                    {['Creada', 'Código', 'Cliente', 'Aliado', 'Servicio', 'Fecha', 'Pago', 'Estado', 'Total', ''].map(
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
                  {loadingHistory ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <TableCell key={j} className="py-3 first:pl-5 last:pr-5">
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-16 text-center text-sm text-neutral-400">
                        {cotizaciones.length === 0
                          ? 'No hay cotizaciones creadas aún'
                          : 'Sin resultados para estos filtros'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((cot) => (
                      <TableRow key={cot.id} className="hover:bg-neutral-50 transition-colors">
                        <TableCell className="py-3 pl-5">
                          <p className="text-xs text-neutral-800 whitespace-nowrap">
                            {fmtDate(cot.createdAt)}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            {new Date(cot.createdAt).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-mono text-xs font-semibold text-amber-600 whitespace-nowrap">
                            {cot.codigo}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="text-xs font-medium text-neutral-800 whitespace-nowrap">
                            {cot.nombreCliente}
                          </p>
                          <p className="text-[11px] text-neutral-400 max-w-[140px] truncate">
                            {cot.emailCliente}
                          </p>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={`text-xs whitespace-nowrap ${cot.aliado ? 'text-neutral-800 font-medium' : 'text-neutral-400 italic'}`}>
                            {cot.aliado?.nombre ?? 'Transportes Medellín Travel'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs text-neutral-700">
                            {cot.servicio?.nombre
                              ? getLocalizedText(cot.servicio.nombre, 'ES')
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="text-xs text-neutral-800 whitespace-nowrap">
                            {fmtDate(cot.fecha)}
                          </p>
                          <p className="text-[11px] text-neutral-400">{cot.hora}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded border ${cot.metodoPago === 'EFECTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                          >
                            {cot.metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${getStateBadge(cot.estado)}`}
                          >
                            {getStateLabel(cot.estado)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs font-semibold text-neutral-800 whitespace-nowrap">
                            ${Number(cot.precioTotal).toLocaleString('es-CO')}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 pr-5">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => router.push(`/admin/dashboard/reservas/${cot.id}`)}
                              title="Ver detalle"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => copyTrackingLink(cot.codigo)}
                              title="Copiar link de tracking"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              {copiedCode === cot.codigo ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                            <a
                              href={`/tracking/${cot.codigo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Abrir tracking"
                              className="p-1.5 rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {!loadingHistory && filtered.length > PER_PAGE && (
                <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} de{' '}
                    {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
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
          </div>
        )}
      </div>

      {selectedService && (
        <QuoteWizard service={selectedService} isOpen={wizardOpen} onClose={handleWizardClose} />
      )}
    </div>
  )
}

function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-amber-500 text-amber-600'
          : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
