'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AliadoQRModalProps {
  open: boolean
  onClose: () => void
  aliado: { nombre: string; codigo: string } | null
}

const QR_SIZE = 280

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'aliado'
}

export default function AliadoQRModal({ open, onClose, aliado }: AliadoQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profileUrl, setProfileUrl] = useState<string | null>(null)

  // El QR abre la página pública de reservas identificada por el código del aliado.
  // No dependemos del montaje del <canvas> en el DOM, que con el diálogo es asíncrono.
  useEffect(() => {
    if (!open || !aliado) {
      setQrDataUrl(null)
      setError(null)
      setProfileUrl(null)
      return
    }
    let cancelled = false
    setError(null)
    setQrDataUrl(null)
    setProfileUrl(null)
    if (!aliado.codigo.trim()) {
      setError('El aliado no tiene un código para abrir su página de reservas.')
      return
    }
    const link = `${window.location.origin}/reservas/${encodeURIComponent(aliado.codigo)}`
    setProfileUrl(link)
    QRCode.toDataURL(link, { width: QR_SIZE, margin: 4 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch((err) => {
        console.error('Error generando QR:', err)
        if (!cancelled) setError('No se pudo generar el QR.')
      })
    return () => {
      cancelled = true
    }
  }, [open, aliado])

  // Compone QR + nombre del aliado como pie, listo para imprimir/compartir.
  const handleDownload = () => {
    if (!qrDataUrl || !aliado) return
    const img = new Image()
    img.onload = () => {
      const padding = 24
      const captionHeight = 56
      const out = document.createElement('canvas')
      out.width = img.width + padding * 2
      out.height = img.height + padding * 2 + captionHeight
      const ctx = out.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, out.width, out.height)
      ctx.drawImage(img, padding, padding)

      ctx.fillStyle = '#0A0A0A'
      ctx.textAlign = 'center'
      ctx.font = '600 20px system-ui, sans-serif'
      ctx.fillText(aliado.nombre, out.width / 2, img.height + padding + 34, out.width - padding * 2)

      const a = document.createElement('a')
      a.href = out.toDataURL('image/png')
      a.download = `qr-${slugify(aliado.codigo || aliado.nombre)}.png`
      a.click()
    }
    img.src = qrDataUrl
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            QR del perfil del aliado
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {aliado && (
            <p className="text-sm text-neutral-500 text-center">
              Al escanear, el huésped abre directamente la página de reservas de{' '}
              <span className="font-medium text-neutral-800">{aliado.nombre}</span>.
            </p>
          )}
          <div className="rounded-lg border border-neutral-200 p-3 bg-white flex items-center justify-center" style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR de reservas de ${aliado?.nombre}`} width={QR_SIZE} height={QR_SIZE} />
            ) : error ? (
              <span className="text-sm text-red-600">{error}</span>
            ) : (
              <span className="text-sm text-neutral-400">Generando…</span>
            )}
          </div>
          {profileUrl && (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-600 underline break-all text-center">
              Abrir página del aliado
            </a>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleDownload} disabled={!qrDataUrl}>
            <Download size={15} className="mr-1.5" />
            Descargar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
