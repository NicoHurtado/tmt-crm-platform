'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AEROPUERTOS,
  SENTIDOS,
  NOMBRES_DIAS,
  generarHorarios,
  ladoCiudad,
  rutaPorDefecto,
  sufijoLink,
  type AeropuertoCorp,
  type SentidoCorp,
} from '@/lib/corporativo-horarios'
import { getLocalizedText } from '@/types/multi-language'

export interface HorarioForm {
  id?: string
  hora: string
  capacidad: number
  vehiculo: string
  activo: boolean
  /** Costo por persona de esta hora; '' = usa el precio por defecto del evento. */
  precioPorPersona: string
}

export interface EventoFormData {
  aliadoId: string
  aeropuertoNombre: AeropuertoCorp
  aeropuertoTipo: SentidoCorp
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
  horarios: HorarioForm[]
  /** 'YYYY-MM-DD' o '' (sin límite). */
  fechaDesde: string
  fechaHasta: string
  diasSemana: number[]
}

const nuevosHorarios = (...args: Parameters<typeof generarHorarios>): HorarioForm[] =>
  generarHorarios(...args).map((h) => ({ ...h, precioPorPersona: '' }))

export const EVENTO_VACIO = (aliadoId = ''): EventoFormData => ({
  aliadoId,
  aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
  aeropuertoTipo: 'DESDE',
  codigo: '',
  empresa: '',
  descripcion: '',
  ...rutaPorDefecto('JOSE_MARIA_CORDOVA', 'DESDE'),
  precioPorPersona: 0,
  servicioId: '',
  contactoNombre: '',
  contactoEmail: '',
  activo: true,
  horarios: nuevosHorarios('14:00', 4, 60, 15),
  fechaDesde: '',
  fechaHasta: '',
  diasSemana: [0, 1, 2, 3, 4, 5, 6],
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

const ordenar = (h: HorarioForm[]) => [...h].sort((a, b) => a.hora.localeCompare(b.hora))

export default function EventoCorporativoForm({
  value,
  onChange,
  bloquearRuta = false,
}: {
  value: EventoFormData
  onChange: (v: EventoFormData) => void
  /** Con cupos ya inscritos no se cambia aeropuerto ni sentido (sería mezclar servicios). */
  bloquearRuta?: boolean
}) {
  const [gen, setGen] = useState({ hora: '14:00', cantidad: 4, intervalo: 60, capacidad: 15 })
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
    if (a) onChange({ ...value, empresa: a.nombre, contactoNombre: a.contacto, contactoEmail: a.email, codigo: value.codigo || linkSugerido(a.nombre) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliados, value.aliadoId])

  const linkSugerido = (nombre: string, aero = value.aeropuertoNombre, sent = value.aeropuertoTipo) =>
    slug(`${nombre}-${sufijoLink(aero, sent)}`)
  const nombreAliado = aliados.find((x) => x.id === value.aliadoId)?.nombre ?? value.empresa

  /** Cambia aeropuerto/sentido y reacomoda origen, destino, título y link (si no los tocaron a mano). */
  const cambiarRuta = (aero: AeropuertoCorp, sent: SentidoCorp) => {
    const anterior = rutaPorDefecto(value.aeropuertoNombre, value.aeropuertoTipo, ladoCiudad(value.aeropuertoTipo, value.origen, value.destino))
    const nueva = rutaPorDefecto(aero, sent, ladoCiudad(value.aeropuertoTipo, value.origen, value.destino))
    const linkAuto = !value.codigo || value.codigo === linkSugerido(nombreAliado)
    onChange({
      ...value,
      aeropuertoNombre: aero,
      aeropuertoTipo: sent,
      origen: nueva.origen,
      destino: nueva.destino,
      titulo: value.titulo === anterior.titulo ? nueva.titulo : value.titulo,
      codigo: linkAuto && nombreAliado ? linkSugerido(nombreAliado, aero, sent) : value.codigo,
    })
  }

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
        codigo: value.codigo || linkSugerido(a.nombre),
      }),
    })
  }

  const set = <K extends keyof EventoFormData>(k: K, v: EventoFormData[K]) => onChange({ ...value, [k]: v })
  const setHorario = (i: number, patch: Partial<HorarioForm>) =>
    set('horarios', value.horarios.map((h, j) => (j === i ? { ...h, ...patch } : h)))

  const agregarHorario = () => {
    const ult = value.horarios[value.horarios.length - 1]
    const base = ult
      ? { ...nuevosHorarios(ult.hora, 2, 60, ult.capacidad)[1], precioPorPersona: ult.precioPorPersona, vehiculo: ult.vehiculo }
      : nuevosHorarios(gen.hora, 1, 60, gen.capacidad)[0]
    set('horarios', [...value.horarios, base])
  }

  /** Reemplaza las horas nuevas (sin guardar); las que ya existen se conservan con sus datos. */
  const aplicarGenerador = () => {
    const generadas = nuevosHorarios(gen.hora, gen.cantidad, gen.intervalo, gen.capacidad)
    const existentes = value.horarios.filter((h) => h.id)
    const nuevas = generadas.filter((g) => !existentes.some((e) => e.hora === g.hora))
    set('horarios', ordenar([...existentes, ...nuevas]))
  }

  const toggleDia = (d: number) =>
    set('diasSemana', value.diasSemana.includes(d) ? value.diasSemana.filter((x) => x !== d) : [...value.diasSemana, d].sort())

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

        <div className="space-y-1.5">
          <Label>Aeropuerto *</Label>
          <select
            value={value.aeropuertoNombre}
            disabled={bloquearRuta}
            onChange={(e) => cambiarRuta(e.target.value as AeropuertoCorp, value.aeropuertoTipo)}
            className={selectCls}
          >
            {(Object.keys(AEROPUERTOS) as AeropuertoCorp[]).map((k) => (
              <option key={k} value={k}>{AEROPUERTOS[k].nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Sentido *</Label>
          <select
            value={value.aeropuertoTipo}
            disabled={bloquearRuta}
            onChange={(e) => cambiarRuta(value.aeropuertoNombre, e.target.value as SentidoCorp)}
            className={selectCls}
          >
            {(Object.keys(SENTIDOS) as SentidoCorp[]).map((k) => (
              <option key={k} value={k}>{SENTIDOS[k].label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-500 sm:col-span-2 -mt-2">
          {bloquearRuta
            ? 'Este link ya tiene cupos: para otro aeropuerto o sentido crea un evento nuevo.'
            : 'Cada combinación de aeropuerto y sentido es un link aparte, para que no se mezclen los servicios.'}
        </p>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Link para compartir</Label>
          <div className="flex items-center rounded-md border border-input overflow-hidden">
            <span className="px-3 text-xs text-neutral-500 bg-neutral-50 h-9 flex items-center border-r border-input whitespace-nowrap">
              {origin.replace(/^https?:\/\//, '')}/corporativo/
            </span>
            <input
              value={value.codigo}
              onChange={(e) => set('codigo', slug(e.target.value))}
              placeholder="lovelytics-jmc-bajada"
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

      {/* Disponibilidad: qué fechas puede escoger el funcionario */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">¿Qué días se puede reservar?</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={value.fechaDesde} onChange={(e) => set('fechaDesde', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={value.fechaHasta} onChange={(e) => set('fechaHasta', e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Días de la semana</Label>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = value.diasSemana.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(d)}
                    aria-pressed={on}
                    className={`h-9 min-w-[44px] px-2 rounded-md border text-xs font-medium transition-colors ${
                      on ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400'
                    }`}
                  >
                    {NOMBRES_DIAS[d]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Vacío = sin límite de fechas. El funcionario solo ve los días marcados, desde hoy en adelante.
        </p>
      </div>

      {/* Horario diario: las mismas horas se repiten cada día disponible */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Horario diario ({value.horarios.length} horas)</h3>
            <p className="text-xs text-neutral-500">Estas horas se repiten todos los días disponibles. Cada hora = un carro.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={agregarHorario}>
            <Plus size={14} /> Agregar hora
          </Button>
        </div>

        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
          <p className="text-xs font-medium text-neutral-600 mb-2">Generar horas automáticamente</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
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
        </div>

        <div className="hidden sm:grid grid-cols-[120px_80px_130px_1fr_auto_auto] gap-2 px-2 text-[11px] font-medium text-neutral-500">
          <span>Hora</span><span>Puestos</span><span>$ por persona</span><span>Vehículo</span><span>Visible</span><span />
        </div>
        <div className="space-y-2">
          {value.horarios.map((h, i) => (
            <div key={h.id ?? `nuevo-${i}`} className="grid grid-cols-2 sm:grid-cols-[120px_80px_130px_1fr_auto_auto] gap-2 items-center rounded-md border border-neutral-200 p-2">
              <Input type="time" value={h.hora} onChange={(e) => setHorario(i, { hora: e.target.value })} className="h-9" aria-label="Hora" />
              <Input
                type="number"
                min={1}
                max={100}
                value={h.capacidad}
                onChange={(e) => setHorario(i, { capacidad: Number(e.target.value) })}
                className="h-9"
                aria-label="Puestos"
              />
              <Input
                type="number"
                min={0}
                step={1000}
                value={h.precioPorPersona}
                onChange={(e) => setHorario(i, { precioPorPersona: e.target.value })}
                placeholder={String(value.precioPorPersona || 0)}
                className="h-9"
                aria-label="Costo por persona de esta hora"
                title="Vacío = usa el costo por defecto"
              />
              <Input value={h.vehiculo} onChange={(e) => setHorario(i, { vehiculo: e.target.value })} className="h-9" placeholder="Vehículo" aria-label="Vehículo" />
              <div className="flex items-center gap-1.5" title="Visible en el link">
                <Switch checked={h.activo} onCheckedChange={(v) => setHorario(i, { activo: v })} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 justify-self-end text-neutral-400 hover:text-red-600"
                title="Quitar hora"
                onClick={() => set('horarios', value.horarios.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500">
          Los cambios de puestos y precio aplican a las salidas que aún no han salido. Las ya realizadas conservan su precio.
        </p>
      </div>
    </div>
  )
}
