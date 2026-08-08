'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface FilterChip {
  /** Texto que se muestra dentro del chip, ej. "Estado: Completada". */
  label: string
  /** Vuelve este filtro a su valor por defecto. */
  onRemove: () => void
}

interface FilterShellProps {
  /** El input de búsqueda. Se muestra siempre, nunca se esconde tras el sheet:
   *  buscar es la acción más frecuente y esconderla cuesta dos toques. */
  search?: React.ReactNode
  /** Los controles de filtro. Se montan dos veces (barra de escritorio y sheet
   *  móvil), pero el estado vive en la página, así que las dos copias leen y
   *  escriben lo mismo y no se pueden desincronizar. Ojo: por eso ningún control
   *  de aquí debe recibir su `open` desde afuera — un Popover/Command con
   *  apertura controlada abriría sus dos portales a la vez. Usa `ComboboxFilter`,
   *  que se maneja el suyo por dentro. */
  children: React.ReactNode
  /** Filtros activos, para pintarlos como chips que se quitan de un toque. */
  chips?: FilterChip[]
  onClearAll?: () => void
  /** Cuántos resultados deja la selección actual; se muestra en el botón de
   *  cerrar del sheet para que el efecto del filtro sea visible antes de volver. */
  resultCount?: number
}

/**
 * Barra de filtros adaptable.
 *
 * Escritorio: los controles van en línea, como una barra de herramientas — es lo
 * que ya había y lo que espera quien trabaja con mouse y pantalla ancha.
 *
 * Móvil: solo queda la búsqueda y un botón "Filtros" con el número de filtros
 * activos; el resto se va a un bottom sheet a pantalla casi completa, donde cada
 * control ocupa el ancho entero y mide 44px de alto. Debajo de la barra quedan
 * los chips de lo que está aplicado, porque en un sheet cerrado no se ve qué
 * filtros están activos y es facilísimo quedar mirando una lista filtrada sin
 * darse cuenta.
 *
 * El patrón (barra compacta + sheet + chips) es el estándar de facto en apps
 * móviles con catálogos grandes; evita las rejillas de selects que se montan
 * unas sobre otras al bajar de ~600px.
 */
export function FilterShell({
  search,
  children,
  chips = [],
  onClearAll,
  resultCount,
}: FilterShellProps) {
  const [open, setOpen] = useState(false)
  const activeCount = chips.length

  return (
    <div className="flex flex-col gap-2">
      {/* Fila de control: búsqueda + disparador del sheet (solo móvil) */}
      <div className="flex items-center gap-2 lg:hidden">
        {search && <div className="flex-1 min-w-0">{search}</div>}
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className={cn(
            'h-11 px-3 gap-1.5 flex-shrink-0 border-neutral-200 bg-white font-normal',
            activeCount > 0 && 'border-amber-300 bg-amber-50 text-amber-800',
          )}
        >
          <SlidersHorizontal size={15} />
          <span className="text-sm">Filtros</span>
          {activeCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Chips de filtros activos (solo móvil; en escritorio los controles ya
          muestran su propio valor seleccionado). */}
      {activeCount > 0 && (
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 w-max pb-0.5">
            {chips.map((chip, i) => (
              <button
                key={`${chip.label}-${i}`}
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 h-8 pl-2.5 pr-2 rounded-full bg-neutral-100 border border-neutral-200 text-xs text-neutral-700 whitespace-nowrap active:bg-neutral-200"
              >
                <span className="max-w-[180px] truncate">{chip.label}</span>
                <X size={13} className="text-neutral-400 flex-shrink-0" />
              </button>
            ))}
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="h-8 px-2.5 text-xs text-neutral-500 underline whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Escritorio: los controles en línea, sin sheet de por medio. */}
      <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-2">
        {search}
        {children}
        {activeCount > 0 && onClearAll && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-sm text-neutral-500"
            onClick={onClearAll}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Móvil: los mismos controles, apilados dentro del sheet. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="lg:hidden max-h-[85vh] rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-neutral-200 flex-shrink-0">
            <SheetTitle className="text-base">Filtros</SheetTitle>
            <SheetDescription className="sr-only">
              Ajusta los filtros de la lista
            </SheetDescription>
          </SheetHeader>

          {/* `filtros-movil` estira los controles a todo el ancho y los sube a
              44px de alto sin tener que tocar el className de cada uno. */}
          <div className="filtros-movil flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {children}
          </div>

          <div className="flex-shrink-0 border-t border-neutral-200 p-3 flex items-center gap-2 bg-white">
            {onClearAll && (
              <Button
                variant="outline"
                className="h-12 flex-1 border-neutral-200 font-normal"
                onClick={onClearAll}
                disabled={activeCount === 0}
              >
                Limpiar
              </Button>
            )}
            <Button
              className="h-12 flex-1 bg-neutral-900 hover:bg-neutral-800 text-white"
              onClick={() => setOpen(false)}
            >
              {typeof resultCount === 'number'
                ? `Ver ${resultCount} resultado${resultCount === 1 ? '' : 's'}`
                : 'Aplicar'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/**
 * Envuelve un control del sheet con su etiqueta. En escritorio el `<label>` no se
 * pinta (los selects ya dicen "Todos los estados" dentro), pero en el sheet cada
 * campo necesita nombre propio porque se ven todos juntos y apilados.
 */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 lg:contents', className)}>
      <span className="text-xs font-medium text-neutral-500 lg:hidden">{label}</span>
      {children}
    </div>
  )
}
