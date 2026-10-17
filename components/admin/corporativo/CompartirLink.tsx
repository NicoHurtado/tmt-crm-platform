'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, Download, ExternalLink, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { linkEvento } from './link'

/**
 * Bloque para compartir el link corporativo: URL legible, copiar, mensaje listo para
 * WhatsApp y un QR descargable (para pegarlo en el correo o en un letrero en el aeropuerto).
 */
export default function CompartirLink({
  codigo,
  empresa,
  origen,
  destino,
}: {
  codigo: string
  empresa: string
  origen: string
  destino: string
}) {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'link' | 'mensaje' | null>(null)

  useEffect(() => {
    const u = linkEvento(codigo)
    setUrl(u)
    QRCode.toDataURL(u, { width: 480, margin: 1 }).then(setQr).catch(() => setQr(null))
  }, [codigo])

  const mensaje =
    `Hola 👋 Para el transporte ${origen} → ${destino} de ${empresa}, reserva tu cupo aquí ` +
    `y escoge la hora que mejor te sirva según tu vuelo (no tiene costo para ti):\n${url}`

  const copiar = async (texto: string, que: 'link' | 'mensaje') => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(que)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Link para los funcionarios</p>
          <p className="mt-1 font-mono text-sm sm:text-base text-neutral-900 break-all">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => copiar(url, 'link')}>
            {copiado === 'link' ? <Check size={13} /> : <Copy size={13} />} {copiado === 'link' ? 'Copiado' : 'Copiar link'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 bg-white" onClick={() => copiar(mensaje, 'mensaje')}>
            {copiado === 'mensaje' ? <Check size={13} /> : <Copy size={13} />} Copiar mensaje
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 bg-white" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={13} /> Enviar por WhatsApp
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 bg-white" asChild>
            <a href={`/corporativo/${codigo}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> Ver como funcionario
            </a>
          </Button>
        </div>
        <p className="text-xs text-neutral-500 whitespace-pre-line border-l-2 border-amber-300 pl-2">{mensaje}</p>
      </div>
      {qr && (
        <div className="flex sm:flex-col items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR del link ${url}`} className="w-28 h-28 rounded border border-neutral-200 bg-white" />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
            <a href={qr} download={`qr-corporativo-${codigo}.png`}>
              <Download size={12} /> Descargar QR
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}
