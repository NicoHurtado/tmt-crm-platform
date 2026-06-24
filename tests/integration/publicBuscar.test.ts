import { describe, it, expect } from 'vitest';
import { searchCatalogServices } from '@/lib/api/service-catalog';
import type { CatalogService } from '@/lib/api/service-catalog';

const mk = (id: string, es: string, esMunicipal = false): CatalogService => ({
  id, tipo: 'OTRO', nombre: es, nombreES: es, nombreEN: es,
  descripcion: '', descripcionES: '', descripcionEN: '', incluye: null,
  precioDesde: 100000, tipoTarifa: null, preciosPorPersona: null, duracion: null,
  esAeropuerto: false, esPorHoras: false, esMunicipal, aplicaRecargoNocturno: false,
  recargoNocturno: { aplica: false }, configuracion: { camposCustom: [] },
  linkReserva: `https://x/reservas?serviceId=${id}&form=1`, vehiculos: [],
  precioOrigen: 'ServicioVehiculo.precio', tipoPrecio: 'independiente',
} as any);

describe('searchCatalogServices', () => {
  const catalogo = [mk('a', 'Tour a Guatapé'), mk('b', 'Traslado Jardín', true), mk('c', 'Traslado Urbano')];

  it('encuentra por coincidencia normalizada (sin acentos, case-insensitive)', () => {
    const r = searchCatalogServices(catalogo, 'guatape');
    expect(r.map((s) => s.id)).toContain('a');
  });

  it('devuelve forma liviana con id, nombre, categoría, precioDesde, esMunicipal', () => {
    const r = searchCatalogServices(catalogo, 'jardin');
    expect(r[0]).toMatchObject({ id: 'b', esMunicipal: true });
    expect(r[0]).toHaveProperty('precioDesde');
  });

  it('q vacío → lista vacía', () => {
    expect(searchCatalogServices(catalogo, '')).toEqual([]);
  });
});
