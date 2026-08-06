'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, ToggleLeft, ToggleRight, Pencil, MapPin, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getLocalizedText } from '@/types/multi-language'
import { categoriaDeServicio } from '@/lib/servicio-categoria'
import MunicipalServicesGroup from './MunicipalServicesGroup'

interface MunicipioConfig {
  id: string
  nombreES: string
  nombreEN: string
  recargo: number
  activo: boolean
  orden: number
}

interface Servicio {
  id: string
  nombre: string
  descripcion: string
  imagen: string
  activo: boolean
  esAeropuerto: boolean
  esPorHoras: boolean
  esCompartido: boolean
  esMunicipal: boolean
  esTraslado: boolean
  tipoTarifa?: 'POR_PERSONA' | null
  preciosPorPersona?: { p1: number; p2: number; p3: number } | null
  destinoAutoFill: string | null
  camposPersonalizados: any[]
  vehiculosPermitidos: { id: string; precio: number; vehiculo: { id: string; nombre: string } }[]
  _count: { reservas: number }
}


export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activoFilter, setActivoFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState<'todos' | 'aeropuerto' | 'tours' | 'compartidos' | 'traslados' | 'otros'>('todos')
  const [tab, setTab] = useState<'servicios' | 'municipal' | 'ubicaciones'>('servicios')

  // Municipios config state
  const [municipios, setMunicipios] = useState<MunicipioConfig[]>([])
  const [municipiosLoading, setMunicipiosLoading] = useState(false)
  const [municipioDialogOpen, setMunicipioDialogOpen] = useState(false)
  const [editingMunicipio, setEditingMunicipio] = useState<MunicipioConfig | null>(null)
  const [municipioForm, setMunicipioForm] = useState({ nombreES: '', nombreEN: '', recargo: '', activo: true })
  const [municipioSaving, setMunicipioSaving] = useState(false)

  // DnD sensors for municipio reorder
  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleMunicipioDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = municipios.findIndex((m) => m.id === active.id)
    const newIndex = municipios.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(municipios, oldIndex, newIndex)
    setMunicipios(reordered)

    try {
      await fetch('/api/admin/municipios/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((m) => m.id) }),
      })
    } catch (e) {
      console.error('Error saving municipio order:', e)
    }
  }, [municipios])

  useEffect(() => {
    const fetchServicios = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (activoFilter !== 'ALL') params.append('activo', activoFilter)
        params.append('limit', '1000')
        const res = await fetch(`/api/admin/servicios?${params.toString()}`)
        const data = await res.json()
        if (data.success) setServicios(data.data)
      } catch (error) {
        console.error('Error fetching services:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchServicios()
  }, [search, activoFilter])

  const fetchMunicipios = async () => {
    setMunicipiosLoading(true)
    try {
      const res = await fetch('/api/admin/municipios')
      const data = await res.json()
      if (data.success) setMunicipios(data.data)
    } catch (e) {
      console.error('Error fetching municipios:', e)
    } finally {
      setMunicipiosLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'ubicaciones') fetchMunicipios()
  }, [tab])

  const openCreateMunicipio = () => {
    setEditingMunicipio(null)
    setMunicipioForm({ nombreES: '', nombreEN: '', recargo: '', activo: true })
    setMunicipioDialogOpen(true)
  }

  const openEditMunicipio = (m: MunicipioConfig) => {
    setEditingMunicipio(m)
    setMunicipioForm({ nombreES: m.nombreES, nombreEN: m.nombreEN, recargo: String(m.recargo), activo: m.activo })
    setMunicipioDialogOpen(true)
  }

  const handleSaveMunicipio = async () => {
    setMunicipioSaving(true)
    try {
      const payload = {
        nombreES: municipioForm.nombreES,
        nombreEN: municipioForm.nombreEN,
        recargo: parseFloat(municipioForm.recargo) || 0,
        activo: municipioForm.activo,
      }
      if (editingMunicipio) {
        const res = await fetch(`/api/admin/municipios/${editingMunicipio.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          setMunicipios((prev) => prev.map((m) => (m.id === editingMunicipio.id ? data.data : m)))
          setMunicipioDialogOpen(false)
        }
      } else {
        const res = await fetch('/api/admin/municipios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          setMunicipios((prev) => [...prev, data.data].sort((a, b) => a.nombreES.localeCompare(b.nombreES)))
          setMunicipioDialogOpen(false)
        }
      }
    } catch (e) {
      console.error('Error saving municipio:', e)
    } finally {
      setMunicipioSaving(false)
    }
  }

  const handleDeleteMunicipio = async (m: MunicipioConfig) => {
    if (!confirm(`¿Eliminar "${m.nombreES}"?`)) return
    try {
      const res = await fetch(`/api/admin/municipios/${m.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) setMunicipios((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e) {
      console.error('Error deleting municipio:', e)
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/servicios/${id}/toggle`, { method: 'PATCH' })
      const data = await res.json()
      if (data.success) {
        setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, activo: data.data.activo } : s)))
      }
    } catch (error) {
      console.error('Error toggling service:', error)
    }
  }

  const handleDelete = async (id: string, nombre: any) => {
    const nombreES = getLocalizedText(nombre, 'ES')
    if (!confirm(`¿Eliminar el servicio "${nombreES}"?`)) return
    try {
      const res = await fetch(`/api/admin/servicios/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setServicios((prev) => prev.filter((s) => s.id !== id))
      } else {
        alert(data.error || 'No se pudo eliminar el servicio')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('Error al conectar con el servidor')
    }
  }

  const nonMunicipal = servicios.filter((s) => !s.esMunicipal)
  const municipal = servicios.filter((s) => s.esMunicipal)

  // Categoriza un servicio usando la lógica canónica compartida (lib/servicio-categoria).
  const CAT_A_FILTRO: Record<string, 'aeropuerto' | 'tours' | 'compartidos' | 'traslados' | 'otros'> = {
    AEROPUERTO: 'aeropuerto',
    TOUR_PERSONA: 'tours',
    COMPARTIDO: 'compartidos',
    TRASLADO: 'traslados',
    OTRO: 'otros',
    MUNICIPAL: 'otros', // los municipales ya se filtran aparte; fallback seguro
  }
  const categorizar = (s: Servicio): 'aeropuerto' | 'tours' | 'compartidos' | 'traslados' | 'otros' =>
    CAT_A_FILTRO[categoriaDeServicio(s)]

  const catCounts = { todos: nonMunicipal.length, aeropuerto: 0, tours: 0, compartidos: 0, traslados: 0, otros: 0 }
  nonMunicipal.forEach((s) => { catCounts[categorizar(s)]++ })

  const categorias = [
    { key: 'todos', label: 'Todos' },
    { key: 'aeropuerto', label: 'Aeropuerto' },
    { key: 'tours', label: 'Tours' },
    { key: 'compartidos', label: 'Tours compartidos' },
    { key: 'traslados', label: 'Traslados' },
    { key: 'otros', label: 'Otros servicios' },
  ] as const

  const nonMunicipalFiltered = catFilter === 'todos'
    ? nonMunicipal
    : nonMunicipal.filter((s) => categorizar(s) === catFilter)

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Servicios</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gestiona los servicios disponibles para reserva</p>
        </div>
        <Button size="sm" className="gap-1.5 text-sm" asChild>
          <Link href="/admin/dashboard/servicios/crear">
            <Plus size={14} />
            Crear servicio
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        {([
          { key: 'servicios', label: 'Servicios' },
          { key: 'municipal', label: 'Transporte Municipal' },
          { key: 'ubicaciones', label: 'Tarifas por Ubicación' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
          <Input
            placeholder="Buscar servicios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm border-neutral-200 bg-white"
          />
        </div>

        <Select value={activoFilter} onValueChange={setActivoFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm border-neutral-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-sm">Todos los estados</SelectItem>
            <SelectItem value="true" className="text-sm">Activos</SelectItem>
            <SelectItem value="false" className="text-sm">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Franja de categorías (solo tab Servicios) */}
      {tab === 'servicios' && (
        <div className="flex flex-wrap gap-2">
          {categorias.map(({ key, label }) => {
            const active = catFilter === key
            const count = catCounts[key]
            return (
              <button
                key={key}
                onClick={() => setCatFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-amber-400 hover:text-neutral-900'
                }`}
              >
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25' : 'bg-neutral-100 text-neutral-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Services list */}
      {tab === 'ubicaciones' ? (
        <div className="flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">Municipios dinámicos con recargo en COP para el wizard de reservas</p>
            <Button size="sm" className="gap-1.5 text-sm" onClick={openCreateMunicipio}>
              <Plus size={14} />
              Agregar Municipio
            </Button>
          </div>

          {municipiosLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : municipios.length === 0 ? (
            <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
              <MapPin className="mx-auto mb-3 text-neutral-300" size={32} />
              <p className="text-sm text-neutral-400 mb-3">No hay municipios configurados</p>
              <Button size="sm" onClick={openCreateMunicipio} className="gap-1.5">
                <Plus size={14} />
                Agregar primero
              </Button>
            </div>
          ) : (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleMunicipioDragEnd}>
              <SortableContext items={municipios.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="w-8 px-2 py-3" />
                        <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Nombre (ES)</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Nombre (EN)</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Recargo (COP)</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Estado</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {municipios.map((m) => (
                        <SortableMunicipioRow
                          key={m.id}
                          municipio={m}
                          onEdit={openEditMunicipio}
                          onDelete={handleDeleteMunicipio}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Create/Edit Dialog */}
          <Dialog open={municipioDialogOpen} onOpenChange={setMunicipioDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingMunicipio ? 'Editar Municipio' : 'Agregar Municipio'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nombreES">Nombre (Español) *</Label>
                  <Input
                    id="nombreES"
                    value={municipioForm.nombreES}
                    onChange={(e) => setMunicipioForm((f) => ({ ...f, nombreES: e.target.value }))}
                    placeholder="Ej: Medellín"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nombreEN">Nombre (English) *</Label>
                  <Input
                    id="nombreEN"
                    value={municipioForm.nombreEN}
                    onChange={(e) => setMunicipioForm((f) => ({ ...f, nombreEN: e.target.value }))}
                    placeholder="E.g.: Medellin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recargo">Recargo (COP) *</Label>
                  <Input
                    id="recargo"
                    type="number"
                    min="0"
                    step="1000"
                    value={municipioForm.recargo}
                    onChange={(e) => setMunicipioForm((f) => ({ ...f, recargo: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="activo">Activo</Label>
                  <Switch
                    id="activo"
                    checked={municipioForm.activo}
                    onCheckedChange={(v) => setMunicipioForm((f) => ({ ...f, activo: v }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMunicipioDialogOpen(false)} disabled={municipioSaving}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveMunicipio}
                  disabled={municipioSaving || !municipioForm.nombreES || !municipioForm.nombreEN}
                >
                  {municipioSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : tab === 'municipal' ? (
        <MunicipalServicesGroup
          servicios={municipal}
          onToggle={handleToggleActive}
          onDelete={handleDelete}
        />
      ) : nonMunicipalFiltered.length === 0 ? (
        <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
          <p className="text-sm text-neutral-400 mb-3">
            {catFilter === 'todos' ? 'No se encontraron servicios' : 'No hay servicios en esta categoría'}
          </p>
          <Button size="sm" asChild className="gap-1.5">
            <Link href="/admin/dashboard/servicios/crear">
              <Plus size={14} />
              Crear primer servicio
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {nonMunicipalFiltered.map((s) => (
            <div
              key={s.id}
              className="border border-neutral-200 rounded-lg bg-white p-4 hover:border-neutral-300 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Image */}
                <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-neutral-100">
                  <Image
                    src={s.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg'}
                    alt={getLocalizedText(s.nombre, 'ES')}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {getLocalizedText(s.nombre, 'ES')}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium h-5 ${s.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
                        >
                          {s.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {s.activo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium h-5 bg-blue-50 text-blue-700 border-blue-200"
                            title="Visible en la página de reservas"
                          >
                            Visible en reservas
                          </Badge>
                        )}
                        {s.tipoTarifa === 'POR_PERSONA' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium h-5 bg-amber-50 text-amber-700 border-amber-200"
                            title="Tarifa por persona (tramos 1 / 2 / 3+)"
                          >
                            Por persona
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1.5 line-clamp-1">
                        {getLocalizedText(s.descripcion, 'ES')}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-neutral-500">
                        {s.tipoTarifa === 'POR_PERSONA' ? (
                          (s.preciosPorPersona?.p1 ?? 0) > 0 && (
                            <span>
                              Desde:{' '}
                              <span className="font-semibold text-neutral-700">
                                ${Number(s.preciosPorPersona!.p1).toLocaleString('es-CO')}
                              </span>
                              <span className="text-neutral-400"> / persona</span>
                            </span>
                          )
                        ) : (
                          <>
                            {(() => {
                              const precios = (s.vehiculosPermitidos || [])
                                .map((v: any) => Number(v.precio ?? 0))
                                .filter((p: number) => p > 0);
                              if (precios.length === 0) return null;
                              return (
                                <span>
                                  Desde:{' '}
                                  <span className="font-semibold text-neutral-700">
                                    ${Math.min(...precios).toLocaleString('es-CO')}
                                  </span>
                                </span>
                              );
                            })()}
                            <span>
                              Vehículos:{' '}
                              <span className="font-semibold text-neutral-700">
                                {s.vehiculosPermitidos.length}
                              </span>
                            </span>
                          </>
                        )}
                        {(s._count?.reservas ?? 0) > 0 ? (
                          <Link
                            href={`/admin/dashboard/reservas?servicioId=${s.id}`}
                            className="hover:text-blue-600 hover:underline"
                            title="Ver reservas de este servicio"
                          >
                            Reservas:{' '}
                            <span className="font-semibold text-blue-600">
                              {s._count.reservas}
                            </span>
                          </Link>
                        ) : (
                          <span>
                            Reservas:{' '}
                            <span className="font-semibold text-neutral-700">0</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(s.id)}
                        title={s.activo ? 'Desactivar' : 'Activar'}
                        className={`area-tactil-completa p-2 rounded-md transition-colors ${s.activo ? 'text-green-500 hover:bg-green-50' : 'text-neutral-300 hover:bg-neutral-100'}`}
                      >
                        {s.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <Link
                        href={`/admin/dashboard/servicios/${s.id}/editar`}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(s.id, s.nombre)}
                        className="area-tactil-completa p-2 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sortable row for municipio drag-to-reorder ───────────────────────────────
function SortableMunicipioRow({
  municipio: m,
  onEdit,
  onDelete,
}: {
  municipio: MunicipioConfig
  onEdit: (m: MunicipioConfig) => void
  onDelete: (m: MunicipioConfig) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#f9fafb' : undefined,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-neutral-50 transition-colors">
      <td className="px-2 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 p-1 rounded"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-neutral-900">{m.nombreES}</td>
      <td className="px-4 py-3 text-neutral-600">{m.nombreEN}</td>
      <td className="px-4 py-3 text-right font-semibold text-neutral-800">
        ${Number(m.recargo).toLocaleString('es-CO')}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium h-5 ${m.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
        >
          {m.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(m)}
            className="p-1.5 rounded-md text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(m)}
            className="area-tactil-completa p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
