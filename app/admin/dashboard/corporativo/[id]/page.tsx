'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, Trash2, UserPlus, Save, ArrowRightLeft, CalendarDays, Users, Wallet, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import EventoCorporativoForm, { type EventoFormData } from '@/components/admin/corporativo/EventoCorporativoForm'
import {
  etiquetaRuta,
  hoyColombia,
  partesColombia,
  type AeropuertoCorp,
  type SentidoCorp,
} from '@/lib/corporativo-horarios'
import { cop } from '@/components/admin/corporativo/link'
import CompartirLink from '@/components/admin/corporativo/CompartirLink'

interface Cupo {
  id: string
  nombre: string
  email: string
  telefono: string
  numeroVuelo: string | null
  notas: string | null
  createdAt: string
}
interface Horario {
  id: string
  hora: string
  capacidad: number
  precioPorPersona: number | null
  vehiculo: string | null
  activo: boolean
}
interface Turno {
  id: string
  horarioId: string | null
  fechaHora: string
  capacidad: number
  vehiculo: string | null
  precioPorPersona: number | null
  cupos: Cupo[]
  reserva: { id: string; codigo: string; estado: string; conductor: { nombre: string } | null } | null
}
interface Evento {
  id: string
  codigo: string
  aliadoId: string | null
  aliado: { id: string; nombre: string; codigo: string; corporativoActivo: boolean } | null
  servicioId: string | null
  aeropuertoNombre: AeropuertoCorp
  aeropuertoTipo: SentidoCorp
  empresa: string
  titulo: string
  descripcion: string | null
  origen: string
  destino: string
  precioPorPersona: number
  contactoNombre: string | null
  contactoEmail: string | null
  activo: boolean
  fechaDesde: string | null
  fechaHasta: string | null
  diasSemana: number[]
  horarios: Horario[]
  turnos: Turno[]
}

/** Una celda del día: una hora del horario (o una salida suelta) con sus cupos ese día. */
interface CeldaHora {
  hora: string
  horarioId: string | null
  capacidad: number
  precio: number
  turno: Turno | null
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fechaLarga = (f: string) =>
  mayus(new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const horaBonita = (h: string) => {
  const [hh, mm] = h.split(':').map(Number)
  return new Date(Date.UTC(2000, 0, 1, hh, mm)).toLocaleTimeString('es-CO', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true })
}

const aForm = (e: Evento): EventoFormData => ({
  aliadoId: e.aliadoId ?? '',
  aeropuertoNombre: e.aeropuertoNombre,
  aeropuertoTipo: e.aeropuertoTipo,
  codigo: e.codigo,
  servicioId: e.servicioId ?? '',
  empresa: e.empresa,
  titulo: e.titulo,
  descripcion: e.descripcion ?? '',
  origen: e.origen,
  destino: e.destino,
  precioPorPersona: e.precioPorPersona,
  contactoNombre: e.contactoNombre ?? '',
  contactoEmail: e.contactoEmail ?? '',
  activo: e.activo,
  fechaDesde: e.fechaDesde ?? '',
  fechaHasta: e.fechaHasta ?? '',
  diasSemana: e.diasSemana,
  horarios: e.horarios.map((h) => ({
    id: h.id,
    hora: h.hora,
    capacidad: h.capacidad,
    vehiculo: h.vehiculo ?? '',
    activo: h.activo,
    precioPorPersona: h.precioPorPersona === null ? '' : String(h.precioPorPersona),
  })),
})

const NUEVO_CUPO = { nombre: '', telefono: '', email: '', numeroVuelo: '', notas: '' }
type Filtro = 'proximos' | 'pasados' | 'todos'

export default function EventoCorporativoDetalle() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [form, setForm] = useState<EventoFormData | null>(null)
  const [tab, setTab] = useState<'reservas' | 'config'>('reservas')
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [diaExtra, setDiaExtra] = useState('')
  const [saving, setSaving] = useState(false)
  const [borrarEvento, setBorrarEvento] = useState(false)
  const [borrarCupo, setBorrarCupo] = useState<Cupo | null>(null)
  const [agregar, setAgregar] = useState<{ fecha: string; horarioId: string } | null>(null)
  const [nuevoCupo, setNuevoCupo] = useState(NUEVO_CUPO)
  const [mover, setMover] = useState<{ cupo: Cupo; fecha: string; horarioId: string } | null>(null)
  const [hoy, setHoy] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/admin/corporativo/${id}`)
    if (!res.ok) {
      toast.error('Evento no encontrado')
      return router.push('/admin/dashboard/corporativo')
    }
    const data = await res.json()
    setEvento(data.data)
    setForm(aForm(data.data))
  }, [id, router])

  useEffect(() => {
    setHoy(hoyColombia())
    cargar()
  }, [cargar])

  const precioDe = useCallback((t: Turno) => t.precioPorPersona ?? evento?.precioPorPersona ?? 0, [evento])

  /** Días con al menos un cupo (más el día que el admin abra a mano), cada uno con sus horas. */
  const dias = useMemo(() => {
    if (!evento) return []
    const porFecha = new Map<string, Turno[]>()
    for (const t of evento.turnos) {
      if (t.cupos.length === 0) continue
      const f = partesColombia(t.fechaHora).fecha
      porFecha.set(f, [...(porFecha.get(f) ?? []), t])
    }
    if (diaExtra && !porFecha.has(diaExtra)) porFecha.set(diaExtra, [])
    return Array.from(porFecha.entries())
      .map(([fecha, turnos]) => {
        const celdas: CeldaHora[] = evento.horarios
          .filter((h) => h.activo || turnos.some((t) => t.horarioId === h.id))
          .map((h) => {
            const turno = turnos.find((t) => partesColombia(t.fechaHora).hora === h.hora) ?? null
            return {
              hora: h.hora,
              horarioId: h.id,
              capacidad: turno?.capacidad ?? h.capacidad,
              precio: turno ? precioDe(turno) : h.precioPorPersona ?? evento.precioPorPersona,
              turno,
            }
          })
        // Salidas cuya hora ya no está en el horario (se cambió o quitó después de reservar).
        for (const t of turnos) {
          const hora = partesColombia(t.fechaHora).hora
          if (!celdas.some((c) => c.hora === hora)) {
            celdas.push({ hora, horarioId: t.horarioId, capacidad: t.capacidad, precio: precioDe(t), turno: t })
          }
        }
        celdas.sort((a, b) => a.hora.localeCompare(b.hora))
        const cupos = celdas.reduce((s, c) => s + (c.turno?.cupos.length ?? 0), 0)
        const total = celdas.reduce((s, c) => s + (c.turno ? c.turno.cupos.length * c.precio : 0), 0)
        return { fecha, celdas, cupos, total }
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [evento, diaExtra, precioDe])

  const diasVisibles = useMemo(() => {
    if (!hoy) return dias
    if (filtro === 'proximos') return dias.filter((d) => d.fecha >= hoy || d.fecha === diaExtra)
    if (filtro === 'pasados') return dias.filter((d) => d.fecha < hoy).reverse()
    return dias
  }, [dias, filtro, hoy, diaExtra])

  const guardar = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/corporativo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'Error al guardar')
      toast.success('Cambios guardados')
      await cargar()
    } finally {
      setSaving(false)
    }
  }

  const confirmarMover = async () => {
    if (!mover) return
    const res = await fetch(`/api/admin/corporativo/cupos/${mover.cupo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: mover.fecha, horarioId: mover.horarioId }),
    })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo mover')
    toast.success('Pasajero movido')
    setMover(null)
    cargar()
  }

  const eliminarCupo = async () => {
    if (!borrarCupo) return
    const res = await fetch(`/api/admin/corporativo/cupos/${borrarCupo.id}`, { method: 'DELETE' })
    setBorrarCupo(null)
    if (!res.ok) return toast.error('No se pudo liberar')
    toast.success('Cupo liberado')
    cargar()
  }

  const agregarCupo = async () => {
    if (!agregar) return
    const res = await fetch(`/api/admin/corporativo/${id}/cupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevoCupo, ...agregar }),
    })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo agregar')
    toast.success('Pasajero agregado')
    setAgregar(null)
    setNuevoCupo(NUEVO_CUPO)
    cargar()
  }

  const eliminarEvento = async () => {
    const res = await fetch(`/api/admin/corporativo/${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(data.error || 'No se pudo eliminar')
    toast.success('Evento eliminado')
    router.push('/admin/dashboard/corporativo')
  }

  const exportarCSV = () => {
    if (!evento) return
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const filas = [
      ['Fecha', 'Hora', 'Nombre', 'Vuelo', 'WhatsApp', 'Correo', 'Notas', 'Reserva', 'Valor'],
      ...evento.turnos.flatMap((t) => {
        const { fecha, hora } = partesColombia(t.fechaHora)
        return t.cupos.map((c) => [fecha, hora, c.nombre, c.numeroVuelo, c.telefono, c.email, c.notas, t.reserva?.codigo, precioDe(t)])
      }),
    ]
    const csv = '﻿' + filas.map((f) => f.map(q).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `corporativo-${evento.codigo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!evento || !form) {
    return (
      <div className="p-4 sm:p-6 space-y-3">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const totalCupos = dias.reduce((s, d) => s + d.cupos, 0)
  const total = dias.reduce((s, d) => s + d.total, 0)
  const proximos = dias.filter((d) => hoy && d.fecha >= hoy && d.cupos > 0)
  const cuposProximos = proximos.reduce((s, d) => s + d.cupos, 0)
  const proxima = proximos
    .flatMap((d) => d.celdas.filter((c) => c.turno && c.turno.cupos.length > 0).map((c) => ({ ...c, fecha: d.fecha })))
    .find((c) => new Date(c.turno!.fechaHora).getTime() >= Date.now())
  const horasActivas = evento.horarios.filter((h) => h.activo)

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 w-full min-w-0">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/dashboard/corporativo" className="text-xs text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Corporativo
          </Link>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 flex flex-wrap items-center gap-2">
            {evento.empresa}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
              {etiquetaRuta(evento.aeropuertoNombre, evento.aeropuertoTipo)}
            </span>
            <Badge variant="outline" className={`text-[10px] ${evento.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500'}`}>
              {evento.activo ? 'Link abierto' : 'Link cerrado'}
            </Badge>
          </h1>
          <p className="text-sm text-neutral-500">
            {evento.origen} → {evento.destino} · {horasActivas.length} horas diarias:{' '}
            {horasActivas.map((h) => horaBonita(h.hora)).join(', ') || '—'}
          </p>
          {evento.aliado && (
            <Link href="/admin/dashboard/aliados" className="text-xs text-amber-700 hover:underline">
              Aliado: {evento.aliado.nombre} ({evento.aliado.codigo})
            </Link>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={exportarCSV} disabled={totalCupos === 0}>
          <Download size={13} /> Exportar pasajeros
        </Button>
      </div>

      {evento.aliado && !evento.aliado.corporativoActivo && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          El servicio corporativo de {evento.aliado.nombre} está desactivado: el link no recibe reservas.
          Actívalo en <Link href="/admin/dashboard/aliados" className="underline">Aliados</Link>.
        </p>
      )}

      <CompartirLink codigo={evento.codigo} empresa={evento.empresa} origen={evento.origen} destino={evento.destino} />

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Resumen icon={<Users size={14} />} label="Cupos reservados" valor={String(totalCupos)} detalle={`${cuposProximos} en fechas próximas`} />
        <Resumen icon={<CalendarDays size={14} />} label="Días con reservas" valor={String(dias.filter((d) => d.cupos > 0).length)} detalle={`${proximos.length} próximos`} />
        <Resumen icon={<Wallet size={14} />} label="Total a facturar" valor={cop(total)} detalle={`Por defecto ${cop(evento.precioPorPersona)} por persona`} />
        <Resumen
          icon={<Clock size={14} />}
          label="Próxima salida"
          valor={proxima ? horaBonita(proxima.hora) : '—'}
          detalle={proxima ? `${fechaLarga(proxima.fecha)} · ${proxima.turno!.cupos.length}/${proxima.capacidad}` : 'Sin reservas próximas'}
        />
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-neutral-200">
        {([['reservas', 'Reservas por día'], ['config', 'Horario, precios y link']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === k ? 'border-amber-500 text-amber-700 font-medium' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'config' ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
          <EventoCorporativoForm value={form} onChange={setForm} bloquearRuta={totalCupos > 0} />
          <div className="flex justify-between gap-2 pt-3 border-t border-neutral-100">
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5" onClick={() => setBorrarEvento(true)}>
              <Trash2 size={13} /> Eliminar evento
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setForm(aForm(evento))}>Descartar cambios</Button>
              <Button size="sm" className="gap-1.5" onClick={guardar} disabled={saving}>
                <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
              {([['proximos', 'Próximos'], ['pasados', 'Pasados'], ['todos', 'Todos']] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFiltro(k)}
                  className={`px-3 py-1.5 text-xs rounded ${filtro === k ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              Ver o agregar en otro día:
              <Input type="date" value={diaExtra} onChange={(e) => setDiaExtra(e.target.value)} className="h-8 w-40" />
            </label>
          </div>

          {diasVisibles.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white py-14 text-center">
              <p className="text-sm text-neutral-500">
                {filtro === 'pasados' ? 'No hay reservas en fechas pasadas.' : 'Aún no hay reservas próximas.'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">Comparte el link: cada vez que alguien reserve, su día aparece aquí.</p>
            </div>
          ) : (
            diasVisibles.map((d) => (
              <div key={d.fecha} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {fechaLarga(d.fecha)}
                      {d.fecha === hoy && <span className="ml-2 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Hoy</span>}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {d.cupos} cupo{d.cupos !== 1 ? 's' : ''} · {cop(d.total)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs bg-white"
                    disabled={horasActivas.length === 0}
                    onClick={() => setAgregar({ fecha: d.fecha, horarioId: horasActivas[0]?.id ?? '' })}
                  >
                    <UserPlus size={12} /> Agregar pasajero
                  </Button>
                </div>

                {/* Ocupación de cada hora del día */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-3">
                  {d.celdas.map((c) => {
                    const ocupados = c.turno?.cupos.length ?? 0
                    const lleno = ocupados >= c.capacidad
                    return (
                      <div
                        key={c.hora}
                        className={`rounded-md border p-2.5 ${ocupados > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-neutral-200'}`}
                      >
                        <p className="text-sm font-semibold text-neutral-900">{horaBonita(c.hora)}</p>
                        <p className={`text-xs ${lleno ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>
                          {ocupados}/{c.capacidad} cupos
                        </p>
                        <div className="mt-1.5 h-1 rounded-full bg-neutral-100 overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (ocupados / c.capacidad) * 100)}%` }} />
                        </div>
                        {c.turno?.reserva && (
                          <Link
                            href={`/admin/dashboard/reservas/${c.turno.reserva.id}`}
                            className="mt-1.5 block text-[10px] font-mono text-amber-700 hover:underline truncate"
                            title="Reserva de esta salida (asignar conductor)"
                          >
                            {c.turno.reserva.codigo} · {c.turno.reserva.conductor?.nombre ?? 'sin conductor'}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Pasajeros por hora */}
                {d.celdas
                  .filter((c) => c.turno && c.turno.cupos.length > 0)
                  .map((c) => (
                    <div key={c.hora} className="border-t border-neutral-100">
                      <p className="px-4 pt-3 text-xs font-semibold text-neutral-700">
                        {horaBonita(c.hora)} · {c.turno!.cupos.length}/{c.capacidad} · {cop(c.precio)} c/u ·{' '}
                        {cop(c.turno!.cupos.length * c.precio)}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {c.turno!.cupos.map((p, i) => (
                              <tr key={p.id} className="border-b border-neutral-50 last:border-0 align-top">
                                <td className="pl-4 pr-2 py-2 text-xs text-neutral-400 w-6">{i + 1}</td>
                                <td className="px-2 py-2">
                                  <p className="font-medium text-neutral-800">{p.nombre}</p>
                                  {p.notas && <p className="text-[11px] text-neutral-400">{p.notas}</p>}
                                </td>
                                <td className="px-2 py-2 text-xs text-neutral-600">
                                  <p>{p.telefono}</p>
                                  <p className="text-neutral-400">{p.email}</p>
                                </td>
                                <td className="px-2 py-2 text-xs">{p.numeroVuelo ? `Vuelo ${p.numeroVuelo}` : '—'}</td>
                                <td className="pr-4 pl-2 py-2">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs text-neutral-600"
                                      onClick={() => setMover({ cupo: p, fecha: d.fecha, horarioId: c.horarioId ?? horasActivas[0]?.id ?? '' })}
                                    >
                                      <ArrowRightLeft size={12} /> Mover
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-neutral-500 hover:text-red-600" onClick={() => setBorrarCupo(p)}>
                                      <Trash2 size={12} /> Liberar
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Agregar pasajero */}
      <Dialog open={!!agregar} onOpenChange={(o) => !o && setAgregar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar pasajero</DialogTitle>
          </DialogHeader>
          {agregar && (
            <div className="grid gap-3">
              <FechaHora
                fecha={agregar.fecha}
                horarioId={agregar.horarioId}
                horarios={evento.horarios}
                onChange={(fecha, horarioId) => setAgregar({ fecha, horarioId })}
              />
              {([
                ['nombre', 'Nombre *'], ['telefono', 'WhatsApp *'], ['email', 'Correo *'],
                ['numeroVuelo', 'Número de vuelo'], ['notas', 'Notas internas'],
              ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input value={nuevoCupo[k]} onChange={(e) => setNuevoCupo({ ...nuevoCupo, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgregar(null)}>Cancelar</Button>
            <Button onClick={agregarCupo}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mover pasajero */}
      <Dialog open={!!mover} onOpenChange={(o) => !o && setMover(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover a {mover?.cupo.nombre}</DialogTitle>
          </DialogHeader>
          {mover && (
            <FechaHora
              fecha={mover.fecha}
              horarioId={mover.horarioId}
              horarios={evento.horarios}
              onChange={(fecha, horarioId) => setMover({ ...mover, fecha, horarioId })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMover(null)}>Cancelar</Button>
            <Button onClick={confirmarMover}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!borrarCupo} onOpenChange={(o) => !o && setBorrarCupo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Liberar el cupo de {borrarCupo?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>El puesto queda disponible de nuevo en el link.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarCupo} className="bg-red-600 hover:bg-red-700">Liberar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={borrarEvento} onOpenChange={setBorrarEvento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el evento de {evento.empresa}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran su horario, sus {totalCupos} cupos reservados y las reservas de sus salidas. El link deja de funcionar. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarEvento} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Resumen({ icon, label, valor, detalle }: { icon: React.ReactNode; label: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">{icon}{label}</p>
      <p className="text-lg font-semibold text-neutral-900 mt-0.5">{valor}</p>
      <p className="text-[11px] text-neutral-400 truncate">{detalle}</p>
    </div>
  )
}

function FechaHora({
  fecha,
  horarioId,
  horarios,
  onChange,
}: {
  fecha: string
  horarioId: string
  horarios: Horario[]
  onChange: (fecha: string, horarioId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Fecha</Label>
        <Input type="date" value={fecha} onChange={(e) => onChange(e.target.value, horarioId)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hora</Label>
        <select
          value={horarioId}
          onChange={(e) => onChange(fecha, e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {horarios.map((h) => (
            <option key={h.id} value={h.id}>
              {horaBonita(h.hora)}{!h.activo ? ' (oculta)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
