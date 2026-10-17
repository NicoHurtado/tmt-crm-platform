'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Copy, ExternalLink, Users, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { copiarLink, cop } from '@/components/admin/corporativo/link'
import EventoCorporativoForm, { EVENTO_VACIO, type EventoFormData } from '@/components/admin/corporativo/EventoCorporativoForm'

interface EventoResumen {
  id: string
  codigo: string
  empresa: string
  titulo: string
  activo: boolean
  precioPorPersona: number
  totalTurnos: number
  capacidadTotal: number
  cuposReservados: number
  totalFacturar: number
  primeraSalida: string | null
  aliado: { id: string; nombre: string; codigo: string; corporativoActivo: boolean } | null
}

export default function CorporativoPage() {
  const router = useRouter()
  // Desde Aliados → "Configurar": se filtra por ese aliado y, si aún no tiene evento,
  // se abre directamente el formulario de creación con él escogido.
  const aliadoParam = useSearchParams().get('aliado') ?? ''
  const [eventos, setEventos] = useState<EventoResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EventoFormData>(() => EVENTO_VACIO(aliadoParam))
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    try {
      const res = await fetch(`/api/admin/corporativo${aliadoParam ? `?aliadoId=${aliadoParam}` : ''}`)
      const data = await res.json()
      setEventos(data.data || [])
      if (aliadoParam && (data.data || []).length === 0) {
        setForm(EVENTO_VACIO(aliadoParam))
        setOpen(true)
      }
    } catch {
      toast.error('Error cargando eventos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliadoParam])

  const crear = async () => {
    if (!form.aliadoId) return toast.error('Escoge el aliado')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/corporativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) return toast.error(data.error || 'Error al crear')
      toast.success('Evento creado — comparte el link con la empresa')
      router.push(`/admin/dashboard/corporativo/${data.data.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">Corporativo</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Links de reserva por cupos para empresas. Sin pago en línea: se factura a la empresa.
          </p>
          {aliadoParam && (
            <Link href="/admin/dashboard/corporativo" className="text-xs text-amber-700 hover:underline">
              Filtrando por un aliado · ver todos
            </Link>
          )}
        </div>
        <Button className="gap-1.5 text-sm h-11 sm:h-9 w-full sm:w-auto" onClick={() => { setForm(EVENTO_VACIO(aliadoParam)); setOpen(true) }}>
          <Plus size={14} /> Nuevo evento
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : eventos.length === 0 ? (
        <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
          <p className="text-sm text-neutral-400 mb-3">Aún no hay eventos corporativos</p>
          <Button size="sm" onClick={() => { setForm(EVENTO_VACIO(aliadoParam)); setOpen(true) }} className="gap-1.5">
            <Plus size={14} /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {eventos.map((e) => {
            const pct = e.capacidadTotal ? Math.round((e.cuposReservados / e.capacidadTotal) * 100) : 0
            return (
              <div key={e.id} className="rounded-lg border border-neutral-200 bg-white p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/dashboard/corporativo/${e.id}`} className="min-w-0 group">
                    <p className="font-semibold text-neutral-900 truncate group-hover:underline">{e.empresa}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {e.titulo} · /corporativo/{e.codigo}
                    </p>
                  </Link>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${e.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500'}`}
                  >
                    {e.aliado && !e.aliado.corporativoActivo ? 'Corporativo desactivado' : e.activo ? 'Activo' : 'Cerrado'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                  <span className="flex items-center gap-1"><Clock size={12} /> {e.totalTurnos} horarios
                    {e.primeraSalida && ` · ${new Date(e.primeraSalida).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })}`}
                  </span>
                  <span className="flex items-center gap-1"><Users size={12} /> {e.cuposReservados}/{e.capacidadTotal} cupos</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-neutral-500">A facturar ({cop(e.precioPorPersona)} c/u)</p>
                    <p className="text-base font-semibold text-neutral-900">{cop(e.totalFacturar)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => copiarLink(e.codigo)}>
                      <Copy size={12} /> Copiar link
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Abrir link">
                      <a href={`/corporativo/${e.codigo}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /></a>
                    </Button>
                  </div>
                </div>
                <Link href={`/admin/dashboard/corporativo/${e.id}`} className="text-xs text-amber-700 hover:underline">
                  Ver pasajeros y editar →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo evento corporativo</DialogTitle>
          </DialogHeader>
          <EventoCorporativoForm value={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={crear} disabled={saving}>{saving ? 'Creando…' : 'Crear evento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
