'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Copy, Check, Settings, X, Search, Link, QrCode, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import ConfiguracionPrecios from '@/components/admin/ConfiguracionPrecios'
import ImageUploader from '@/components/admin/ImageUploader'
import AliadoQRModal from '@/components/admin/AliadoQRModal'

interface Aliado {
  id: string
  nombre: string
  tipo: 'HOTEL' | 'AIRBNB' | 'AGENCIA'
  codigo: string
  email: string
  contacto: string
  imagen?: string | null
  activo: boolean
  _count?: { reservas: number }
}

const EMPTY_FORM = {
  nombre: '',
  tipo: 'HOTEL' as 'HOTEL' | 'AIRBNB' | 'AGENCIA',
  email: '',
  contacto: '',
  imagen: '',
  activo: true,
}

const TIPO_BADGE: Record<string, string> = {
  HOTEL: 'bg-blue-50 text-blue-700 border-blue-200',
  AIRBNB: 'bg-purple-50 text-purple-700 border-purple-200',
  AGENCIA: 'bg-green-50 text-green-700 border-green-200',
}

type TipoTab = 'ALL' | 'HOTEL' | 'AIRBNB' | 'AGENCIA'
type ActivoFilter = 'ALL' | 'activo' | 'inactivo'

export default function AliadosPage() {
  const [aliados, setAliados] = useState<Aliado[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Aliado | null>(null)
  const [editingAliado, setEditingAliado] = useState<Aliado | null>(null)
  const [configuringAliadoId, setConfiguringAliadoId] = useState<string | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [copiedCodigo, setCopiedCodigo] = useState<string | null>(null)
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoTab, setTipoTab] = useState<TipoTab>('ALL')
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>('ALL')
  const [qrAliado, setQrAliado] = useState<Aliado | null>(null)

  const filtered = useMemo(() => {
    return aliados.filter((a) => {
      if (tipoTab !== 'ALL' && a.tipo !== tipoTab) return false
      if (activoFilter === 'activo' && !a.activo) return false
      if (activoFilter === 'inactivo' && a.activo) return false
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        return (
          a.nombre.toLowerCase().includes(q) ||
          a.codigo.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [aliados, tipoTab, activoFilter, searchTerm])

  useEffect(() => {
    fetchAliados()
  }, [])

  const fetchAliados = async () => {
    try {
      const res = await fetch('/api/aliados')
      const data = await res.json()
      setAliados(data.data || [])
    } catch (error) {
      console.error('Error fetching aliados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingAliado ? `/api/aliados/${editingAliado.id}` : '/api/aliados'
      const method = editingAliado ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        await fetchAliados()
        closeDialog()
      }
    } catch (error) {
      console.error('Error saving aliado:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (aliado: Aliado) => {
    try {
      const res = await fetch(`/api/aliados/${aliado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !aliado.activo }),
      })
      if (res.ok) await fetchAliados()
    } catch (error) {
      console.error('Error toggling aliado status:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/aliados/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) await fetchAliados()
    } catch (error) {
      console.error('Error deleting aliado:', error)
    } finally {
      setDeleteTarget(null)
    }
  }

  const openEdit = (aliado: Aliado) => {
    setEditingAliado(aliado)
    setFormData({
      nombre: aliado.nombre,
      tipo: aliado.tipo,
      email: aliado.email,
      contacto: aliado.contacto,
      imagen: aliado.imagen || '',
      activo: aliado.activo,
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingAliado(null)
    setFormData(EMPTY_FORM)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingAliado(null)
    setFormData(EMPTY_FORM)
  }

  const copyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo)
    setCopiedCodigo(codigo)
    setTimeout(() => setCopiedCodigo(null), 2000)
  }

  const copyLink = (codigo: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/reservas/${codigo}`)
    setCopiedCodigo(`LINK-${codigo}`)
    setTimeout(() => setCopiedCodigo(null), 2000)
  }

  const handleGenerarLink = async (aliadoId: string) => {
    setGeneratingLinkId(aliadoId)
    try {
      const res = await fetch(`/api/aliados/${aliadoId}/generar-link`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const url = data.linkUrl || `${window.location.origin}/a/${data.linkToken}`
        setGeneratedLink(url)
        setLinkDialogOpen(true)
      }
    } catch (error) {
      console.error('Error generating link:', error)
    } finally {
      setGeneratingLinkId(null)
    }
  }

  const handleCopyGeneratedLink = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const TABS: { value: TipoTab; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'HOTEL', label: 'Hotel' },
    { value: 'AGENCIA', label: 'Agencia' },
    { value: 'AIRBNB', label: 'Airbnb' },
  ]

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Aliados</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Hoteles, agencias y Airbnbs</p>
        </div>
        <Button size="sm" className="gap-1.5 text-sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo aliado
        </Button>
      </div>

      {/* Tabs + filters row */}
      {/* Pestañas y filtros van en una fila desde lg; en móvil se apilan porque juntos
          miden más del doble del ancho de un teléfono. La línea inferior pasa a las
          pestañas cuando están apiladas, para que el subrayado de la pestaña activa
          siga alineado con su base y no quede una raya suelta bajo los filtros. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:border-b lg:border-neutral-200">
        <div className="flex overflow-x-auto border-b border-neutral-200 lg:border-b-0">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTipoTab(t.value)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px shrink-0 whitespace-nowrap ${
                tipoTab === t.value
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2 lg:pb-1">
          <div className="relative flex-1 min-w-[9rem] lg:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm border-neutral-200 bg-white w-full lg:w-44"
            />
          </div>
          <div className="flex gap-1">
            {(['ALL', 'activo', 'inactivo'] as ActivoFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setActivoFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activoFilter === f
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'activo' ? 'Activos' : 'Inactivos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
          <p className="text-sm text-neutral-400 mb-3">No se encontraron aliados</p>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus size={14} />
            Crear primer aliado
          </Button>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                {['Nombre', 'Tipo', 'Código', 'Email', 'Contacto', 'Reservas', 'Estado', 'Acciones'].map((h) => (
                  <TableHead
                    key={h}
                    className="text-xs font-semibold text-neutral-500 py-2.5 first:pl-5 last:pr-5 whitespace-nowrap"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((aliado) => (
                <TableRow key={aliado.id} className="hover:bg-neutral-50 transition-colors">
                  <TableCell className="py-3 pl-5">
                    <div className="flex items-center gap-3">
                      {aliado.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={aliado.imagen}
                          alt={aliado.nombre}
                          className="w-10 h-10 rounded-md object-cover border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-md bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center shrink-0"
                          title="Sin imagen"
                        >
                          <ImageIcon size={16} className="text-neutral-300" />
                        </div>
                      )}
                      <p className="text-sm font-semibold text-neutral-900">{aliado.nombre}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className={`text-[10px] font-medium h-5 ${TIPO_BADGE[aliado.tipo]}`}>
                      {aliado.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-neutral-800">{aliado.codigo}</span>
                      <button
                        onClick={() => copyCode(aliado.codigo)}
                        className="p-1 rounded hover:bg-neutral-100 transition-colors"
                        title="Copiar código"
                      >
                        {copiedCodigo === aliado.codigo
                          ? <Check size={12} className="text-green-600" />
                          : <Copy size={12} className="text-neutral-400" />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-600">{aliado.email}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-600">{aliado.contacto}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-500">{aliado._count?.reservas ?? 0}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      aliado.activo
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                    }`}>
                      {aliado.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(aliado)}
                        className="px-2.5 py-1.5 rounded text-xs font-medium text-neutral-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          setConfiguringAliadoId(aliado.id)
                          setConfigDialogOpen(true)
                        }}
                        className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Configurar precios"
                      >
                        <Settings size={13} />
                      </button>
                      <button
                        onClick={() => handleGenerarLink(aliado.id)}
                        disabled={generatingLinkId === aliado.id}
                        className="p-1.5 rounded text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
                        title="Generar link de aliado"
                      >
                        <Link size={13} />
                      </button>
                      <button
                        onClick={() => setQrAliado(aliado)}
                        className="p-1.5 rounded text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="QR de referido"
                      >
                        <QrCode size={13} />
                      </button>
                      <button
                        onClick={() => copyLink(aliado.codigo)}
                        className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Copiar link público"
                      >
                        {copiedCodigo === `LINK-${aliado.codigo}`
                          ? <Check size={13} className="text-green-600" />
                          : <Copy size={13} />}
                      </button>
                      <button
                        onClick={() => handleToggleActivo(aliado)}
                        className={`p-1.5 rounded transition-colors ${
                          aliado.activo
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-red-400 hover:bg-red-50'
                        }`}
                        title={aliado.activo ? 'Desactivar' : 'Activar'}
                      >
                        {aliado.activo ? <Check size={13} /> : <X size={13} />}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(aliado)}
                        className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingAliado ? 'Editar aliado' : 'Nuevo aliado'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-neutral-700">Nombre</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Hotel Medellín Plaza"
                  required
                  className="h-9 text-sm border-neutral-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-neutral-700">Tipo</Label>
                <div className="flex gap-4">
                  {(['HOTEL', 'AIRBNB', 'AGENCIA'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={t}
                        checked={formData.tipo === t}
                        onChange={() => setFormData({ ...formData, tipo: t })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-neutral-700">{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-700">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@hotel.com"
                    required
                    className="h-9 text-sm border-neutral-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-700">Teléfono de contacto</Label>
                  <Input
                    value={formData.contacto}
                    onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    placeholder="+57 300 123 4567"
                    required
                    className="h-9 text-sm border-neutral-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-neutral-700">
                  Imagen del aliado (para la card pública de hoteles)
                </Label>
                <ImageUploader
                  currentImageUrl={formData.imagen}
                  onImageUploaded={(url) => setFormData({ ...formData, imagen: url })}
                  label=""
                />
              </div>

              {editingAliado && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md">
                  <p className="text-xs text-neutral-500">
                    Código de acceso:{' '}
                    <span className="font-mono font-semibold text-neutral-800">{editingAliado.codigo}</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    El código se genera automáticamente y no puede modificarse
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{formData.activo ? 'Activo' : 'Inactivo'}</p>
                  <p className="text-xs text-neutral-400">Estado del aliado</p>
                </div>
                <Switch
                  id="activo-aliado"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-sm" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="text-sm" disabled={saving}>
                {saving ? 'Guardando...' : editingAliado ? 'Guardar cambios' : 'Crear aliado'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Config Precios — Large Modal Overlay */}
      {configDialogOpen && configuringAliadoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-[96vw] h-[94vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-neutral-200 shrink-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Configuración de precios y servicios</h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {aliados.find(a => a.id === configuringAliadoId)?.nombre}
                </p>
              </div>
              <button
                onClick={() => setConfigDialogOpen(false)}
                className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <ConfiguracionPrecios
                aliadoId={configuringAliadoId}
                onClose={() => setConfigDialogOpen(false)}
                onSave={() => {
                  fetchAliados()
                  setConfigDialogOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Generated Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { if (!open) { setLinkDialogOpen(false); setGeneratedLink(null); setCopiedLink(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Link de aliado generado</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-neutral-600">Comparte este link con el aliado para que sus clientes puedan reservar directamente:</p>
            <div className="flex items-center gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-md">
              <span className="text-xs font-mono text-neutral-700 break-all flex-1">{generatedLink}</span>
              <button
                onClick={handleCopyGeneratedLink}
                className="shrink-0 p-1.5 rounded hover:bg-neutral-200 transition-colors"
                title="Copiar link"
              >
                {copiedLink
                  ? <Check size={14} className="text-green-600" />
                  : <Copy size={14} className="text-neutral-500" />}
              </button>
            </div>
            <p className="text-xs text-neutral-400">Este link reemplaza cualquier link anterior del aliado.</p>
          </div>
          <DialogFooter>
            <Button size="sm" className="text-sm" onClick={() => { setLinkDialogOpen(false); setGeneratedLink(null); setCopiedLink(false) }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar aliado?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta acción borrará definitivamente a &quot;{deleteTarget?.nombre}&quot; y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-sm h-9 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR de referido */}
      <AliadoQRModal
        open={!!qrAliado}
        onClose={() => setQrAliado(null)}
        aliado={qrAliado ? { nombre: qrAliado.nombre, codigo: qrAliado.codigo } : null}
      />
    </div>
  )
}
