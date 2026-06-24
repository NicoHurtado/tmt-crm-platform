// lib/n8n/buildServicioDetalle.ts
import { getConfiguracion } from '@/types/servicio-config';
import { validateDynamicFields } from '@/types/dynamic-fields';
import type { ServicioContextData } from './formatServicioContext';

function asEsEn(value: unknown): { es: string; en: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return { es: typeof v.es === 'string' ? v.es : '', en: typeof v.en === 'string' ? v.en : '' };
  }
  return { es: '', en: '' };
}

export interface ServicioDetalle {
  id: string;
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  incluye: { es: string; en: string };
  duracion: string | null;
  esAeropuerto: boolean;
  esPorPersona: boolean;
  recargoNocturno: { aplica: boolean; inicio?: string | null; fin?: string | null; monto?: number | null };
  adicionales: { clave: string; etiqueta: string; tipo: string; precioUnitario: number }[];
  vehiculos: { nombre: string; capacidadMinima: number; capacidadMaxima: number }[];
  linkReserva: string;
}

export function buildServicioDetalle(svc: ServicioContextData, appUrl?: string): ServicioDetalle {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
  const cfg = getConfiguracion(svc.configuracion);
  const campos = validateDynamicFields(cfg.camposCustom);
  const adicionales = campos
    .filter((c) => c.tienePrecio && c.precioUnitario && c.precioUnitario > 0)
    .map((c) => ({
      clave: c.clave,
      etiqueta: asEsEn(c.etiqueta).es,
      tipo: c.tipo,
      precioUnitario: Number(c.precioUnitario),
    }));
  return {
    id: svc.id,
    nombre: asEsEn(svc.nombre),
    descripcion: asEsEn(svc.descripcion),
    incluye: asEsEn(svc.incluye),
    duracion: svc.duracion,
    esAeropuerto: !!svc.esAeropuerto,
    esPorPersona: cfg.tipoTarifa === 'POR_PERSONA',
    recargoNocturno:
      svc.aplicaRecargoNocturno && svc.montoRecargoNocturno
        ? { aplica: true, inicio: svc.recargoNocturnoInicio, fin: svc.recargoNocturnoFin, monto: Number(svc.montoRecargoNocturno) }
        : { aplica: false },
    adicionales,
    vehiculos: svc.vehiculosPermitidos.map((v) => ({
      nombre: v.vehiculo.nombre,
      capacidadMinima: v.vehiculo.capacidadMinima,
      capacidadMaxima: v.vehiculo.capacidadMaxima,
    })),
    linkReserva: `${base}/reservas?serviceId=${svc.id}&form=1`,
  };
}
