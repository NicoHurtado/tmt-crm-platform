'use client'

import { cn } from '@/lib/utils'

/**
 * Contenedor estándar de una pantalla del admin.
 *
 * El padding baja a 16px en móvil (24px se comía demasiado ancho útil en un
 * teléfono de 375px) y vuelve a 24px desde `sm`.
 */
export function AdminPage({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 p-4 sm:p-6 w-full min-w-0', className)}>
      {children}
    </div>
  )
}

/**
 * Encabezado de pantalla: título, subtítulo (normalmente el conteo de resultados)
 * y acciones.
 *
 * En móvil el título y las acciones van en filas separadas — ponerlos lado a lado
 * dejaba los botones de ~90px comprimidos contra el borde. Desde `sm` vuelven a la
 * misma línea, que es como se ve hoy en escritorio.
 */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 truncate">
          {title}
        </h1>
        {subtitle && (
          <div className="text-sm text-neutral-500 mt-0.5">{subtitle}</div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}

/**
 * Fila de pestañas que en móvil se desplaza en horizontal en vez de partirse.
 * Partir las pestañas en dos renglones rompe la metáfora de "carpetas" y deja el
 * borde inferior a media altura.
 */
export function AdminTabs({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-200 -mx-4 sm:mx-0 px-4 sm:px-0">
      <div className="flex gap-1 overflow-x-auto no-scrollbar">{children}</div>
    </div>
  )
}

export function AdminTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 sm:px-4 py-2 min-h-[44px] text-sm font-medium transition-colors border-b-2 -mb-px',
        'flex items-center gap-1.5 whitespace-nowrap flex-shrink-0',
        active
          ? 'border-amber-500 text-amber-700'
          : 'border-transparent text-neutral-500 hover:text-neutral-800',
      )}
    >
      {children}
    </button>
  )
}
