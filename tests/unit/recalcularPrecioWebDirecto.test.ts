import { describe, it, expect } from 'vitest'
import { recalcularPrecioWebDirecto, type WebDirectoServicio } from '@/lib/priceCalculator'

const ml = (s: string) => ({ es: s, en: s })

function servicio(overrides: Partial<WebDirectoServicio> = {}): WebDirectoServicio {
  return {
    esCompartido: false,
    esPorHoras: false,
    esAeropuerto: false,
    aplicaRecargoNocturno: false,
    montoRecargoNocturno: null,
    recargoNocturnoInicio: null,
    recargoNocturnoFin: null,
    configuracion: { camposCustom: [] },
    vehiculosPermitidos: [{ vehiculoId: 'v1', precio: 100000, precioOlaya: null }],
    ...overrides,
  }
}

describe('recalcularPrecioWebDirecto — paridad con el wizard', () => {
  it('servicio por vehículo: precio del vehículo seleccionado', () => {
    const r = recalcularPrecioWebDirecto({
      servicio: servicio(), vehiculoId: 'v1', numeroPasajeros: 2, hora: '10:00', datosDinamicos: {},
    })
    expect(r).toEqual({ precioBase: 100000, precioAdicionales: 0, recargoNocturno: 0, tarifaMunicipio: 0 })
  })

  it('vehículo inexistente → precio base 0', () => {
    const r = recalcularPrecioWebDirecto({
      servicio: servicio(), vehiculoId: 'nope', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {},
    })
    expect(r.precioBase).toBe(0)
  })

  it('aeropuerto Olaya: usa precioOlaya cuando existe', () => {
    const s = servicio({ esAeropuerto: true, vehiculosPermitidos: [{ vehiculoId: 'v1', precio: 100000, precioOlaya: 130000 }] })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {}, aeropuertoNombre: 'OLAYA_HERRERA',
    })
    expect(r.precioBase).toBe(130000)
  })

  it('aeropuerto JMC: usa precio normal aunque haya precioOlaya', () => {
    const s = servicio({ esAeropuerto: true, vehiculosPermitidos: [{ vehiculoId: 'v1', precio: 100000, precioOlaya: 130000 }] })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {}, aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
    })
    expect(r.precioBase).toBe(100000)
  })

  it('aeropuerto Olaya sin precioOlaya → fallback a precio', () => {
    const s = servicio({ esAeropuerto: true, vehiculosPermitidos: [{ vehiculoId: 'v1', precio: 100000, precioOlaya: null }] })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {}, aeropuertoNombre: 'OLAYA_HERRERA',
    })
    expect(r.precioBase).toBe(100000)
  })

  it('por horas: precio × horas', () => {
    const s = servicio({ esPorHoras: true })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, cantidadHoras: 4, hora: '10:00', datosDinamicos: {},
    })
    expect(r.precioBase).toBe(400000)
  })

  it('compartido: precio del cupo × pasajeros, resto en 0', () => {
    const s = servicio({ esCompartido: true, vehiculosPermitidos: [{ vehiculoId: 'v1', precio: 80000 }] })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 3, hora: '10:00', datosDinamicos: {},
    })
    expect(r).toEqual({ precioBase: 240000, precioAdicionales: 0, recargoNocturno: 0, tarifaMunicipio: 0 })
  })

  it('campos dinámicos: COUNTER + SWITCH + SELECT', () => {
    const s = servicio({
      configuracion: {
        camposCustom: [
          { clave: 'almuerzos', etiqueta: ml('Almuerzos'), tipo: 'COUNTER', requerido: false, orden: 0, tienePrecio: true, precioUnitario: 10000, min: 0, step: 1 },
          { clave: 'guia', etiqueta: ml('Guía'), tipo: 'SWITCH', requerido: false, orden: 1, tienePrecio: true, precioUnitario: 50000 },
          { clave: 'plan', etiqueta: ml('Plan'), tipo: 'SELECT', requerido: false, orden: 2, tienePrecio: true, precioUnitario: 1, opciones: [{ valor: 'premium', etiqueta: ml('Premium'), precio: 20000 }] },
        ],
      },
    })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00',
      datosDinamicos: { almuerzos: 3, guia: true, plan: 'premium' },
    })
    // 3×10000 + 50000 + 20000
    expect(r.precioAdicionales).toBe(100000)
    expect(r.precioBase).toBe(100000)
  })

  it('recargo nocturno dentro de rango se aplica', () => {
    const s = servicio({ aplicaRecargoNocturno: true, montoRecargoNocturno: 30000, recargoNocturnoInicio: '22:00', recargoNocturnoFin: '06:00' })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '23:30', datosDinamicos: {},
    })
    expect(r.recargoNocturno).toBe(30000)
  })

  it('recargo nocturno fuera de rango no se aplica', () => {
    const s = servicio({ aplicaRecargoNocturno: true, montoRecargoNocturno: 30000, recargoNocturnoInicio: '22:00', recargoNocturnoFin: '06:00' })
    const r = recalcularPrecioWebDirecto({
      servicio: s, vehiculoId: 'v1', numeroPasajeros: 1, hora: '12:00', datosDinamicos: {},
    })
    expect(r.recargoNocturno).toBe(0)
  })

  it('tarifa de municipio viene de MunicipioConfig', () => {
    const r = recalcularPrecioWebDirecto({
      servicio: servicio(), vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {},
      municipio: 'OTRO', municipioConfigId: 'cfg1', municipioConfigRecargo: 15000,
    })
    expect(r.tarifaMunicipio).toBe(15000)
    expect(r.precioBase).toBe(100000)
  })

  it('municipio OTRO sin config → todo en 0 (cotización manual)', () => {
    const r = recalcularPrecioWebDirecto({
      servicio: servicio(), vehiculoId: 'v1', numeroPasajeros: 1, hora: '10:00', datosDinamicos: {},
      municipio: 'OTRO', municipioConfigId: null,
    })
    expect(r).toEqual({ precioBase: 0, precioAdicionales: 0, recargoNocturno: 0, tarifaMunicipio: 0 })
  })
})
