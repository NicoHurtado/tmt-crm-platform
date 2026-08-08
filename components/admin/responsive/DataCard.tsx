'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Piezas para el modo "tarjeta" de las listas del admin.
 *
 * Por debajo de `lg` una tabla de 12 columnas no cabe de ninguna forma honesta:
 * o se corta, o se encoge la letra hasta lo ilegible, o se convierte en un
 * scroll horizontal donde el usuario pierde de vista a qué fila pertenece lo que
 * está leyendo. El patrón que usa la industria para listas densas en teléfono es
 * convertir cada fila en una tarjeta con los campos etiquetados, jerarquizando:
 * lo que identifica al registro arriba y grande, el resto como pares
 * etiqueta/valor. Eso es lo que arman estos componentes.
 *
 * La tabla de escritorio no se toca: `TableWrap` la esconde por debajo de `lg` y
 * muestra las tarjetas, y al revés.
 */

/** Contenedor de la lista de tarjetas. Solo visible por debajo de `lg`. */
export function DataCardList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 lg:hidden', className)}>{children}</div>
  )
}

/** Envuelve la tabla de escritorio: se oculta por debajo de `lg`. */
export function TableWrap({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'hidden lg:block border border-neutral-200 rounded-lg overflow-hidden bg-white',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Una fila convertida en tarjeta.
 *
 * Si recibe `onClick` se comporta como botón: cursor, estado activo y una
 * flecha a la derecha que indica que lleva a algún lado. Sin `onClick` es
 * estática y no finge ser interactiva.
 */
export function DataCard({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const interactive = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick!()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-3.5',
        interactive && 'cursor-pointer active:bg-neutral-50 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Cabecera de la tarjeta: identificador a la izquierda, estado a la derecha.
 * `chevron` añade la flecha de "abre detalle".
 */
export function DataCardHeader({
  title,
  subtitle,
  badge,
  chevron = false,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  chevron?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">{title}</div>
        {subtitle && (
          <div className="text-[13px] text-neutral-500 mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {badge}
        {chevron && <ChevronRight size={16} className="text-neutral-300" />}
      </div>
    </div>
  )
}

/**
 * Rejilla de pares etiqueta/valor. Dos columnas: en 375px una sola columna
 * alarga demasiado la tarjeta y obliga a scrollear por cada registro; tres no
 * dejan respirar los valores largos como los montos.
 */
export function DataCardFields({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode
  cols?: 1 | 2 | 3
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-x-3 gap-y-2 mt-3',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Un par etiqueta/valor. La etiqueta va arriba y pequeña: sin ella, fuera de la
 * tabla, un valor suelto como "07/08/2026" no dice si es la fecha del servicio
 * o la de creación.
 */
export function DataCardField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="text-[13px] text-neutral-800 mt-0.5 break-words">{children}</div>
    </div>
  )
}

/** Pie de la tarjeta, separado por una línea. Para totales y acciones. */
export function DataCardFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 mt-3 pt-3 border-t border-neutral-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Estado vacío común a tarjetas y tabla. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-12 text-center text-sm text-neutral-400 lg:hidden">
      {children}
    </div>
  )
}
