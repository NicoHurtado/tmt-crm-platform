import { describe, it, expect } from 'vitest'
import {
  categoriaDeServicio,
  modeloPrecioDeServicio,
  type ServicioCategorizable,
} from '@/lib/servicio-categoria'

const base: ServicioCategorizable = {
  esAeropuerto: false,
  esCompartido: false,
  esMunicipal: false,
  esTraslado: false,
  esPorHoras: false,
  tipoTarifa: null,
}

describe('categoriaDeServicio', () => {
  it('servicio sin flags → OTRO', () => {
    expect(categoriaDeServicio(base)).toBe('OTRO')
  })

  it('por horas (sin otro flag) cae en OTRO, igual que la UI actual', () => {
    expect(categoriaDeServicio({ ...base, esPorHoras: true })).toBe('OTRO')
  })

  it('esMunicipal gana sobre todo', () => {
    expect(categoriaDeServicio({ ...base, esMunicipal: true, esAeropuerto: true })).toBe('MUNICIPAL')
  })

  it('esAeropuerto → AEROPUERTO', () => {
    expect(categoriaDeServicio({ ...base, esAeropuerto: true })).toBe('AEROPUERTO')
  })

  it('aeropuerto tiene prioridad sobre tipoTarifa por persona', () => {
    expect(categoriaDeServicio({ ...base, esAeropuerto: true, tipoTarifa: 'POR_PERSONA' })).toBe('AEROPUERTO')
  })

  it('tipoTarifa POR_PERSONA → TOUR_PERSONA', () => {
    expect(categoriaDeServicio({ ...base, tipoTarifa: 'POR_PERSONA' })).toBe('TOUR_PERSONA')
  })

  it('por persona tiene prioridad sobre compartido', () => {
    expect(categoriaDeServicio({ ...base, tipoTarifa: 'POR_PERSONA', esCompartido: true })).toBe('TOUR_PERSONA')
  })

  it('esCompartido → COMPARTIDO', () => {
    expect(categoriaDeServicio({ ...base, esCompartido: true })).toBe('COMPARTIDO')
  })

  it('compartido tiene prioridad sobre traslado', () => {
    expect(categoriaDeServicio({ ...base, esCompartido: true, esTraslado: true })).toBe('COMPARTIDO')
  })

  it('esTraslado → TRASLADO', () => {
    expect(categoriaDeServicio({ ...base, esTraslado: true })).toBe('TRASLADO')
  })

  it('resuelve tipoTarifa desde configuracion JSON (shape Prisma)', () => {
    expect(
      categoriaDeServicio({ ...base, tipoTarifa: undefined, configuracion: { tipoTarifa: 'POR_PERSONA' } }),
    ).toBe('TOUR_PERSONA')
  })

  it('configuracion sin tipoTarifa → no es por persona', () => {
    expect(
      categoriaDeServicio({ ...base, tipoTarifa: undefined, configuracion: { camposCustom: [] } }),
    ).toBe('OTRO')
  })
})

describe('modeloPrecioDeServicio', () => {
  it('default → POR_VEHICULO', () => {
    expect(modeloPrecioDeServicio(base)).toBe('POR_VEHICULO')
  })

  it('aeropuerto → POR_VEHICULO (precio dual sigue siendo por vehículo)', () => {
    expect(modeloPrecioDeServicio({ ...base, esAeropuerto: true })).toBe('POR_VEHICULO')
  })

  it('traslado y municipal → POR_VEHICULO', () => {
    expect(modeloPrecioDeServicio({ ...base, esTraslado: true })).toBe('POR_VEHICULO')
    expect(modeloPrecioDeServicio({ ...base, esMunicipal: true })).toBe('POR_VEHICULO')
  })

  it('esPorHoras → POR_HORAS', () => {
    expect(modeloPrecioDeServicio({ ...base, esPorHoras: true })).toBe('POR_HORAS')
  })

  it('esCompartido → COMPARTIDO_POR_PERSONA', () => {
    expect(modeloPrecioDeServicio({ ...base, esCompartido: true })).toBe('COMPARTIDO_POR_PERSONA')
  })

  it('tipoTarifa POR_PERSONA → POR_PERSONA_TRAMOS (gana sobre compartido y horas)', () => {
    expect(
      modeloPrecioDeServicio({ ...base, tipoTarifa: 'POR_PERSONA', esCompartido: true, esPorHoras: true }),
    ).toBe('POR_PERSONA_TRAMOS')
  })

  it('compartido tiene prioridad sobre por horas', () => {
    expect(modeloPrecioDeServicio({ ...base, esCompartido: true, esPorHoras: true })).toBe('COMPARTIDO_POR_PERSONA')
  })
})
