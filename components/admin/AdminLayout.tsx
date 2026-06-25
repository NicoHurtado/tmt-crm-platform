'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  Calendar,
  BookOpen,
  FileText,
  Users,
  User,
  Truck,
  Package,
  BarChart2,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { name: 'Reservas',     href: '/admin/dashboard/reservas',    icon: BookOpen },
  { name: 'Cotizaciones', href: '/admin/dashboard/cotizaciones', icon: FileText },
  { name: 'Calendario',   href: '/admin/dashboard/calendario',   icon: Calendar  },
  { name: 'Estadísticas', href: '/admin/dashboard/estadisticas', icon: BarChart2 },
  { name: 'Servicios',    href: '/admin/dashboard/servicios',    icon: Package   },
  { name: 'Vehículos',    href: '/admin/dashboard/vehiculos',    icon: Truck    },
  { name: 'Aliados',      href: '/admin/dashboard/aliados',      icon: Users    },
  { name: 'Conductores',  href: '/admin/dashboard/conductores',  icon: User     },
  { name: 'Estado General', href: '/admin/dashboard/estado-general', icon: FileSpreadsheet },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Portals (Select, Dialog, Sheet) render into <body> directly, inheriting Ciabatta.
  // Override body font to Inter while inside admin so all portals use the correct font.
  useEffect(() => {
    const prev = document.body.style.fontFamily
    document.body.style.fontFamily = 'var(--font-sans)'
    return () => { document.body.style.fontFamily = prev }
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setExpanded(true)
  }

  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => setExpanded(false), 180)
  }

  const isActive = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-sans)] flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar — hover to expand, overlays content */}
      <aside
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={cn(
          'fixed top-0 left-0 h-screen z-50 flex-col bg-neutral-900 text-neutral-100',
          'transition-[width] duration-200 ease-in-out',
          'hidden lg:flex border-r border-neutral-800 overflow-hidden',
          expanded ? 'w-60' : 'w-16',
        )}
      >
        {/* Header */}
        <div className="flex items-center h-14 px-4 border-b border-neutral-800 flex-shrink-0 overflow-hidden">
          <div className="flex flex-col min-w-0">
            <span
              className={cn(
                'text-sm font-semibold text-amber-400 leading-tight whitespace-nowrap transition-opacity duration-150',
                expanded ? 'opacity-100' : 'opacity-0',
              )}
            >
              TMT Admin
            </span>
            <span
              className={cn(
                'text-[10px] text-neutral-500 whitespace-nowrap transition-opacity duration-150',
                expanded ? 'opacity-100' : 'opacity-0',
              )}
            >
              Transportes Medellín
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.name : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors whitespace-nowrap',
                  active
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800',
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span
                  className={cn(
                    'transition-opacity duration-150',
                    expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Footer links + Sign out */}
        <div className="p-2 border-t border-neutral-800 flex-shrink-0 space-y-0.5">
          <Link
            href="/admin/dashboard/terminos"
            title={!expanded ? 'Términos y Condiciones' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 w-full rounded-md text-sm transition-colors whitespace-nowrap',
              pathname.startsWith('/admin/dashboard/terminos')
                ? 'bg-amber-500/10 text-amber-400 font-medium'
                : 'text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800',
            )}
          >
            <ScrollText size={16} className="flex-shrink-0" />
            <span
              className={cn(
                'transition-opacity duration-150',
                expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            >
              Términos y Condiciones
            </span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            title={!expanded ? 'Cerrar Sesión' : undefined}
            className="flex items-center gap-2.5 px-2.5 py-2 w-full rounded-md text-sm text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-colors whitespace-nowrap"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span
              className={cn(
                'transition-opacity duration-150',
                expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
              )}
            >
              Cerrar Sesión
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen w-60 z-50 flex flex-col bg-neutral-900 text-neutral-100',
          'transition-transform duration-200 border-r border-neutral-800 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 border-b border-neutral-800 h-14 flex-shrink-0">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-amber-400 leading-tight">TMT Admin</span>
            <span className="text-[10px] text-neutral-500">Transportes Medellín</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800',
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-neutral-800 flex-shrink-0 space-y-0.5">
          <Link
            href="/admin/dashboard/terminos"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 w-full rounded-md text-sm transition-colors',
              pathname.startsWith('/admin/dashboard/terminos')
                ? 'bg-amber-500/10 text-amber-400 font-medium'
                : 'text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800',
            )}
          >
            <ScrollText size={16} />
            <span>Términos y Condiciones</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="flex items-center gap-2.5 px-2.5 py-2 w-full rounded-md text-sm text-neutral-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 flex items-center px-4 lg:hidden flex-shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md hover:bg-neutral-100 text-neutral-600 transition-colors"
        >
          <Menu size={18} />
        </button>
        <span className="ml-3 text-sm font-semibold text-amber-500">TMT Admin</span>
      </div>

      {/* Fixed spacer — always w-16 so content never shifts on hover */}
      <div className="hidden lg:block flex-shrink-0 w-16" />

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-screen pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
