'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Search, Phone } from 'lucide-react'
import Image from 'next/image'
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

interface Conductor {
  id: string
  nombre: string
  whatsapp: string
  telefono: string
  documento: string
  placa: string
  foto: string | null
  disponible: boolean
  activo: boolean
  fotosVehiculo: string[]
}

const EMPTY_FORM = {
  nombre: '',
  whatsapp: '',
  telefono: '',
  documento: '',
  placa: '',
  foto: null as string | null,
  disponible: true,
  activo: true,
}

export default function ConductoresPage() {
  const [conductores, setConductores] = useState<Conductor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingConductor, setEditingConductor] = useState<Conductor | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredConductores = conductores.filter(
    (c) =>
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.documento.includes(searchTerm) ||
      c.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefono.includes(searchTerm)
  )

  useEffect(() => {
    fetchConductores()
  }, [])

  const fetchConductores = async () => {
    try {
      const res = await fetch('/api/conductores?activo=true')
      const data = await res.json()
      setConductores(data.data || [])
    } catch (error) {
      console.error('Error fetching conductores:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingConductor ? `/api/conductores/${editingConductor.id}` : '/api/conductores'
      const method = editingConductor ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        await fetchConductores()
        closeDialog()
      }
    } catch (error) {
      console.error('Error saving conductor:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/conductores/${deleteId}`, { method: 'DELETE' })
      if (res.ok) await fetchConductores()
    } catch (error) {
      console.error('Error deleting conductor:', error)
    } finally {
      setDeleteId(null)
    }
  }

  const openEdit = (c: Conductor) => {
    setEditingConductor(c)
    setFormData({
      nombre: c.nombre,
      whatsapp: c.whatsapp,
      telefono: c.telefono,
      documento: c.documento,
      placa: c.placa,
      foto: c.foto,
      disponible: c.disponible,
      activo: c.activo,
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingConductor(null)
    setFormData(EMPTY_FORM)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingConductor(null)
    setFormData(EMPTY_FORM)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload?folder=conductores', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) setFormData((prev) => ({ ...prev, foto: data.url }))
    } catch (error) {
      console.error('Error uploading photo:', error)
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Conductores</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {conductores.length} conductor{conductores.length !== 1 ? 'es' : ''} registrado
            {conductores.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo conductor
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
        <Input
          placeholder="Buscar conductores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 h-9 text-sm border-neutral-200 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredConductores.length === 0 ? (
        <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
          <p className="text-sm text-neutral-400 mb-3">No se encontraron conductores</p>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus size={14} />
            Agregar primer conductor
          </Button>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50 hover:bg-neutral-50">
                {['Conductor', 'Documento', 'Placa', 'Teléfono', 'WhatsApp', 'Disponible', 'Estado', 'Acciones'].map((h) => (
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
              {filteredConductores.map((c) => (
                <TableRow key={c.id} className="hover:bg-neutral-50 transition-colors">
                  <TableCell className="py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 flex-shrink-0 bg-neutral-100 flex items-center justify-center">
                        {c.foto ? (
                          <Image
                            src={c.foto}
                            alt={c.nombre}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <span className="text-xs font-bold text-neutral-400">
                            {c.nombre.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">{c.nombre}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-600">{c.documento}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs font-mono font-semibold text-neutral-800">{c.placa}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-neutral-600">{c.telefono}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                    >
                      <Phone size={11} />
                      {c.whatsapp}
                    </a>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      c.disponible
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                    }`}>
                      {c.disponible ? 'Disponible' : 'Ocupado'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      c.activo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                    }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="px-2.5 py-1.5 rounded text-xs font-medium text-neutral-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingConductor ? 'Editar conductor' : 'Nuevo conductor'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2">
              {/* Left: fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-700">Nombre completo</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Carlos González"
                    required
                    className="h-9 text-sm border-neutral-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">Teléfono</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+57 300 123 4567"
                      required
                      className="h-9 text-sm border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">WhatsApp</Label>
                    <Input
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      placeholder="+57 300 123 4567"
                      required
                      className="h-9 text-sm border-neutral-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">Documento</Label>
                    <Input
                      value={formData.documento}
                      onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                      placeholder="1234567890"
                      required
                      className="h-9 text-sm border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">Placa</Label>
                    <Input
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      placeholder="ABC123"
                      required
                      className="h-9 text-sm border-neutral-200 font-mono"
                    />
                  </div>
                </div>

                {/* Estado toggles */}
                <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50 space-y-3">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{formData.activo ? 'Activo' : 'Inactivo'}</p>
                      <p className="text-xs text-neutral-400">
                        {formData.activo ? 'Aparece como opción de asignación' : 'No aparece en asignaciones'}
                      </p>
                    </div>
                    <Switch
                      id="activo-conductor"
                      checked={formData.activo}
                      onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                    />
                  </div>
                  <div className="border-t border-neutral-200 pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{formData.disponible ? 'Disponible' : 'Ocupado'}</p>
                      <p className="text-xs text-neutral-400">Disponibilidad actual</p>
                    </div>
                    <Switch
                      id="disponible-conductor"
                      checked={formData.disponible}
                      onCheckedChange={(checked) => setFormData({ ...formData, disponible: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Right: photo */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-700">Foto del conductor</Label>
                  <div className="flex flex-col items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-neutral-50">
                    <div className="w-20 h-20 rounded-full overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      {formData.foto ? (
                        <Image
                          src={formData.foto}
                          alt="Preview"
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : (
                        <span className="text-2xl font-bold text-neutral-300">
                          {formData.nombre ? formData.nombre.charAt(0).toUpperCase() : '?'}
                        </span>
                      )}
                    </div>
                    <div className="w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        className="block w-full text-xs text-neutral-500
                          file:mr-3 file:py-1.5 file:px-3
                          file:rounded file:border file:border-neutral-200
                          file:text-xs file:font-medium file:bg-white file:text-neutral-700
                          hover:file:bg-neutral-50 file:cursor-pointer cursor-pointer"
                      />
                      {uploadingPhoto && (
                        <p className="text-xs text-neutral-400 mt-1.5">Subiendo foto...</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-sm" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="text-sm" disabled={saving}>
                {saving ? 'Guardando...' : editingConductor ? 'Guardar cambios' : 'Crear conductor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar conductor?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Esta acción no se puede deshacer.
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
    </div>
  )
}
