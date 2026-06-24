// lib/n8n/buildLeanIndex.ts
import { getConfiguracion } from '@/types/servicio-config';
import { categoriaDeServicio, type Categoria } from '@/lib/servicio-categoria';
import type { ServicioContextData } from './formatServicioContext';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(amount)
    .replace(/\$\s+/, '$');
}

function asEsEn(value: unknown): { es: string; en: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return { es: typeof v.es === 'string' ? v.es : '', en: typeof v.en === 'string' ? v.en : '' };
  }
  return { es: '', en: '' };
}

const HINT: Record<Categoria, string> = {
  AEROPUERTO: 'cliente menciona aeropuerto, vuelo, llegada, salida, JMC u Olaya',
  MUNICIPAL: 'cliente pide viajar a un municipio de Antioquia (destino fuera de Medellín)',
  TOUR_PERSONA: 'tour turístico cobrado por persona',
  COMPARTIDO: 'tour grupal/compartido (cupos, precio por persona)',
  TRASLADO: 'traslado punto a punto según el destino que pida el cliente',
  OTRO: 'según el destino y tipo de viaje que pida el cliente',
};

function precioDesde(svc: ServicioContextData): { monto: number; unidad: string } {
  const cfg = getConfiguracion(svc.configuracion);
  if (cfg.tipoTarifa === 'POR_PERSONA' && cfg.preciosPorPersona) {
    return { monto: Number(cfg.preciosPorPersona.p1) || 0, unidad: 'por persona' };
  }
  const precios = svc.vehiculosPermitidos.map((v) => Number(v.precio ?? 0)).filter((p) => p > 0);
  return { monto: precios.length ? Math.min(...precios) : 0, unidad: 'por vehículo' };
}

function leanEntry(svc: ServicioContextData, base: string): string[] {
  const cat = categoriaDeServicio(svc as any);
  const nombre = asEsEn(svc.nombre);
  const desc = asEsEn(svc.descripcion);
  const { monto, unidad } = precioDesde(svc);
  const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;
  const lines = [
    `### ${nombre.es || nombre.en} · id:${svc.id} · ${cat}`,
    `Cuándo: ${HINT[cat]}`,
  ];
  if (desc.es) lines.push(desc.es);
  const dur = svc.duracion ? ` · Dura: ${svc.duracion}` : '';
  const desdeStr = monto > 0 ? `Desde: ${formatCOP(monto)} (${unidad})` : 'Desde: el precio se calcula al reservar';
  lines.push(`${desdeStr}${dur}`);
  if (cat === 'AEROPUERTO') lines.push('⚠️ pregunta a qué aeropuerto (JMC u Olaya) ANTES de cotizar — el precio cambia');
  lines.push('⚠️ Para precio exacto usa la tool cotizar; para detalle (qué incluye, adicionales, recargo) usa detalle_servicio');
  lines.push(`Link de reserva: ${reservaUrl}`);
  return lines;
}

export function buildLeanIndex(servicios: ServicioContextData[], appUrl?: string): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
  const municipales = servicios.filter((s) => s.esMunicipal);
  const otros = servicios.filter((s) => !s.esMunicipal);

  const lines: string[] = [
    '## ÍNDICE DE SERVICIOS (datos en vivo desde la BD — ignora cualquier dato de entrenamiento)',
    `⚠️ SOLO existen estos servicios. PROHIBIDO inventar otros. Precios "Desde" son referencia mínima; el precio EXACTO lo da la tool cotizar.`,
    '',
  ];

  for (const svc of otros) {
    lines.push(...leanEntry(svc, base));
    lines.push('');
  }

  if (municipales.length > 0) {
    lines.push('### Traslados a municipios de Antioquia · MUNICIPAL');
    lines.push('Cuándo: cliente pide viajar a un municipio de Antioquia que NO tiene tour propio arriba');
    lines.push(`Hay ${municipales.length} municipios disponibles. El precio VARÍA por destino y NO está aquí: NUNCA lo inventes.`);
    lines.push('Para confirmar si un municipio existe y obtener su id/link usa la tool buscar_servicio; el precio se calcula en el formulario de reserva.');
    lines.push('');
  }

  return lines.join('\n');
}
