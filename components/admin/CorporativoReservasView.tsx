'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronDown, Download, Search, Users, Settings2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStateLabel, getStateBadge } from '@/lib/state-transitions'
import type { EstadoReserva } from '@prisma/client'
import { exportarPasajerosCorporativo } from '@/lib/exportUtils'
import { etiquetaRuta, hoyColombia } from '@/lib/corporativo-horarios'
import ReservaDetailSheet, { type ReservaDetail, type TurnoCorporativoInfo } from '@/components/admin/ReservaDetailSheet'

/**
 * Pestaña "Corporativo" de Reservas: las salidas corporativas organizadas por día → hora →
 * empresa. Cada salida es una reserva (un vehículo) con sus cupos, pasajeros y conductor.
 */

interface ReservaCorp {
  id: string
  codigo: string
  fecha: string
  hora: string
  estado: string
  precioTotal: number
  numeroPasajeros?: number
  conductor?: { nombre: string } | null
  datos?: Record<string, any>
  turnoCorporativo?: TurnoCorporativoInfo | null
  [key: string]: any
}

interface Props {
  reservas: ReservaCorp[]
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
type Periodo = 'proximas' | 'pasadas' | 'todas'

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fechaLarga = (f: string) =>
  mayus(new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const horaBonita = (h: string) => {
  const [hh, mm] = h.split(':').map(Number)
  if (Number.isNaN(hh)) return h
  return new Date(Date.UTC(2000, 0, 1, hh, mm || 0)).toLocaleTimeString('es-CO', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function CorporativoReservasView({ reservas }: Props) {
  const hoy = hoyColombia()
  const [calYear, setCalYear] = useState(Number(hoy.slice(0, 4)))
  const [calMonth, setCalMonth] = useState(Number(hoy.slice(5, 7)) - 1)
  const [fechaSel, setFechaSel] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('proximas')
  const [empresa, setEmpresa] = useState('TODAS')
  const [estado, setEstado] = useState('TODOS')
  const [search, setSearch] = useState('')
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [todasAbiertas, setTodasAbiertas] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const corp = useMemo(() => reservas.filter((r) => r.turnoCorporativo), [reservas])
  const fechaDe = (r: ReservaCorp) => r.fecha.split('T')[0]
  const precioPersona = (r: ReservaCorp) => {
    const n = r.turnoCorporativo!.cupos.length
    return Number(r.datos?.corporativo?.precioPorPersona ?? (n ? Number(r.precioTotal) / n : 0))
  }

  const empresas = useMemo(
    () => Array.from(new Set(corp.map((r) => r.turnoCorporativo!.evento.empresa))).sort(),
    [corp]
  )
  const estados = useMemo(() => Array.from(new Set(corp.map((r) => r.estado))), [corp])
  const fechasConReservas = useMemo(() => new Set(corp.map(fechaDe)), [corp])

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return corp.filter((r) => {
      const f = fechaDe(r)
      if (fechaSel) {
        if (f !== fechaSel) return false
      } else if (periodo === 'proximas' && f < hoy) return false
      else if (periodo === 'pasadas' && f >= hoy) return false
      const t = r.turnoCorporativo!
      if (empresa !== 'TODAS' && t.evento.empresa !== empresa) return false
      if (estado !== 'TODOS' && r.estado !== estado) return false
      if (q) {
        const enPasajeros = t.cupos.some(
          (c) => c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.telefono.includes(q) || (c.numeroVuelo ?? '').toLowerCase().includes(q)
        )
        return enPasajeros || r.codigo.toLowerCase().includes(q) || t.evento.empresa.toLowerCase().includes(q)
      }
      return true
    })
  }, [corp, search, fechaSel, periodo, empresa, estado, hoy])

  /** Día → hora → salidas (una por empresa/link). */
  const dias = useMemo(() => {
    const porDia = new Map<string, Map<string, ReservaCorp[]>>()
    for (const r of filtradas) {
      const f = fechaDe(r)
      if (!porDia.has(f)) porDia.set(f, new Map())
      const porHora = porDia.get(f)!
      porHora.set(r.hora, [...(porHora.get(r.hora) ?? []), r])
    }
    const lista = Array.from(porDia.entries()).map(([fecha, porHora]) => {
      const horas = Array.from(porHora.entries())
        .map(([hora, salidas]) => ({
          hora,
          salidas: salidas.sort((a, b) => a.turnoCorporativo!.evento.empresa.localeCompare(b.turnoCorporativo!.evento.empresa)),
        }))
        .sort((a, b) => a.hora.localeCompare(b.hora))
      const salidas = horas.flatMap((h) => h.salidas)
      return {
        fecha,
        horas,
        salidas: salidas.length,
        pasajeros: salidas.reduce((s, r) => s + r.turnoCorporativo!.cupos.length, 0),
        total: salidas.reduce((s, r) => s + Number(r.precioTotal), 0),
        sinConductor: salidas.filter((r) => !r.conductor).length,
      }
    })
    lista.sort((a, b) => (periodo === 'pasadas' && !fechaSel ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)))
    return lista
  }, [filtradas, periodo, fechaSel])

  const resumen = {
    dias: dias.length,
    salidas: filtradas.length,
    pasajeros: dias.reduce((s, d) => s + d.pasajeros, 0),
    sinConductor: dias.reduce((s, d) => s + d.sinConductor, 0),
    total: dias.reduce((s, d) => s + d.total, 0),
  }

  const exportar = (salidas: ReservaCorp[], nombre: string) => {
    const filas = salidas.flatMap((r) => {
      const t = r.turnoCorporativo!
      return t.cupos.map((c) => ({
        fecha: fechaDe(r),
        hora: r.hora,
        empresa: t.evento.empresa,
        ruta: t.evento.aeropuertoNombre && t.evento.aeropuertoTipo ? etiquetaRuta(t.evento.aeropuertoNombre, t.evento.aeropuertoTipo) : '',
        reserva: r.codigo,
        conductor: r.conductor?.nombre ?? 'Sin asignar',
        nombre: c.nombre,
        whatsapp: c.telefono,
        email: c.email,
        vuelo: c.numeroVuelo ?? '',
        valor: precioPersona(r),
      }))
    })
    exportarPasajerosCorporativo(filas, nombre)
  }

  const toggle = (id: string) =>
    setAbiertas((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const abierta = (id: string) => todasAbiertas || abiertas.has(id)

  // Calendario
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - firstDay + 1
    if (day < 1 || day > daysInMonth) return null
    return { day, iso: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  })
  const prevMonth = () => (calMonth === 0 ? (setCalYear((y) => y - 1), setCalMonth(11)) : setCalMonth((m) => m - 1))
  const nextMonth = () => (calMonth === 11 ? (setCalYear((y) => y + 1), setCalMonth(0)) : setCalMonth((m) => m + 1))

  const reservasForSheet = useMemo(() => reservas as unknown as ReservaDetail[], [reservas])

  if (corp.length === 0) {
    return (
      <div className="border border-neutral-200 rounded-lg bg-white p-12 text-center">
        <p className="text-sm text-neutral-500">Aún no hay reservas corporativas</p>
        <p className="text-xs text-neutral-400 mt-1">
          Cuando un funcionario reserve su cupo en un link corporativo, su salida aparece aquí organizada por día y hora.
        </p>
      </div>
    )
  }

  const hayFiltros = !!(search || empresa !== 'TODAS' || estado !== 'TODOS' || fechaSel)

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[272px_1fr] lg:gap-4 lg:items-start min-w-0">
      {/* Panel izquierdo */}
      <div className="space-y-3">
        <div className="border border-neutral-200 rounded-lg bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="area-tactil-completa p-1 rounded hover:bg-neutral-100" aria-label="Mes anterior">
              <ChevronLeft size={13} className="text-neutral-500" />
            </button>
            <span className="text-xs font-semibold text-neutral-700">{MESES[calMonth]} {calYear}</span>
            <button onClick={nextMonth} className="area-tactil-completa p-1 rounded hover:bg-neutral-100" aria-label="Mes siguiente">
              <ChevronRight size={13} className="text-neutral-500" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-neutral-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />
              const hay = fechasConReservas.has(cell.iso)
              const sel = fechaSel === cell.iso
              return (
                <button
                  key={cell.iso}
                  onClick={() => setFechaSel(sel ? null : cell.iso)}
                  disabled={!hay}
                  className={[
                    'relative flex items-center justify-center h-8 w-full rounded text-xs transition-colors',
                    sel ? 'bg-amber-500 text-white font-semibold' : hay ? 'hover:bg-amber-50 text-neutral-800' : 'text-neutral-300 cursor-default',
                    cell.iso === hoy && !sel ? 'font-semibold text-amber-600' : '',
                  ].join(' ')}
                >
                  {cell.day}
                  {hay && !sel && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400" />}
                </button>
              )
            })}
          </div>
          {fechaSel && (
            <button onClick={() => setFechaSel(null)} className="mt-3 w-full text-[11px] text-neutral-400 hover:text-neutral-600">
              Ver todos los días
            </button>
          )}
        </div>

        <div className="border border-neutral-200 rounded-lg bg-white p-4 space-y-2.5">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Filtros</p>
          <div className="inline-flex w-full rounded-md border border-neutral-200 p-0.5">
            {([['proximas', 'Próximas'], ['pasadas', 'Pasadas'], ['todas', 'Todas']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => { setPeriodo(k); setFechaSel(null) }}
                className={`flex-1 px-2 py-1.5 text-xs rounded ${periodo === k && !fechaSel ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
            <Input
              placeholder="Pasajero, vuelo, código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-xs border-neutral-200 bg-white"
            />
          </div>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="h-8 w-full text-xs border-neutral-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS" className="text-xs">Todas las empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="h-8 w-full text-xs border-neutral-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS" className="text-xs">Todos los estados</SelectItem>
              {estados.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">{getStateLabel(e as EstadoReserva)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hayFiltros && (
            <button
              onClick={() => { setSearch(''); setEmpresa('TODAS'); setEstado('TODOS'); setFechaSel(null) }}
              className="text-[11px] text-neutral-400 hover:text-neutral-600"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="border border-neutral-200 rounded-lg bg-white p-4">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Resumen</p>
          <div className="space-y-2 text-xs">
            {([
              ['Días', String(resumen.dias)],
              ['Salidas (carros)', String(resumen.salidas)],
              ['Pasajeros', String(resumen.pasajeros)],
              ['Salidas sin conductor', String(resumen.sinConductor)],
              ['Total a facturar', cop(resumen.total)],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-neutral-500">{k}</span>
                <span className={`font-medium ${k === 'Salidas sin conductor' && resumen.sinConductor > 0 ? 'text-red-600' : 'text-neutral-800'}`}>{v}</span>
              </div>
            ))}
          </div>
          {filtradas.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3 w-full h-8 text-xs gap-1.5" onClick={() => exportar(filtradas, `Corporativo_${fechaSel ?? periodo}`)}>
              <Download size={12} /> Excel de lo filtrado
            </Button>
          )}
        </div>
      </div>

      {/* Panel derecho: día → hora → empresa */}
      <div className="space-y-3 min-w-0">
        <div className="flex justify-end">
          <button onClick={() => setTodasAbiertas((v) => !v)} className="text-xs text-amber-700 hover:underline">
            {todasAbiertas ? 'Ocultar pasajeros' : 'Mostrar todos los pasajeros'}
          </button>
        </div>

        {dias.length === 0 ? (
          <div className="border border-neutral-200 rounded-lg bg-white p-12 text-center">
            <p className="text-sm text-neutral-400">
              {periodo === 'proximas' && !hayFiltros ? 'No hay salidas corporativas próximas' : 'No hay salidas con los filtros aplicados'}
            </p>
          </div>
        ) : (
          dias.map((d) => (
            <div key={d.fecha} className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
              {/* Encabezado del día */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    {fechaLarga(d.fecha)}
                    {d.fecha === hoy && <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Hoy</span>}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                    <Users size={12} className="text-neutral-400" />
                    <span className="font-semibold text-neutral-800">{d.pasajeros}</span> pasajeros
                    <span className="text-neutral-300">·</span>
                    {d.salidas} {d.salidas === 1 ? 'salida' : 'salidas'}
                    <span className="text-neutral-300">·</span>
                    {cop(d.total)}
                    {d.sinConductor > 0 && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="text-red-600">{d.sinConductor} sin conductor</span>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 border-neutral-200 bg-white"
                  onClick={() => exportar(d.horas.flatMap((h) => h.salidas), `Corporativo_${d.fecha}`)}
                >
                  <Download size={12} /> Excel del día
                </Button>
              </div>

              {/* Horas */}
              <div className="divide-y divide-neutral-100">
                {d.horas.map((h) => (
                  <div key={h.hora} className="flex flex-col sm:flex-row">
                    <div className="sm:w-28 shrink-0 px-5 pt-3 sm:py-3 sm:border-r border-neutral-100">
                      <p className="text-sm font-semibold text-neutral-900 whitespace-nowrap">{horaBonita(h.hora)}</p>
                      <p className="text-[11px] text-neutral-400">
                        {h.salidas.reduce((s, r) => s + r.turnoCorporativo!.cupos.length, 0)} pax
                      </p>
                    </div>
                    <div className="flex-1 min-w-0 divide-y divide-neutral-50">
                      {h.salidas.map((r) => {
                        const t = r.turnoCorporativo!
                        const ocupados = t.cupos.length
                        const open = abierta(r.id)
                        return (
                          <div key={r.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 xl:grid xl:gap-x-3 xl:grid-cols-[minmax(130px,1fr)_96px_80px_150px_112px_76px_auto]">
                              <div className="min-w-[130px] flex-1">
                                <p className="text-sm font-semibold text-neutral-800">{t.evento.empresa}</p>
                                {t.evento.aeropuertoNombre && t.evento.aeropuertoTipo && (
                                  <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                    {etiquetaRuta(t.evento.aeropuertoNombre, t.evento.aeropuertoTipo)}
                                  </span>
                                )}
                              </div>
                              <div className="w-24">
                                <p className={`text-xs font-medium ${ocupados >= t.capacidad ? 'text-red-600' : 'text-neutral-700'}`}>
                                  {ocupados}/{t.capacidad} cupos
                                </p>
                                <div className="mt-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                  <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (ocupados / t.capacidad) * 100)}%` }} />
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedId(r.id)}
                                className="font-mono text-xs font-bold text-amber-600 hover:underline text-left"
                                title="Ver la reserva de esta salida"
                              >
                                {r.codigo}
                              </button>
                              <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap ${getStateBadge(r.estado as EstadoReserva)}`}>
                                {getStateLabel(r.estado as EstadoReserva)}
                              </span>
                              <span className={`text-xs whitespace-nowrap ${r.conductor ? 'text-neutral-700' : 'text-red-600 inline-flex items-center gap-1'}`}>
                                {r.conductor ? r.conductor.nombre : (<><UserX size={12} /> Sin conductor</>)}
                              </span>
                              <span className="text-xs font-medium text-neutral-800 text-right whitespace-nowrap">{cop(Number(r.precioTotal))}</span>
                              <div className="flex items-center justify-end gap-1 ml-auto xl:ml-0">
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => toggle(r.id)}>
                                  Pasajeros <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild title="Gestionar cupos, horas y precios">
                                  <Link href={`/admin/dashboard/corporativo/${t.evento.id}`}><Settings2 size={12} /> Gestionar</Link>
                                </Button>
                              </div>
                            </div>
                            {open && (
                              <ol className="mt-2 rounded-md border border-neutral-100 divide-y divide-neutral-50">
                                {t.cupos.map((c, i) => (
                                  <li key={c.id} className="grid grid-cols-[24px_1fr] sm:grid-cols-[24px_1.2fr_1fr_1.4fr_0.8fr] gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
                                    <span className="text-neutral-400">{i + 1}</span>
                                    <span className="font-medium text-neutral-800">{c.nombre}</span>
                                    <span className="text-neutral-600 col-start-2 sm:col-start-auto">{c.telefono}</span>
                                    <span className="text-neutral-400 truncate col-start-2 sm:col-start-auto">{c.email}</span>
                                    <span className="text-neutral-600 col-start-2 sm:col-start-auto">{c.numeroVuelo ? `Vuelo ${c.numeroVuelo}` : '—'}</span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <ReservaDetailSheet reservaId={selectedId} reservas={reservasForSheet} onClose={() => setSelectedId(null)} />
    </div>
  )
}
