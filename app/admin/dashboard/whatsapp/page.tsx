'use client'

// Panel del agente de WhatsApp: seguimiento de conversaciones, cotizaciones y lo que el agente aprende.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, MessageCircle, Bot, UserRound, AlertTriangle, CheckCircle2, XCircle, Pause, Play, ExternalLink, Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

type Atencion = 'bot' | 'equipo' | 'traspaso'

interface Cotizacion {
    id: number
    codigo: string
    telefono: string
    nombre: string
    url: string
    servicio: string
    fecha_servicio: string
    hora: string
    total: number
    estado: string
    modalidad?: string | null
    pagado?: number | null
    saldo?: number | null
    createdAt: string
}

interface Conversacion {
    telefono: string
    nombre: string
    idioma: string
    etapa: string
    atencion: Atencion
    motivoPausa: string | null
    pausaHasta: string | null
    pausaDesde: string | null
    ultimoCliente: string | null
    ultimoBot: string | null
    ultimoEquipo: string | null
    seguimiento: string | null
    ultimoTexto: string
    traspasos: number
    cotizacion: Cotizacion | null
}

interface Conocimiento {
    id: number
    pregunta: string
    respuesta: string
    estado: 'propuesto' | 'aprobado' | 'rechazado'
    origen: string
    createdAt: string
}

interface Kpis {
    conversacionesHoy: number
    atendidasPorBot: number
    traspasosPendientes: number
    cotizacionesHoy: number
    cotizacionesAbiertas: number
    pagadas: number
    ventasPagadas: number
    conocimientoPorAprobar: number
}

interface Mensaje { rol: string; texto: string; fecha: string }

const ETIQUETA_ROL: Record<string, string> = { user: 'Cliente', equipo: 'Equipo TMT', nota: 'Nota interna (el cliente no la ve)', assistant: 'Asistente' }
const ESTILO_ROL: Record<string, string> = {
    user: 'bg-gray-100 text-gray-900',
    equipo: 'bg-blue-50 text-blue-900 border border-blue-100',
    nota: 'bg-amber-50 text-amber-900 border border-dashed border-amber-300',
    assistant: 'bg-emerald-50 text-emerald-900 border border-emerald-100',
}

const MOTIVOS: Record<string, string> = {
    equipo_en_chat: 'El equipo está escribiendo',
    equipo_manual: 'Pausado por el equipo',
    contacto_operativo: 'Contacto operativo (el asistente no responde)',
    incidente: 'Incidente',
    reclamo: 'Reclamo',
    pide_persona: 'Pidió un asesor',
    reserva_existente: 'Reserva existente',
    urgente: 'Urgente',
    grupo_empresa: 'Grupo o empresa',
    verificar_transferencia: 'Verificar transferencia',
    sin_decidir: 'Sin decidir',
    consulta: 'Consulta',
    descuento: 'Pide descuento',
    falla_sistema: 'Falla del sistema',
    falta_conductor: 'Falta conductor',
    servicio_proximo: 'Servicio próximo sin pago',
    sin_respuesta: 'Sin respuesta del equipo',
}

const ESTADOS_COT: Record<string, { label: string; className: string }> = {
    enviada: { label: 'Esperando pago', className: 'bg-amber-100 text-amber-800' },
    enviada_alertada: { label: 'Sin pago · servicio próximo', className: 'bg-red-100 text-red-700' },
    pagada_sin_conductor: { label: 'Pagada · falta conductor', className: 'bg-red-100 text-red-700' },
    reemplazada: { label: 'Reemplazada', className: 'bg-gray-100 text-gray-600' },
    pagada: { label: 'Pagada', className: 'bg-emerald-100 text-emerald-800' },
    conductor_enviado: { label: 'Conductor enviado', className: 'bg-emerald-100 text-emerald-800' },
    finalizada: { label: 'Finalizada', className: 'bg-gray-100 text-gray-600' },
    cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
    vencida: { label: 'Vencida sin pago', className: 'bg-gray-100 text-gray-600' },
}

function cop(n?: number | null) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
}

function hace(iso?: string | null) {
    if (!iso) return '—'
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 1) return 'ahora'
    if (min < 60) return `hace ${min} min`
    const h = Math.round(min / 60)
    if (h < 24) return `hace ${h} h`
    return `hace ${Math.round(h / 24)} d`
}

function fechaHora(iso?: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function mostrarTel(t: string) {
    return /^\d{8,15}$/.test(t) ? `+${t}` : t
}

async function llamar(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }))
    if (!data.ok) throw new Error(data.error || 'Error')
    return data
}

function AtencionBadge({ c }: { c: Conversacion }) {
    if (c.atencion === 'traspaso') {
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><AlertTriangle className="h-3 w-3" />Requiere atención · {MOTIVOS[c.motivoPausa || ''] || c.motivoPausa}</Badge>
    }
    if (c.atencion === 'equipo') {
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1"><UserRound className="h-3 w-3" />{MOTIVOS[c.motivoPausa || ''] || 'Equipo'}</Badge>
    }
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1"><Bot className="h-3 w-3" />Atiende el asistente</Badge>
}

export default function WhatsAppPanelPage() {
    const [cargando, setCargando] = useState(true)
    const [kpis, setKpis] = useState<Kpis | null>(null)
    const [convs, setConvs] = useState<Conversacion[]>([])
    const [cots, setCots] = useState<Cotizacion[]>([])
    const [saber, setSaber] = useState<Conocimiento[]>([])
    const [tab, setTab] = useState<'conversaciones' | 'cotizaciones' | 'aprendizaje'>('conversaciones')
    const [filtro, setFiltro] = useState<'todas' | Atencion>('todas')
    const [busqueda, setBusqueda] = useState('')
    const [chat, setChat] = useState<{ conv: Conversacion; mensajes: Mensaje[] | null } | null>(null)
    const [editando, setEditando] = useState<Conocimiento | null>(null)
    const [nueva, setNueva] = useState({ pregunta: '', respuesta: '' })
    const [ocupado, setOcupado] = useState<string | null>(null)
    const [nota, setNota] = useState('')

    const cargar = useCallback(async () => {
        try {
            const d = await llamar({ accion: 'resumen' })
            setKpis(d.kpis)
            setConvs(d.conversaciones || [])
            setCots(d.cotizaciones || [])
            setSaber(d.conocimiento || [])
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCargando(false)
        }
    }, [])

    useEffect(() => {
        cargar()
        const t = setInterval(cargar, 60_000)
        return () => clearInterval(t)
    }, [cargar])

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        return convs
            .filter(c => filtro === 'todas' || c.atencion === filtro)
            .filter(c => !q || c.nombre.toLowerCase().includes(q) || c.telefono.includes(q) || c.ultimoTexto.toLowerCase().includes(q))
    }, [convs, filtro, busqueda])

    async function accion(clave: string, body: Record<string, unknown>, ok: string) {
        setOcupado(clave)
        try {
            await llamar(body)
            toast.success(ok)
            await cargar()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setOcupado(null)
        }
    }

    async function abrirChat(conv: Conversacion) {
        setChat({ conv, mensajes: null })
        try {
            const d = await llamar({ accion: 'mensajes', telefono: conv.telefono })
            setChat({ conv, mensajes: d.mensajes || [] })
        } catch (e) {
            toast.error((e as Error).message)
            setChat(null)
        }
    }

    const propuestas = saber.filter(k => k.estado === 'propuesto')
    const aprobadas = saber.filter(k => k.estado === 'aprobado')

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><MessageCircle className="h-6 w-6 text-emerald-600" />Agente de WhatsApp</h1>
                    <p className="text-sm text-gray-500">Conversaciones del 317 517 7409, cotizaciones del asistente y lo que va aprendiendo. Se actualiza cada minuto.</p>
                </div>
                <Button variant="outline" onClick={() => { setCargando(true); cargar() }} disabled={cargando}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${cargando ? 'animate-spin' : ''}`} />Actualizar
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    ['Conversaciones hoy', kpis?.conversacionesHoy, `${kpis?.atendidasPorBot ?? 0} atendidas por el asistente`],
                    ['Requieren atención', kpis?.traspasosPendientes, 'Avisos sin respuesta del equipo'],
                    ['Cotizaciones abiertas', kpis?.cotizacionesAbiertas, `${kpis?.cotizacionesHoy ?? 0} creadas hoy`],
                    ['Reservas pagadas', kpis?.pagadas, `${cop(kpis?.ventasPagadas)} recibidos`],
                ].map(([titulo, valor, detalle]) => (
                    <div key={titulo as string} className={`rounded-xl border bg-white p-4 ${titulo === 'Requieren atención' && Number(valor) > 0 ? 'border-red-300' : 'border-gray-200'}`}>
                        <p className="text-xs font-medium text-gray-500">{titulo}</p>
                        {cargando && !kpis ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold text-gray-900 mt-1">{valor ?? 0}</p>}
                        <p className="text-xs text-gray-500 mt-1">{detalle}</p>
                    </div>
                ))}
            </div>

            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
                {([
                    ['conversaciones', 'Conversaciones'],
                    ['cotizaciones', 'Cotizaciones'],
                    ['aprendizaje', `Aprendizaje${propuestas.length ? ` (${propuestas.length} por revisar)` : ''}`],
                ] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'conversaciones' && (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        {([['todas', 'Todas'], ['traspaso', 'Requieren atención'], ['equipo', 'Las lleva el equipo'], ['bot', 'Las lleva el asistente']] as const).map(([k, label]) => (
                            <Button key={k} size="sm" variant={filtro === k ? 'default' : 'outline'} onClick={() => setFiltro(k)}>{label}</Button>
                        ))}
                        <Input placeholder="Buscar por nombre, número o texto" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="max-w-xs ml-auto" />
                    </div>
                    {cargando && !convs.length ? (
                        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
                    ) : visibles.length === 0 ? (
                        <p className="text-sm text-gray-500 py-8 text-center">No hay conversaciones con este filtro.</p>
                    ) : (
                        <div className="space-y-2">
                            {visibles.map(c => (
                                <div key={c.telefono} className={`rounded-xl border bg-white p-4 flex flex-col md:flex-row md:items-center gap-3 ${c.atencion === 'traspaso' ? 'border-red-300' : 'border-gray-200'}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-gray-900">{c.nombre || 'Sin nombre'}</span>
                                            <span className="text-xs text-gray-500">{mostrarTel(c.telefono)}</span>
                                            <AtencionBadge c={c} />
                                            {c.cotizacion && (
                                                <Badge className={`${ESTADOS_COT[c.cotizacion.estado]?.className || 'bg-gray-100 text-gray-600'} hover:opacity-90`}>
                                                    Cotización {ESTADOS_COT[c.cotizacion.estado]?.label || c.cotizacion.estado} · {cop(c.cotizacion.total)}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1 truncate">“{c.ultimoTexto || '…'}”</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Último mensaje del cliente {hace(c.ultimoCliente)}
                                            {c.seguimiento ? ` · seguimiento enviado ${hace(c.seguimiento)}` : ''}
                                            {c.traspasos ? ` · ${c.traspasos} traspaso(s)` : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => abrirChat(c)}>Ver chat</Button>
                                        {/^\d{8,15}$/.test(c.telefono) && (
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={`https://wa.me/${c.telefono}`} target="_blank" rel="noreferrer">WhatsApp <ExternalLink className="h-3 w-3 ml-1" /></a>
                                            </Button>
                                        )}
                                        {c.atencion === 'bot' ? (
                                            <Button size="sm" variant="outline" disabled={ocupado === c.telefono}
                                                onClick={() => accion(c.telefono, { accion: 'pausar', telefono: c.telefono }, 'El asistente queda en pausa 24 h en este chat')}>
                                                <Pause className="h-3 w-3 mr-1" />Pausar asistente
                                            </Button>
                                        ) : c.atencion === 'traspaso' && !c.pausaHasta ? (
                                            <Button size="sm" disabled={ocupado === c.telefono}
                                                onClick={() => accion(c.telefono, { accion: 'devolver', telefono: c.telefono }, 'Aviso marcado como atendido')}>
                                                <Play className="h-3 w-3 mr-1" />Marcar atendido
                                            </Button>
                                        ) : (
                                            <Button size="sm" disabled={ocupado === c.telefono}
                                                onClick={() => accion(c.telefono, { accion: 'devolver', telefono: c.telefono }, 'El asistente retoma este chat')}>
                                                <Play className="h-3 w-3 mr-1" />Devolver al asistente
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'cotizaciones' && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="text-left px-4 py-3">Cliente</th>
                                <th className="text-left px-4 py-3">Servicio</th>
                                <th className="text-left px-4 py-3">Fecha</th>
                                <th className="text-right px-4 py-3">Total</th>
                                <th className="text-left px-4 py-3">Estado</th>
                                <th className="text-right px-4 py-3">Pagado / saldo</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cots.length === 0 && (
                                <tr><td colSpan={7} className="text-center text-gray-500 py-8">Todavía no hay cotizaciones del asistente.</td></tr>
                            )}
                            {cots.map(k => (
                                <tr key={k.codigo} className="border-t border-gray-100">
                                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{k.nombre || 'Sin nombre'}</div><div className="text-xs text-gray-500">{mostrarTel(k.telefono)}</div></td>
                                    <td className="px-4 py-3">{k.servicio}<div className="text-xs text-gray-500 font-mono">{k.codigo}</div></td>
                                    <td className="px-4 py-3 whitespace-nowrap">{k.fecha_servicio} {k.hora}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">{cop(k.total)}</td>
                                    <td className="px-4 py-3"><Badge className={`${ESTADOS_COT[k.estado]?.className || 'bg-gray-100 text-gray-600'} hover:opacity-90`}>{ESTADOS_COT[k.estado]?.label || k.estado}</Badge>
                                        {k.modalidad === 'ANTICIPO_30' && <div className="text-xs text-gray-500 mt-1">Anticipo 30 %</div>}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">{k.pagado ? cop(k.pagado) : '—'}{k.saldo ? <div className="text-xs text-amber-700">Saldo {cop(k.saldo)}</div> : null}</td>
                                    <td className="px-4 py-3 text-right"><a className="text-emerald-700 hover:underline inline-flex items-center gap-1" href={k.url} target="_blank" rel="noreferrer">Ver <ExternalLink className="h-3 w-3" /></a></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'aprendizaje' && (
                <div className="space-y-6">
                    <p className="text-sm text-gray-600">
                        Cada noche el asistente revisa las conversaciones en las que respondió una persona del equipo y propone respuestas reutilizables.
                        Las que apruebe aquí las empieza a usar de inmediato. Revise que sean correctas y generales: nada de datos de un cliente en particular.
                    </p>

                    <section className="space-y-2">
                        <h2 className="font-semibold text-gray-900">Por revisar ({propuestas.length})</h2>
                        {propuestas.length === 0 && <p className="text-sm text-gray-500">No hay propuestas pendientes.</p>}
                        {propuestas.map(k => (
                            <div key={k.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
                                <p className="font-medium text-gray-900">{k.pregunta}</p>
                                <p className="text-sm text-gray-700">{k.respuesta}</p>
                                <p className="text-xs text-gray-400">{k.origen} · {fechaHora(k.createdAt)}</p>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => accion(`k${k.id}`, { accion: 'conocimiento_estado', id: k.id, estado: 'aprobado' }, 'Aprobada: el asistente ya la usa')} disabled={ocupado === `k${k.id}`}><CheckCircle2 className="h-3 w-3 mr-1" />Aprobar</Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditando(k)}><Pencil className="h-3 w-3 mr-1" />Editar y aprobar</Button>
                                    <Button size="sm" variant="outline" onClick={() => accion(`k${k.id}`, { accion: 'conocimiento_estado', id: k.id, estado: 'rechazado' }, 'Descartada')} disabled={ocupado === `k${k.id}`}><XCircle className="h-3 w-3 mr-1" />Descartar</Button>
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-semibold text-gray-900">Agregar una respuesta</h2>
                        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                            <Input placeholder="Pregunta del cliente. Ej.: ¿Tienen sillas para bebé?" value={nueva.pregunta} onChange={e => setNueva({ ...nueva, pregunta: e.target.value })} />
                            <Textarea placeholder="Respuesta que debe dar el asistente" value={nueva.respuesta} onChange={e => setNueva({ ...nueva, respuesta: e.target.value })} rows={3} />
                            <Button size="sm" disabled={ocupado === 'nueva' || nueva.pregunta.trim().length < 3 || nueva.respuesta.trim().length < 2}
                                onClick={async () => { await accion('nueva', { accion: 'conocimiento_agregar', ...nueva }, 'Agregada: el asistente ya la usa'); setNueva({ pregunta: '', respuesta: '' }) }}>
                                <Plus className="h-3 w-3 mr-1" />Agregar
                            </Button>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-semibold text-gray-900">Respuestas que usa el asistente ({aprobadas.length})</h2>
                        {aprobadas.length === 0 && <p className="text-sm text-gray-500">Todavía no hay respuestas aprobadas.</p>}
                        {aprobadas.map(k => (
                            <div key={k.id} className="rounded-xl border border-gray-200 bg-white p-4 flex gap-3">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{k.pregunta}</p>
                                    <p className="text-sm text-gray-700">{k.respuesta}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button size="icon" variant="ghost" onClick={() => setEditando(k)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => accion(`k${k.id}`, { accion: 'conocimiento_borrar', id: k.id }, 'Eliminada')} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>
            )}

            <Dialog open={!!chat} onOpenChange={o => !o && setChat(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{chat?.conv.nombre || 'Sin nombre'} · {chat ? mostrarTel(chat.conv.telefono) : ''}</DialogTitle>
                    </DialogHeader>
                    {!chat?.mensajes ? (
                        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : chat.mensajes.length === 0 ? (
                        <p className="text-sm text-gray-500">Sin mensajes guardados.</p>
                    ) : (
                        <div className="space-y-2">
                            {chat.mensajes.map((m, i) => (
                                <div key={i} className={`flex ${m.rol === 'user' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${ESTILO_ROL[m.rol] || ESTILO_ROL.assistant}`}>
                                        <p className="text-[11px] font-semibold opacity-70 mb-0.5">{ETIQUETA_ROL[m.rol] || 'Asistente'} · {fechaHora(m.fecha)}</p>
                                        {m.texto}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {chat && (
                        <div className="border-t border-gray-200 pt-3 mt-2 space-y-2">
                            <p className="text-sm font-medium text-gray-900">Nota para el asistente</p>
                            <p className="text-xs text-gray-500">El cliente no la ve. El asistente la sigue en sus próximas respuestas de este chat. Ej.: «Le dimos 10 % de descuento; pídale los datos y avísenos para enviarle el enlace».</p>
                            <Textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Escriba la instrucción" />
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" disabled={nota.trim().length < 2 || ocupado === 'nota'} onClick={async () => {
                                    const c = chat.conv
                                    await accion('nota', { accion: 'nota', telefono: c.telefono, texto: nota.trim() }, 'Nota guardada')
                                    setNota('')
                                    abrirChat(c)
                                }}>Guardar nota</Button>
                                {chat.conv.motivoPausa !== 'contacto_operativo' && (
                                    <Button size="sm" variant="outline" disabled={ocupado === chat.conv.telefono} onClick={async () => {
                                        await accion(chat.conv.telefono, { accion: 'ignorar', telefono: chat.conv.telefono }, 'Marcado como contacto operativo: el asistente no le responderá')
                                        setChat(null)
                                    }}>Es conductor, guía o aliado (no responder)</Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!editando} onOpenChange={o => !o && setEditando(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Editar respuesta</DialogTitle></DialogHeader>
                    {editando && (
                        <div className="space-y-2">
                            <Input value={editando.pregunta} onChange={e => setEditando({ ...editando, pregunta: e.target.value })} />
                            <Textarea value={editando.respuesta} onChange={e => setEditando({ ...editando, respuesta: e.target.value })} rows={4} />
                            <Button onClick={async () => {
                                await accion(`k${editando.id}`, { accion: 'conocimiento_estado', id: editando.id, estado: 'aprobado', pregunta: editando.pregunta, respuesta: editando.respuesta }, 'Guardada y aprobada')
                                setEditando(null)
                            }}>Guardar y aprobar</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
