import { describe, it, expect } from 'vitest';
import { buildServicioDetalle } from '@/lib/n8n/buildServicioDetalle';
import type { ServicioContextData } from '@/lib/n8n/formatServicioContext';

const svc: ServicioContextData = {
  id: 'svc1', tipoServicio: 'OTRO',
  nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
  descripcion: { es: 'Día completo', en: 'Full day' },
  incluye: { es: 'Guía y transporte', en: 'Guide and transport' },
  duracion: '8h',
  aplicaRecargoNocturno: true, recargoNocturnoInicio: '22:00', recargoNocturnoFin: '06:00', montoRecargoNocturno: 50000,
  esPorHoras: false, esMunicipal: false, esAeropuerto: false, esCompartido: false, esTraslado: false,
  configuracion: { camposCustom: [{ clave: 'almuerzos', tipo: 'COUNTER', etiqueta: { es: 'Almuerzos', en: 'Lunches' }, requerido: false, orden: 1, min: 0, max: 10, tienePrecio: true, precioUnitario: 30000 }] } as any,
  vehiculosPermitidos: [{ precio: 350000, precioOlaya: null, vehiculo: { nombre: 'Van', capacidadMinima: 1, capacidadMaxima: 8 } }],
};

describe('buildServicioDetalle', () => {
  it('devuelve nombre, incluye, duración, recargo y adicionales con precio', () => {
    const d = buildServicioDetalle(svc, 'https://www.medellintransportes.com');
    expect(d.id).toBe('svc1');
    expect(d.nombre.es).toBe('Tour Guatapé');
    expect(d.incluye.es).toContain('Guía');
    expect(d.duracion).toBe('8h');
    expect(d.recargoNocturno.aplica).toBe(true);
    expect(d.recargoNocturno.monto).toBe(50000);
    expect(d.adicionales[0]).toMatchObject({ clave: 'almuerzos', precioUnitario: 30000 });
    expect(d.linkReserva).toContain('serviceId=svc1');
  });

  it('sin adicionales con precio ni recargo → arrays/flags vacíos', () => {
    const minimal = { ...svc, configuracion: { camposCustom: [] }, aplicaRecargoNocturno: false } as ServicioContextData;
    const d = buildServicioDetalle(minimal, 'https://x');
    expect(d.adicionales).toEqual([]);
    expect(d.recargoNocturno.aplica).toBe(false);
  });
});
