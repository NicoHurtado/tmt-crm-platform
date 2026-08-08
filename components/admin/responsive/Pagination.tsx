'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Paginación de listas.
 *
 * Escritorio: idéntica a la de antes — "Mostrar N por página" a la izquierda,
 * y el rango pegado a las dos flechas a la derecha.
 *
 * Móvil: el selector de tamaño de página desaparece (nadie cambia "20 por
 * página" desde un teléfono y se comía media línea) y las flechas se vuelven dos
 * botones de 44px con etiqueta, uno a cada lado del rango. Un icono de 28px
 * contra el borde de la pantalla es de los objetivos más difíciles de acertar
 * con el pulgar.
 *
 * No trae borde ni fondo propios: quien la usa decide el marco, porque en
 * escritorio va cosida al pie de la tabla y en móvil va suelta bajo las tarjetas.
 */
export function Pagination({
  page,
  perPage,
  total,
  totalPages,
  onPageChange,
  onPerPageChange,
  perPageOptions = [20, 50, 100],
}: {
  page: number
  perPage: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  perPageOptions?: number[]
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const range = `${from}–${to} de ${total}`

  return (
    <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3">
      {/* Escritorio: tamaño de página */}
      {onPerPageChange ? (
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs text-neutral-500">Mostrar</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              onPerPageChange(Number(v))
              onPageChange(1)
            }}
          >
            <SelectTrigger className="h-7 w-16 text-xs border-neutral-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-neutral-500">por página</span>
        </div>
      ) : (
        <div className="hidden lg:block" />
      )}

      {/* Móvil: anterior · rango · siguiente */}
      <Button
        variant="outline"
        className="lg:hidden h-11 px-3 gap-1 border-neutral-200 font-normal text-sm"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={15} />
        Anterior
      </Button>
      <span className="lg:hidden text-xs text-neutral-500 text-center whitespace-nowrap">
        {range}
      </span>
      <Button
        variant="outline"
        className="lg:hidden h-11 px-3 gap-1 border-neutral-200 font-normal text-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
        <ChevronRight size={15} />
      </Button>

      {/* Escritorio: rango + flechas, juntos a la derecha */}
      <div className="hidden lg:flex items-center gap-1">
        <span className="text-xs text-neutral-500 mr-2">{range}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 border-neutral-200"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={13} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 border-neutral-200"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  )
}
