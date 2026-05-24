'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import { VehicleIcon, getVehicleType } from '@/components/ui/VehicleIcon'

interface Vehiculo {
  id: string
  nombre: string
  capacidadMinima: number
  capacidadMaxima: number
  activo: boolean
}

const EMPTY_FORM = {
  nombre: '',
  capacidadMinima: 1,
  capacidadMaxima: 4,
  activo: true,
}

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingVehiculo, setEditingVehiculo] = useState<Vehiculo | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchVehiculos()
  }, [])

  const fetchVehiculos = async () => {
    try {
      const res = await fetch('/api/vehiculos')
      const data = await res.json()
      setVehiculos(data.data || [])
    } catch (error) {
      console.error('Error fetching vehiculos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = editingVehiculo ? `/api/vehiculos/${editingVehiculo.id}` : '/api/vehiculos'
      const method = editingVehiculo ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        await fetchVehiculos()
        closeDialog()
      }
    } catch (error) {
      console.error('Error saving vehiculo:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/vehiculos/${deleteId}`, { method: 'DELETE' })
      if (res.ok) await fetchVehiculos()
    } catch (error) {
      console.error('Error deleting vehiculo:', error)
    } finally {
      setDeleteId(null)
    }
  }

  const openEdit = (v: Vehiculo) => {
    setEditingVehiculo(v)
    setFormData({
      nombre: v.nombre,
      capacidadMinima: v.capacidadMinima,
      capacidadMaxima: v.capacidadMaxima,
      activo: v.activo,
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingVehiculo(null)
    setFormData(EMPTY_FORM)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingVehiculo(null)
    setFormData(EMPTY_FORM)
  }

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Vehículos</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''} registrado
            {vehiculos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-sm" onClick={openCreate}>
          <Plus size={14} />
          Nuevo vehículo
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-neutral-100">
              <Skeleton className="h-12 w-16 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="border border-neutral-200 rounded-lg py-16 text-center bg-white">
          <p className="text-sm text-neutral-400 mb-3">No hay vehículos registrados</p>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} />
            Agregar primer vehículo
          </Button>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[64px_1fr_160px_80px_88px] items-center px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            <span></span>
            <span>Vehículo</span>
            <span>Capacidad</span>
            <span>Estado</span>
            <span></span>
          </div>

          {vehiculos.map((v, idx) => (
            <div
              key={v.id}
              className={`grid grid-cols-[64px_1fr_160px_80px_88px] items-center px-4 py-3 gap-3 hover:bg-neutral-50 transition-colors
                ${idx < vehiculos.length - 1 ? 'border-b border-neutral-100' : ''}`}
            >
              {/* Thumbnail */}
              <div className="h-12 w-16 bg-white rounded-lg border border-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                <VehicleIcon nombre={v.nombre} size="sm" />
              </div>

              {/* Name */}
              <span className="text-sm font-semibold text-neutral-800">{v.nombre}</span>

              {/* Capacity */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Users size={13} />
                <span>{v.capacidadMinima}–{v.capacidadMaxima} pasajeros</span>
              </div>

              {/* Estado */}
              <Badge
                variant="outline"
                className={`text-[10px] font-medium w-fit ${v.activo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
              >
                {v.activo ? 'Activo' : 'Inactivo'}
              </Badge>

              {/* Actions */}
              <div className="flex gap-1.5 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs border-neutral-200 gap-1.5"
                  onClick={() => openEdit(v)}
                >
                  <Edit2 size={12} />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 border-neutral-200 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                  onClick={() => setDeleteId(v.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingVehiculo ? 'Editar vehículo' : 'Nuevo vehículo'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2">
              {/* Left column */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-700">Nombre / Modelo</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Van 7 pasajeros, Sedan"
                    required
                    className="h-9 text-sm border-neutral-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">Capacidad mínima</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.capacidadMinima}
                      onChange={(e) =>
                        setFormData({ ...formData, capacidadMinima: Number(e.target.value) })
                      }
                      required
                      className="h-9 text-sm border-neutral-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-neutral-700">Capacidad máxima</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.capacidadMaxima}
                      onChange={(e) =>
                        setFormData({ ...formData, capacidadMaxima: Number(e.target.value) })
                      }
                      required
                      className="h-9 text-sm border-neutral-200"
                    />
                  </div>
                </div>

                {/* Estado toggle — prominent */}
                <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Estado del vehículo
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {formData.activo ? 'Activo' : 'Inactivo'}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {formData.activo
                          ? 'Disponible para asignación a reservas'
                          : 'No aparece en opciones de asignación'}
                      </p>
                    </div>
                    <Switch
                      id="activo"
                      checked={formData.activo}
                      onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Right column — icon preview */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-neutral-700">Ícono del vehículo</Label>
                <div className="border border-neutral-200 rounded-lg bg-white flex flex-col items-center justify-center gap-3 py-8">
                  <VehicleIcon nombre={formData.nombre} size="lg" />
                  <p className="text-xs text-neutral-400 capitalize">
                    {getVehicleType(formData.nombre)}
                  </p>
                </div>
                <p className="text-[11px] text-neutral-400">
                  El ícono se asigna automáticamente según el nombre del vehículo.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-5 gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-sm"
                onClick={closeDialog}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="text-sm" disabled={saving}>
                {saving ? 'Guardando...' : editingVehiculo ? 'Guardar cambios' : 'Crear vehículo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Eliminar vehículo?</AlertDialogTitle>
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
