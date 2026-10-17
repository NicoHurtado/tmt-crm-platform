'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, Trash2, UserPlus, Save } from 'lucide-react'
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
import { partesColombia, etiquetaRuta, type AeropuertoCorp, type SentidoCorp } from '@/lib/corporativo-horarios'
import { cop } from '@/components/admin/corporativo/link'
import CompartirLink from '@/components/admin/corporativo/CompartirLink'

interface Cupo {
  id: string
  nombre: string
  email: string
  telefono: string
  documento: string | null
  numeroVuelo: string | null
  notas: string | null
  createdAt: string
}
interface Turno {
  id: string
  fechaHora: string
  capacidad: number
  vehiculo: string | null
  activo: boolean
  precioPorPersona: number | null
  cupos: Cupo[]
  reserva: {
    id: string
    codigo: string
    estado: string
    conductor: { nombre: string } | null
    vehiculo: { nombre: string } | null
  } | null
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
  turnos: Turno[]
}

const TZ = 'America/Bogota'
const fmtTurno = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })

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
  turnos: e.turnos.map((t) => ({
    id: t.id,
    ...partesColombia(t.fechaHora),
    capacidad: t.capacidad,
    vehiculo: t.vehiculo ?? '',
    activo: t.activo,
    precioPorPersona: t.precioPorPersona === null ? '' : String(t.precioPorPersona),
    reservados: t.cupos.length,
  })),
})

const NUEVO_CUPO = { nombre: '', telefono: '', email: '', numeroVuelo: '', notas: '' }

export default function EventoCorporativoDetalle() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [form, setForm] = useState<EventoFormData | null>(null)
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [borrarEvento, setBorrarEvento] = useState(false)
  const [borrarCupo, setBorrarCupo] = useState<Cupo | null>(null)
  const [agregarEn, setAgregarEn] = useState<string | null>(null)
  const [nuevoCupo, setNuevoCupo] = useState(NUEVO_CUPO)

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
    cargar()
  }, [cargar])

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
      setEditando(false)
      await cargar()
    } finally {
      setSaving(false)
    }
  }

  const moverCupo = async (cupoId: string, turnoId: string) => {
    const res = await fetch(`/api/admin/corporativo/cupos/${cupoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnoId }),
    })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo mover')
    toast.success('Pasajero movido')
    cargar()
  }

  const eliminarCupo = async () => {
    if (!borrarCupo) return
    const res = await fetch(`/api/admin/corporativo/cupos/${borrarCupo.id}`, { method: 'DELETE' })
    setBorrarCupo(null)
    if (!res.ok) return toast.error('No se pudo eliminar')
    toast.success('Cupo liberado')
    cargar()
  }

  const agregarCupo = async () => {
    if (!agregarEn) return
    const res = await fetch(`/api/admin/corporativo/${id}/cupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevoCupo, turnoId: agregarEn }),
    })
    const data = await res.json()
    if (!res.ok) return toast.error(data.error || 'No se pudo agregar')
    toast.success('Pasajero agregado')
    setAgregarEn(null)
    setNuevoCupo(NUEVO_CUPO)
    cargar()
  }

  const eliminarEvento = async () => {
    const res = await fetch(`/api/admin/corporativo/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('No se pudo eliminar')
    toast.success('Evento eliminado')
    router.push('/admin/dashboard/corporativo')
  }

  const exportarCSV = () => {
    if (!evento) return
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const filas = [
      ['Salida', 'Vehículo', 'Nombre', 'Vuelo', 'WhatsApp', 'Correo', 'Notas', 'Reservado', 'Valor'],
      ...evento.turnos.flatMap((t) =>
        t.cupos.map((c) => [
          fmtTurno(t.fechaHora), t.vehiculo, c.nombre, c.numeroVuelo, c.telefono, c.email, c.notas,
          new Date(c.createdAt).toLocaleString('es-CO', { timeZone: TZ }), t.precioPorPersona ?? evento.precioPorPersona,
        ]),
      ),
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

  const reservados = evento.turnos.reduce((s, t) => s + t.cupos.length, 0)
  const capacidad = evento.turnos.reduce((s, t) => s + t.capacidad, 0)
  const precioDe = (t: Turno) => t.precioPorPersona ?? evento.precioPorPersona
  const total = evento.turnos.reduce((s, t) => s + t.cupos.length * precioDe(t), 0)

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/dashboard/corporativo" className="text-xs text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Corporativo
          </Link>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 flex items-center gap-2">
            {evento.empresa}
            <Badge variant="outline" className={`text-[10px] ${evento.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500'}`}>
              {evento.activo ? 'Activo' : 'Cerrado'}
            </Badge>
          </h1>
          <p className="text-sm text-neutral-500 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
              {etiquetaRuta(evento.aeropuertoNombre, evento.aeropuertoTipo)}
            </span>
            {evento.origen} → {evento.destino}
          </p>
          {evento.aliado && (
            <Link href="/admin/dashboard/aliados" className="text-xs text-amber-700 hover:underline">
              Perfil: {evento.aliado.nombre} ({evento.aliado.codigo})
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarCSV} disabled={reservados === 0}>
            <Download size={13} /> Exportar pasajeros
          </Button>
        </div>
      </div>

      {evento.aliado && !evento.aliado.corporativoActivo && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          El servicio corporativo de {evento.aliado.nombre} está desactivado: el link no recibe reservas.
          Actívalo en <Link href="/admin/dashboard/aliados" className="underline">Aliados</Link>.
        </p>
      )}

      <CompartirLink codigo={evento.codigo} empresa={evento.empresa} origen={evento.origen} destino={evento.destino} />

      {/* Resumen de facturación */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Cupos reservados', `${reservados} / ${capacidad}`],
          ['Horarios', String(evento.turnos.length)],
          ['Costo por defecto', cop(evento.precioPorPersona)],
          ['Total a facturar', cop(total)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-[11px] text-neutral-500">{k}</p>
            <p className="text-lg font-semibold text-neutral-900">{v}</p>
          </div>
        ))}
      </div>

      {/* Edición */}
      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold">Configuración y horarios</h2>
          {editando ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setForm(aForm(evento)); setEditando(false) }}>Cancelar</Button>
              <Button size="sm" className="gap-1.5" onClick={guardar} disabled={saving}>
                <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>Editar</Button>
          )}
        </div>
        {editando && (
          <div className="p-4">
            <EventoCorporativoForm value={form} onChange={setForm} bloquearRuta={reservados > 0} />
          </div>
        )}
      </div>

      {/* Pasajeros por turno */}
      <div className="space-y-3">
        {evento.turnos.map((t) => {
          const otros = evento.turnos.filter((o) => o.id !== t.id && o.cupos.length < o.capacidad)
          const lleno = t.cupos.length >= t.capacidad
          return (
            <div key={t.id} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{fmtTurno(t.fechaHora)}</p>
                  <span className="text-xs text-neutral-500">{t.vehiculo}</span>
                  <span className="text-xs text-neutral-500">· {cop(precioDe(t))} c/u · {cop(t.cupos.length * precioDe(t))}</span>
                  {!t.activo && <Badge variant="outline" className="text-[10px]">Oculto</Badge>}
                  {t.reserva && (
                    <Link
                      href={`/admin/dashboard/reservas/${t.reserva.id}`}
                      className="text-[11px] font-mono text-amber-700 hover:underline"
                      title="Reserva de esta salida (asignar conductor, estado)"
                    >
                      Reserva {t.reserva.codigo}
                      {t.reserva.conductor ? ` · ${t.reserva.conductor.nombre}` : ' · sin conductor'}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${lleno ? 'text-red-600' : 'text-neutral-600'}`}>
                    {t.cupos.length}/{t.capacidad} puestos
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={lleno} onClick={() => setAgregarEn(t.id)}>
                    <UserPlus size={12} /> Agregar
                  </Button>
                </div>
              </div>
              {t.cupos.length === 0 ? (
                <p className="px-4 py-4 text-xs text-neutral-400">Sin pasajeros todavía</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-neutral-500">
                        <th className="px-4 py-2 font-medium">#</th>
                        <th className="px-2 py-2 font-medium">Nombre</th>
                        <th className="px-2 py-2 font-medium">WhatsApp / correo</th>
                        <th className="px-2 py-2 font-medium">Vuelo</th>
                        <th className="px-2 py-2 font-medium">Notas</th>
                        <th className="px-4 py-2 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.cupos.map((c, i) => (
                        <tr key={c.id} className="border-t border-neutral-100 align-top">
                          <td className="px-4 py-2 text-neutral-400">{i + 1}</td>
                          <td className="px-2 py-2">
                            <p className="font-medium text-neutral-800">{c.nombre}</p>
                          </td>
                          <td className="px-2 py-2 text-xs text-neutral-600">
                            <p>{c.telefono}</p>
                            <p className="text-neutral-400">{c.email}</p>
                          </td>
                          <td className="px-2 py-2 text-xs">{c.numeroVuelo || '—'}</td>
                          <td className="px-2 py-2 text-xs text-neutral-500 max-w-[200px]">{c.notas || '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <select
                                aria-label="Mover a otro horario"
                                className="h-7 rounded border border-neutral-200 bg-white text-xs px-1"
                                value=""
                                disabled={otros.length === 0}
                                onChange={(e) => e.target.value && moverCupo(c.id, e.target.value)}
                              >
                                <option value="">Mover a…</option>
                                {otros.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {fmtTurno(o.fechaHora)} ({o.capacidad - o.cupos.length} libres)
                                  </option>
                                ))}
                              </select>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600" title="Liberar cupo" onClick={() => setBorrarCupo(c)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5" onClick={() => setBorrarEvento(true)}>
          <Trash2 size={13} /> Eliminar evento
        </Button>
      </div>

      <Dialog open={!!agregarEn} onOpenChange={(o) => !o && setAgregarEn(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar pasajero</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {([
              ['nombre', 'Nombre *'], ['numeroVuelo', 'Número de vuelo'], ['telefono', 'WhatsApp *'],
              ['email', 'Correo *'], ['notas', 'Notas internas'],
            ] as const).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input value={nuevoCupo[k]} onChange={(e) => setNuevoCupo({ ...nuevoCupo, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgregarEn(null)}>Cancelar</Button>
            <Button onClick={agregarCupo}>Agregar</Button>
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
              Se borran sus {evento.turnos.length} horarios y {reservados} cupos reservados. El link deja de funcionar. No se puede deshacer.
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
