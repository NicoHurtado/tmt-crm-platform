import { describe, it, expect } from 'vitest'
import { servicioAFilas, type ServicioLite } from '@/lib/reports/estado-general'

const veh = (nombre: string, min: number, max: number) => ({
  nombre,
  capacidadMinima: min,
  capacidadMaxima: max,
})

const base: ServicioLite = {
  nombre: { es: 'Servicio', en: 'Service' },
  descripcion: { es: 'Desc ES', en: 'Desc EN' },
  incluye: { es: ['Guía', 'Agua'], en: ['Guide', 'Water'] },
  duracion: '4h',
  configuracion: {},
  esAeropuerto: false,
  esTraslado: false,
  esPorHoras: false,
  esCompartido: false,
  esMunicipal: false,
  vehiculosPermitidos: [],
}

describe('servicioAFilas', () => {
  it('POR_VEHICULO emite una fila por vehículo con precio y modalidad', () => {
    const filas = servicioAFilas({
      ...base,
      esTraslado: true,
      vehiculosPermitidos: [
        { precio: 100000, vehiculo: veh('Sedán', 1, 4) },
        { precio: 150000, vehiculo: veh('Van', 5, 8) },
      ],
    })
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ vehiculo: 'Sedán', precio: 100000, modalidad: 'Por vehículo', capacidad: '1–4' })
    expect(filas[1]).toMatchObject({ vehiculo: 'Van', precio: 150000, capacidad: '5–8' })
    expect(filas[0].precioOlaya).toBe('')
    expect(filas[0].descripcionEN).toBe('Desc EN')
    expect(filas[0].incluyeES).toBe('Guía · Agua')
  })

  it('aeropuerto expone precio dual (JMC + Olaya)', () => {
    const filas = servicioAFilas({
      ...base,
      esAeropuerto: true,
      vehiculosPermitidos: [{ precio: 90000, precioOlaya: 70000, vehiculo: veh('Sedán', 4, 4) }],
    })
    expect(filas[0]).toMatchObject({ precio: 90000, precioOlaya: 70000, categoria: 'Transporte al aeropuerto', capacidad: '4' })
  })

  it('aeropuerto sin precioOlaya cae al precio JMC', () => {
    const filas = servicioAFilas({
      ...base,
      esAeropuerto: true,
      vehiculosPermitidos: [{ precio: 90000, precioOlaya: null, vehiculo: veh('Sedán', 4, 4) }],
    })
    expect(filas[0].precioOlaya).toBe(90000)
  })

  it('POR_HORAS marca modalidad por hora', () => {
    const filas = servicioAFilas({
      ...base,
      esPorHoras: true,
      vehiculosPermitidos: [{ precio: 50000, vehiculo: veh('SUV', 1, 6) }],
    })
    expect(filas[0].modalidad).toBe('Por hora')
  })

  it('COMPARTIDO marca modalidad por persona', () => {
    const filas = servicioAFilas({
      ...base,
      esCompartido: true,
      vehiculosPermitidos: [{ precio: 80000, vehiculo: veh('Bus', 1, 15) }],
    })
    expect(filas[0].modalidad).toBe('Compartido — por persona')
  })

  it('POR_PERSONA_TRAMOS emite 3 filas con la tarifa de cada tramo', () => {
    const filas = servicioAFilas({
      ...base,
      configuracion: { tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 300000, p2: 200000, p3: 150000 } },
      vehiculosPermitidos: [{ precio: 0, vehiculo: veh('N/A', 1, 1) }],
    })
    expect(filas).toHaveLength(3)
    expect(filas.map((f) => f.precio)).toEqual([300000, 200000, 150000])
    expect(filas.map((f) => f.modalidad)).toEqual([
      'Por persona — 1 pax',
      'Por persona — 2 pax',
      'Por persona — 3+ pax',
    ])
    expect(filas[0].vehiculo).toBe('Por persona')
  })
})
