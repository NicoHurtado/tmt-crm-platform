import { describe, it, expect } from 'vitest';
import { buildLeanIndex } from '@/lib/n8n/buildLeanIndex';
import type { ServicioContextData } from '@/lib/n8n/formatServicioContext';

const baseSvc: ServicioContextData = {
  id: 'svc1',
  tipoServicio: 'OTRO',
  nombre: { es: 'Traslado Urbano', en: 'Urban Transfer' },
  descripcion: { es: 'Movilidad dentro de la ciudad', en: 'City mobility' },
  incluye: { es: 'Conductor', en: 'Driver' },
  duracion: '1h',
  aplicaRecargoNocturno: false,
  recargoNocturnoInicio: null,
  recargoNocturnoFin: null,
  montoRecargoNocturno: null,
  esPorHoras: false,
  esMunicipal: false,
  esAeropuerto: false,
  esCompartido: false,
  esTraslado: true,
  configuracion: { camposCustom: [] },
  vehiculosPermitidos: [
    { precio: 90000, precioOlaya: null, vehiculo: { nombre: 'Sedán', capacidadMinima: 1, capacidadMaxima: 4 } },
  ],
};

describe('buildLeanIndex', () => {
  it('rinde una entrada compacta con id, categoría y "desde" por vehículo', () => {
    const out = buildLeanIndex([baseSvc]);
    expect(out).toContain('id:svc1');
    expect(out).toContain('TRASLADO');
    expect(out).toContain('Traslado Urbano');
    expect(out).toMatch(/\$\s?90\.000/);
    expect(out).toContain('vehículo completo');
    expect(out).not.toContain('Sedán | ');
  });

  it('tour por persona muestra los 3 tramos (1/2/3+) y manda usar cotizar, sin un único "$X por persona" multiplicable', () => {
    const pp: ServicioContextData = {
      ...baseSvc,
      id: 'tourpp',
      tipoServicio: 'OTRO',
      nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
      esTraslado: false,
      vehiculosPermitidos: [],
      configuracion: { camposCustom: [], tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 350000, p2: 300000, p3: 250000 } },
    };
    const out = buildLeanIndex([pp]);
    expect(out).toContain('TOUR_PERSONA');
    // Los 3 tramos visibles para que el modelo no multiplique la tarifa de 1 persona
    expect(out).toMatch(/\$\s?350\.000/); // p1
    expect(out).toMatch(/\$\s?300\.000/); // p2
    expect(out).toMatch(/\$\s?250\.000/); // p3
    expect(out.toLowerCase()).toContain('cotizar');
  });

  it('compartido marca el precio como POR PERSONA × pax (no por vehículo)', () => {
    const comp: ServicioContextData = {
      ...baseSvc,
      id: 'comp',
      esCompartido: true,
      esTraslado: false,
      nombre: { es: 'Tour compartido Guatapé', en: 'Shared Guatapé Tour' },
      vehiculosPermitidos: [
        { precio: 195000, precioOlaya: null, vehiculo: { nombre: 'Van', capacidadMinima: 9, capacidadMaxima: 15 } },
      ],
      configuracion: { camposCustom: [] },
    };
    const out = buildLeanIndex([comp]);
    expect(out).toContain('COMPARTIDO');
    expect(out).toMatch(/\$\s?195\.000/);
    expect(out.toLowerCase()).toContain('por persona');
    expect(out).toContain('× nº de personas');
  });

  it('aeropuerto incluye el aviso de preguntar JMC u Olaya', () => {
    const air: ServicioContextData = { ...baseSvc, id: 'air', esAeropuerto: true, esTraslado: false, nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' } };
    const out = buildLeanIndex([air]);
    expect(out).toContain('AEROPUERTO');
    expect(out).toMatch(/JMC|Olaya/);
  });

  it('agrupa municipios en UNA sola entrada y no lista cada uno', () => {
    const muni = (id: string, nombre: string): ServicioContextData => ({
      ...baseSvc, id, esMunicipal: true, esTraslado: false, tipoServicio: 'TRANSPORTE_MUNICIPAL',
      nombre: { es: nombre, en: nombre }, vehiculosPermitidos: [],
    });
    const out = buildLeanIndex([muni('m1', 'Jardín'), muni('m2', 'Jericó')]);
    const ocurrencias = (out.match(/Traslados a municipios de Antioquia/g) || []).length;
    expect(ocurrencias).toBe(1);
    expect(out).toContain('buscar_servicio');
    expect(out).not.toContain('id:m1');
    expect(out).not.toContain('id:m2');
  });
});
