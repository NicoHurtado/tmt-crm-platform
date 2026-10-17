'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { generarTurnos, mananaColombia } from '@/lib/corporativo-horarios'
import { getLocalizedText } from '@/types/multi-language'

export interface TurnoForm {
  id?: string
  fecha: string
  hora: string
  capacidad: number
  vehiculo: string
  activo: boolean
  /** Costo por persona de esta hora; '' = usa el precio por defecto del evento. */
  precioPorPersona: string
  /** Solo lectura: cupos ya reservados (limita borrar / bajar capacidad). */
  reservados?: number
}

export interface EventoFormData {
  aliadoId: string
  codigo: string
  empresa: string
  titulo: string
  descripcion: string
  origen: string
  destino: string
  precioPorPersona: number
  servicioId: string
  contactoNombre: string
  contactoEmail: string
  activo: boolean
  turnos: TurnoForm[]
}

const nuevosTurnos = (...args: Parameters<typeof generarTurnos>): TurnoForm[] =>
  generarTurnos(...args).map((t) => ({ ...t, precioPorPersona: '' }))

export const EVENTO_VACIO = (aliadoId = ''): EventoFormData => ({
  aliadoId,
  codigo: '',
  empresa: '',
  titulo: 'Traslado Aeropuerto → Medellín',
  descripcion: '',
  origen: 'Aeropuerto José María Córdova',
  destino: 'Medellín',
  precioPorPersona: 0,
  servicioId: '',
  contactoNombre: '',
  contactoEmail: '',
  activo: true,
  turnos: nuevosTurnos(mananaColombia(), '14:00', 4, 60, 14),
})

interface AliadoPerfil {
  id: string
  nombre: string
  contacto: string
  email: string
  corporativoActivo?: boolean
}
interface ServicioOpcion {
  id: string
  nombre: unknown
  esAeropuerto?: boolean
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const ordenar = (t: TurnoForm[]) =>
  [...t].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))

export default function EventoCorporativoForm({
  value,
  onChange,
}: {
  value: EventoFormData
  onChange: (v: EventoFormData) => void
}) {
  const [gen, setGen] = useState({ fecha: value.turnos[0]?.fecha || mananaColombia(), hora: '14:00', cantidad: 4, intervalo: 60, capacidad: 14 })
  const [aliados, setAliados] = useState<AliadoPerfil[]>([])
  const [servicios, setServicios] = useState<ServicioOpcion[]>([])
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/aliados')
      .then((r) => r.json())
      .then((d) => setAliados(d.data || []))
      .catch(() => {})
    fetch('/api/servicios')
      .then((r) => r.json())
      .then((d) => setServicios(d.data || []))
      .catch(() => {})
  }, [])

  // Al crear para un aliado que ya viene elegido (desde Aliados → Configurar), se llenan sus datos.
  useEffect(() => {
    if (!value.aliadoId || value.empresa) return
    const a = aliados.find((x) => x.id === value.aliadoId)
    if (a) onChange({ ...value, empresa: a.nombre, contactoNombre: a.contacto, contactoEmail: a.email, codigo: value.codigo || slug(a.nombre) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliados, value.aliadoId])

  const elegibles = aliados.filter((a) => a.corporativoActivo || a.id === value.aliadoId)

  const elegirAliado = (aliadoId: string) => {
    const a = aliados.find((x) => x.id === aliadoId)
    onChange({
      ...value,
      aliadoId,
      ...(a && {
        empresa: a.nombre,
        contactoNombre: a.contacto,
        contactoEmail: a.email,
        codigo: value.codigo || slug(a.nombre),
      }),
    })
  }

  const set = <K extends keyof EventoFormData>(k: K, v: EventoFormData[K]) => onChange({ ...value, [k]: v })
  const setTurno = (i: number, patch: Partial<TurnoForm>) =>
    set('turnos', value.turnos.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  const agregarTurno = () => {
    const ult = value.turnos[value.turnos.length - 1]
    const base = ult
      ? { ...nuevosTurnos(ult.fecha, ult.hora, 2, 60, ult.capacidad)[1], precioPorPersona: ult.precioPorPersona }
      : nuevosTurnos(gen.fecha, gen.hora, 1, 60, 14)[0]
    set('turnos', [...value.turnos, base])
  }

  const aplicarGenerador = () => {
    const conCupos = value.turnos.filter((t) => (t.reservados ?? 0) > 0)
    set('turnos', ordenar([...conCupos, ...nuevosTurnos(gen.fecha, gen.hora, gen.cantidad, gen.intervalo, gen.capacidad)]))
  }

  const selectCls = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Aliado (empresa) *</Label>
          <select value={value.aliadoId} onChange={(e) => elegirAliado(e.target.value)} className={selectCls}>
            <option value="">Escoge el aliado…</option>
            {elegibles.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            Solo aparecen los aliados con <strong>Corporativo (cupos)</strong> activo. Se activa desde la tabla de Aliados.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Link para compartir</Label>
          <div className="flex items-center rounded-md border border-input overflow-hidden">
            <span className="px-3 text-xs text-neutral-500 bg-neutral-50 h-9 flex items-center border-r border-input whitespace-nowrap">
              {origin.replace(/^https?:\/\//, '')}/corporativo/
            </span>
            <input
              value={value.codigo}
              onChange={(e) => set('codigo', slug(e.target.value))}
              placeholder="lovelytics"
              className="h-9 flex-1 min-w-0 px-2 text-sm outline-none bg-transparent"
              aria-label="Nombre del link"
            />
          </div>
          <p className="text-xs text-neutral-500">Corto y fácil de dictar. Solo letras, números y guiones.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Nombre visible de la empresa</Label>
          <Input value={value.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Ej. Lovelytics" />
        </div>
        <div className="space-y-1.5">
          <Label>Título del link</Label>
          <Input value={value.titulo} onChange={(e) => set('titulo', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Origen</Label>
          <Input value={value.origen} onChange={(e) => set('origen', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Destino</Label>
          <Input value={value.destino} onChange={(e) => set('destino', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Costo por persona por defecto (COP)</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={value.precioPorPersona}
            onChange={(e) => set('precioPorPersona', Number(e.target.value))}
          />
          <p className="text-xs text-neutral-500">Se usa en las horas sin precio propio. Se factura a la empresa; el funcionario no lo ve.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Servicio de las reservas</Label>
          <select value={value.servicioId} onChange={(e) => set('servicioId', e.target.value)} className={selectCls}>
            <option value="">Automático (traslado de aeropuerto)</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>{getLocalizedText(s.nombre as any, 'ES')}</option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">Cada hora crea una reserva con este servicio en Reservas.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Contacto en la empresa</Label>
          <Input value={value.contactoNombre} onChange={(e) => set('contactoNombre', e.target.value)} placeholder="Nombre" />
        </div>
        <div className="space-y-1.5">
          <Label>Email del contacto (facturación)</Label>
          <Input type="email" value={value.contactoEmail} onChange={(e) => set('contactoEmail', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Instrucciones para los funcionarios</Label>
          <Textarea
            rows={3}
            value={value.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Ej. Punto de encuentro: salida nacional, puerta 3. Busca el letrero con el logo de la empresa."
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Link abierto</p>
            <p className="text-xs text-neutral-500">Si lo apagas, nadie más puede reservar (las reservas hechas se conservan).</p>
          </div>
          <Switch checked={value.activo} onCheckedChange={(v) => set('activo', v)} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Horarios de salida ({value.turnos.length})</h3>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={agregarTurno}>
            <Plus size={14} /> Agregar horario
          </Button>
        </div>

        {/* Generador rápido: N carros cada X minutos */}
        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="text-xs font-medium text-neutral-600 mb-2">Generar horarios automáticamente</p>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={gen.fecha} onChange={(e) => setGen({ ...gen, fecha: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Primera salida</Label>
              <Input type="time" value={gen.hora} onChange={(e) => setGen({ ...gen, hora: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" min={1} max={24} value={gen.cantidad} onChange={(e) => setGen({ ...gen, cantidad: Number(e.target.value) })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cada (min)</Label>
              <Input type="number" min={5} step={5} value={gen.intervalo} onChange={(e) => setGen({ ...gen, intervalo: Number(e.target.value) })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puestos</Label>
              <Input type="number" min={1} max={100} value={gen.capacidad} onChange={(e) => setGen({ ...gen, capacidad: Number(e.target.value) })} className="h-9" />
            </div>
            <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5 col-span-2 sm:col-span-1" onClick={aplicarGenerador}>
              <Wand2 size={14} /> Generar
            </Button>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">Reemplaza los horarios sin reservas; los que ya tienen cupos se conservan.</p>
        </div>

        <div className="hidden sm:grid grid-cols-[150px_120px_70px_120px_1fr_auto_auto] gap-2 px-2 text-[11px] font-medium text-neutral-500">
          <span>Fecha</span><span>Hora</span><span>Puestos</span><span>$ por persona</span><span>Vehículo</span><span>Visible</span><span />
        </div>
        <div className="space-y-2">
          {value.turnos.map((t, i) => {
            const reservados = t.reservados ?? 0
            return (
              <div key={t.id ?? `nuevo-${i}`} className="grid grid-cols-2 sm:grid-cols-[150px_120px_70px_120px_1fr_auto_auto] gap-2 items-center rounded-md border border-neutral-200 p-2">
                <Input type="date" value={t.fecha} onChange={(e) => setTurno(i, { fecha: e.target.value })} className="h-9" aria-label="Fecha" />
                <Input type="time" value={t.hora} onChange={(e) => setTurno(i, { hora: e.target.value })} className="h-9" aria-label="Hora" />
                <Input
                  type="number"
                  min={Math.max(1, reservados)}
                  max={100}
                  value={t.capacidad}
                  onChange={(e) => setTurno(i, { capacidad: Number(e.target.value) })}
                  className="h-9"
                  aria-label="Puestos"
                />
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={t.precioPorPersona}
                  onChange={(e) => setTurno(i, { precioPorPersona: e.target.value })}
                  placeholder={String(value.precioPorPersona || 0)}
                  className="h-9"
                  aria-label="Costo por persona de esta hora"
                  title="Vacío = usa el costo por defecto"
                />
                <Input value={t.vehiculo} onChange={(e) => setTurno(i, { vehiculo: e.target.value })} className="h-9" placeholder="Vehículo" aria-label="Vehículo" />
                <div className="flex items-center gap-1.5 text-xs text-neutral-500" title="Visible en el link">
                  <Switch checked={t.activo} onCheckedChange={(v) => setTurno(i, { activo: v })} />
                  {reservados > 0 && <span className="whitespace-nowrap">{reservados} res.</span>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 justify-self-end text-neutral-400 hover:text-red-600"
                  disabled={reservados > 0}
                  title={reservados > 0 ? 'Tiene cupos reservados: muévelos o elimínalos primero' : 'Quitar horario'}
                  onClick={() => set('turnos', value.turnos.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
