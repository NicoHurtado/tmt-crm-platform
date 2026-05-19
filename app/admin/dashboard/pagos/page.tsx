'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

interface ReservaConPago {
  id: string
  codigo: string
  estadoPago: string | null
  metodoPago: string
  precioFinal: number
  creadoEn: string
  servicio: { nombre: any }
  cliente?: { nombre: string } | null
  aliado?: { nombre: string } | null
}

const ESTADO_PAGO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  PROCESANDO: 'Procesando',
}

const ESTADO_PAGO_CLASS: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  APROBADO: 'bg-green-50 text-green-700 border-green-200',
  RECHAZADO: 'bg-red-50 text-red-700 border-red-200',
  PROCESANDO: 'bg-blue-50 text-blue-700 border-blue-200',
}

const METODO_LABEL: Record<string, string> = {
  BOLD: 'Bold (online)',
  EFECTIVO: 'Efectivo',
}

function getLocalizedText(value: any, lang = 'ES'): string {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed[lang] || parsed['ES'] || Object.values(parsed)[0] || ''
    } catch {
      return value
    }
  }
  if (typeof value === 'object') return value[lang] || value['ES'] || Object.values(value)[0] || ''
  return String(value)
}

export default function PagosPage() {
  const [reservas, setReservas] = useState<ReservaConPago[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('ALL')
  const [metodoFilter, setMetodoFilter] = useState('ALL')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/reservas?limit=500')
        const data = await res.json()
        setReservas(data.data || [])
      } catch (error) {
        console.error('Error fetching reservas:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = reservas.filter((r) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      r.codigo.toLowerCase().includes(q) ||
      (r.cliente?.nombre || '').toLowerCase().includes(q) ||
      (r.aliado?.nombre || '').toLowerCase().includes(q)
    const matchEstado = estadoFilter === 'ALL' || r.estadoPago === estadoFilter
    const matchMetodo = metodoFilter === 'ALL' || r.metodoPago === metodoFilter
    return matchSearch && matchEstado && matchMetodo
  })

  const totalAprobado = filtered
    .filter((r) => r.estadoPago === 'APROBADO')
    .reduce((sum, r) => sum + Number(r.precioFinal), 0)

  const totalPendiente = filtered
    .filter((r) => r.estadoPago === 'PENDIENTE' || r.estadoPago === 'PROCESANDO')
    .reduce((sum, r) => sum + Number(r.precioFinal), 0)

  return (
    <div className="flex flex-col gap-4 p-6 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Pagos</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Estado de pagos de todas las reservas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total reservas', value: filtered.length.toString() },
          { label: 'Aprobados', value: filtered.filter((r) => r.estadoPago === 'APROBADO').length.toString() },
          {
            label: 'Recaudado (filtrado)',
            value: `$${totalAprobado.toLocaleString('es-CO')}`,
          },
          {
            label: 'Pendiente de cobro',
            value: `$${totalPendiente.toLocaleString('es-CO')}`,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="border border-neutral-200 rounded-lg bg-white p-3"
          >
            <p className="text-[11px] text-neutral-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-lg font-semibold text-neutral-900 mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
          <Input
            placeholder="Buscar por código o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm border-neutral-200 bg-white"
          />
        </div>

        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm">Todos los estados</SelectItem>
            {Object.entries(ESTADO_PAGO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={metodoFilter} onValueChange={setMetodoFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm">Todos los métodos</SelectItem>
            {Object.entries(METODO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-sm">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Código</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Servicio</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Cliente / Aliado</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Método</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Estado</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9 text-right">Monto</TableHead>
                <TableHead className="text-xs font-medium text-neutral-500 h-9">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-neutral-400 py-12">
                    No se encontraron pagos
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-neutral-50">
                    <TableCell className="py-2.5">
                      <span className="text-xs font-mono font-medium text-neutral-700">{r.codigo}</span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-neutral-600 max-w-[140px] truncate block">
                        {getLocalizedText(r.servicio?.nombre, 'ES')}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-neutral-600">
                        {r.cliente?.nombre || r.aliado?.nombre || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-neutral-500">
                        {METODO_LABEL[r.metodoPago] || r.metodoPago}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {r.estadoPago ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium h-5 ${ESTADO_PAGO_CLASS[r.estadoPago] || 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
                        >
                          {ESTADO_PAGO_LABEL[r.estadoPago] || r.estadoPago}
                        </Badge>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <span className="text-xs font-semibold text-neutral-700">
                        ${Number(r.precioFinal).toLocaleString('es-CO')}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-neutral-500">
                        {new Date(r.creadoEn).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
