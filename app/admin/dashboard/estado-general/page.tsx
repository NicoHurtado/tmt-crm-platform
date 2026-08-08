'use client'

import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Reporte {
  id: string
  titulo: string
  descripcion: string
  detalle: string[]
  endpoint: string
  icon: React.ElementType
}

const REPORTES: Reporte[] = [
  {
    id: 'servicios-precios',
    titulo: 'Servicios y Precios para Independientes',
    descripcion: 'Catálogo operativo completo del público independiente.',
    detalle: [
      'Servicios generales por categoría (aeropuerto, traslados, tours, otros)',
      'Precios por vehículo o por persona, con descripciones ES/EN y duración',
      'Tarifas por municipio y transportes municipales',
    ],
    endpoint: '/api/admin/estado-general/servicios-precios',
    icon: FileSpreadsheet,
  },
  {
    id: 'aliados-comisiones',
    titulo: 'Aliados y Comisiones',
    descripcion: 'Reporte comercial/financiero por aliado (Hotel, Agencia, Airbnb).',
    detalle: [
      'Servicios habilitados e inhabilitados por aliado',
      'Precios y comisiones acordadas por vehículo',
      'Hoja resumen con conteo de servicios por aliado',
    ],
    endpoint: '/api/admin/estado-general/aliados-comisiones',
    icon: Users,
  },
]

export default function EstadoGeneralPage() {
  const [cargando, setCargando] = useState<string | null>(null)

  const descargar = async (rep: Reporte) => {
    setCargando(rep.id)
    try {
      const res = await fetch(rep.endpoint)
      if (!res.ok) throw new Error(`Error ${res.status}`)

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || `${rep.id}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Reporte descargado')
    } catch (err) {
      toast.error('No se pudo generar el reporte. Inténtalo de nuevo.')
    } finally {
      setCargando(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Estado General</h1>
        <p className="text-gray-500 mt-1">
          Descarga el estado actual del negocio en Excel para gestión interna y partners.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {REPORTES.map((rep) => {
          const Icon = rep.icon
          const isLoading = cargando === rep.id
          return (
            <div
              key={rep.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="font-semibold text-gray-900">{rep.titulo}</h2>
              </div>

              <p className="mt-3 text-sm text-gray-600">{rep.descripcion}</p>

              <ul className="mt-3 space-y-1 text-sm text-gray-500">
                {rep.detalle.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-2">
                <Button
                  onClick={() => descargar(rep)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando…
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Excel
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
