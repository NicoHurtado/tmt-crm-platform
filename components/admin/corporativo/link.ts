import { toast } from 'sonner'

export const linkEvento = (codigo: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/corporativo/${codigo}`

export const copiarLink = async (codigo: string) => {
  try {
    await navigator.clipboard.writeText(linkEvento(codigo))
    toast.success('Link copiado')
  } catch {
    toast.error('No se pudo copiar el link')
  }
}

export const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
