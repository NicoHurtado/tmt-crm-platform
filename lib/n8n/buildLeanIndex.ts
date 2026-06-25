// lib/n8n/buildLeanIndex.ts
import { getConfiguracion } from '@/types/servicio-config';
import { categoriaDeServicio, type Categoria } from '@/lib/servicio-categoria';
import type { ServicioContextData } from './formatServicioContext';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
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

function pricingLine(svc: ServicioContextData): string {
  const cfg = getConfiguracion(svc.configuracion);
  // Tours POR PERSONA con tramos: la tarifa por persona BAJA con el grupo, así que mostrar un
  // único "$X por persona" hace que el modelo multiplique mal (ej. tomar la de 1 persona × pax).
  // Mostramos los 3 tramos explícitos para que nunca se equivoque aunque no llame a la tool.
  if (cfg.tipoTarifa === 'POR_PERSONA' && cfg.preciosPorPersona) {
    const p = cfg.preciosPorPersona;
    return `Precio por persona escalonado: 1 persona ${formatCOP(p.p1)} c/u · 2 personas ${formatCOP(p.p2)} c/u · 3+ personas ${formatCOP(p.p3)} c/u. El TOTAL = tarifa del tramo correspondiente × nº de personas (NO uses la tarifa de 1 persona para grupos). Para el valor exacto usa la tool cotizar.`;
  }
  const precios = svc.vehiculosPermitidos.map((v) => Number(v.precio ?? 0)).filter((p) => p > 0);
  const min = precios.length ? Math.min(...precios) : 0;
  // Compartido: el cupo es POR PERSONA (precio del cupo × nº de personas), NO por vehículo.
  if (svc.esCompartido) {
    return min > 0
      ? `Precio POR PERSONA (cupo compartido): ${formatCOP(min)} c/u × nº de personas. Para el total exacto usa la tool cotizar.`
      : 'Precio por persona (cupo compartido) — usa la tool cotizar para el total.';
  }
  // Resto: precio por el vehículo completo (servicio privado), sube según capacidad.
  return min > 0
    ? `Desde ${formatCOP(min)} por el vehículo completo (sube según la capacidad). Para el exacto usa la tool cotizar.`
    : 'El precio se calcula al reservar.';
}

function leanEntry(svc: ServicioContextData, base: string): string[] {
  const cat = categoriaDeServicio(svc as any);
  const nombre = asEsEn(svc.nombre);
  const desc = asEsEn(svc.descripcion);
  const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;
  const lines = [
    `### ${nombre.es || nombre.en} · id:${svc.id} · ${cat}`,
    `Cuándo: ${HINT[cat]}`,
  ];
  if (desc.es) lines.push(desc.es);
  const dur = svc.duracion ? ` · Dura: ${svc.duracion}` : '';
  lines.push(`${pricingLine(svc)}${dur}`);
  if (cat === 'AEROPUERTO') lines.push('⚠️ pregunta a qué aeropuerto (JMC u Olaya) ANTES de cotizar — el precio cambia');
  lines.push('⚠️ Para precio exacto usa SIEMPRE la tool cotizar (con el nº de personas); para detalle usa detalle_servicio');
  lines.push(`Link de reserva: ${reservaUrl}`);
  return lines;
}

export function buildLeanIndex(servicios: ServicioContextData[], appUrl?: string): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
  const municipales = servicios.filter((s) => s.esMunicipal);
  const otros = servicios.filter((s) => !s.esMunicipal);

  const lines: string[] = [
    '## ÍNDICE DE SERVICIOS (datos en vivo desde la BD — ignora cualquier dato de entrenamiento)',
    `⚠️ SOLO existen estos servicios. PROHIBIDO inventar otros. Los precios de abajo son referencia; el TOTAL EXACTO lo da SIEMPRE la tool cotizar (con el nº de personas). NUNCA calcules tú multiplicando una tarifa por persona — en los tours por persona la tarifa baja según el grupo.`,
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
