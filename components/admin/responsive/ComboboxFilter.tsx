'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

/**
 * Selector con buscador para listas largas (servicios, aliados…).
 *
 * Mantiene su estado de apertura por dentro a propósito: `FilterShell` monta los
 * filtros dos veces (barra de escritorio + sheet móvil), y si el `open` viniera
 * de la página las dos copias abrirían su portal al mismo tiempo y el popover
 * escondido aparecería flotando sobre la pantalla.
 */
export function ComboboxFilter({
  value,
  onChange,
  options,
  allLabel,
  allValue = 'ALL',
  searchPlaceholder = 'Buscar...',
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  allLabel: string
  allValue?: string
  searchPlaceholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-11 lg:h-9 text-sm border-neutral-200 bg-white font-normal justify-between px-3',
            className,
          )}
        >
          <span className="truncate text-left">
            {value !== allValue ? (selected?.label ?? allLabel) : allLabel}
          </span>
          <ChevronsUpDown size={13} className="ml-2 shrink-0 text-neutral-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-10 text-sm" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-neutral-400">
              Sin resultados
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange(allValue)
                  setOpen(false)
                }}
                className="text-sm min-h-[40px]"
              >
                <Check
                  size={13}
                  className={cn('mr-2', value === allValue ? 'opacity-100' : 'opacity-0')}
                />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className="text-sm min-h-[40px]"
                >
                  <Check
                    size={13}
                    className={cn(
                      'mr-2 shrink-0',
                      value === o.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
