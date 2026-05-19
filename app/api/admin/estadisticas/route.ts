import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CONFIRMED_STATES = [
  'CONFIRMED_UNASSIGNED',
  'CONFIRMED_ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 'YYYY-MM' or null

    let dateFilter: { gte: Date; lt: Date } | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number);
      dateFilter = {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      };
    }

    // Fetch reservas with relations (filtered by month when provided)
    const reservas = await prisma.reserva.findMany({
      where: dateFilter ? { fecha: dateFilter } : {},
      select: {
        id: true,
        fecha: true,
        numeroPasajeros: true,
        precioTotal: true,
        comisionAliado: true,
        metodoPago: true,
        estado: true,
        esReservaAliado: true,
        clientePaga: true,
        aliado: { select: { id: true, nombre: true, tipo: true } },
        servicio: { select: { nombre: true, tipoServicio: true } },
        vehiculo: { select: { capacidadMinima: true, capacidadMaxima: true } },
      },
    });

    // Historical reservas for monthly charts (always all-time)
    const historicalReservas = dateFilter
      ? await prisma.reserva.findMany({
          select: {
            fecha: true,
            precioTotal: true,
            numeroPasajeros: true,
            comisionAliado: true,
            estado: true,
          },
        })
      : reservas;

    const isConfirmed = (r: { estado: string }) =>
      CONFIRMED_STATES.includes(r.estado);

    const confirmedReservas = reservas.filter(isConfirmed);

    // ── RESUMEN ─────────────────────────────────────────────────────────
    const totalReservas = reservas.length;
    const personasTransportadas = confirmedReservas.reduce(
      (s, r) => s + (r.numeroPasajeros || 0),
      0,
    );
    const ingresosTotales = confirmedReservas.reduce(
      (s, r) => s + Number(r.precioTotal || 0),
      0,
    );
    const comisionTotalGeneral = confirmedReservas.reduce(
      (s, r) => s + Number(r.comisionAliado || 0),
      0,
    );

    const monthlyMap: Record<string, { cantidad: number; ingresos: number }> = {};
    historicalReservas.forEach((r) => {
      const d = new Date(r.fecha);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { cantidad: 0, ingresos: 0 };
      monthlyMap[key].cantidad++;
      monthlyMap[key].ingresos += Number(r.precioTotal || 0);
    });
    const reservasPorMes = Object.entries(monthlyMap)
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const reservasTarjeta = confirmedReservas.filter((r) => r.metodoPago === 'TARJETA').length;
    const reservasEfectivo = confirmedReservas.filter((r) => r.metodoPago === 'EFECTIVO').length;

    // ── SERVICIOS ───────────────────────────────────────────────────────
    const servicioMap: Record<string, number> = {};
    const tipoMap: Record<string, number> = {};
    const capacidadMap: Record<string, { reservas: number; personas: number }> = {};

    reservas.forEach((r) => {
      const rawNombre = r.servicio?.nombre;
      let nombre = 'Sin servicio';
      if (rawNombre) {
        nombre =
          typeof rawNombre === 'object'
            ? ((rawNombre as Record<string, string>).es ||
              (rawNombre as Record<string, string>).en ||
              'Sin nombre')
            : String(rawNombre);
      }
      servicioMap[nombre] = (servicioMap[nombre] || 0) + 1;

      const tipo = r.servicio?.tipoServicio || 'OTRO';
      tipoMap[tipo] = (tipoMap[tipo] || 0) + 1;

      if (r.vehiculo) {
        const { capacidadMinima, capacidadMaxima } = r.vehiculo;
        const label =
          capacidadMinima === capacidadMaxima
            ? `${capacidadMinima} pax`
            : `${capacidadMinima}–${capacidadMaxima} pax`;
        if (!capacidadMap[label]) capacidadMap[label] = { reservas: 0, personas: 0 };
        capacidadMap[label].reservas++;
        if (isConfirmed(r)) {
          capacidadMap[label].personas += r.numeroPasajeros || 0;
        }
      }
    });

    const reservasPorServicio = Object.entries(servicioMap)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const reservasPorTipo = Object.entries(tipoMap)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const personasPorCapacidad = Object.entries(capacidadMap)
      .map(([capacidad, v]) => ({ capacidad, ...v }))
      .sort((a, b) => b.personas - a.personas);

    // ── FINANCIERO ───────────────────────────────────────────────────────
    const pagosBold = confirmedReservas
      .filter((r) => {
        const isIndependent = !r.esReservaAliado;
        const isAirbnb = r.esReservaAliado && r.aliado?.tipo === 'AIRBNB';
        return isIndependent || isAirbnb;
      })
      .reduce((s, r) => s + Number(r.precioTotal || 0), 0);

    const pagosEfectivo = confirmedReservas
      .filter(
        (r) =>
          r.esReservaAliado &&
          (r.aliado?.tipo === 'HOTEL' || r.aliado?.tipo === 'AGENCIA'),
      )
      .reduce((s, r) => s + Number(r.precioTotal || 0), 0);

    const comisionesHotel = confirmedReservas
      .filter(
        (r) =>
          r.esReservaAliado &&
          (r.aliado?.tipo === 'HOTEL' || r.aliado?.tipo === 'AGENCIA'),
      )
      .reduce((s, r) => s + Number(r.comisionAliado || 0), 0);

    const comisionesAirbnb = confirmedReservas
      .filter((r) => r.esReservaAliado && r.aliado?.tipo === 'AIRBNB')
      .reduce((s, r) => s + Number(r.comisionAliado || 0), 0);

    const aliadoReservas = reservas.filter((r) => r.esReservaAliado);
    const clientePagaCount = aliadoReservas.filter((r) => r.clientePaga).length;
    const clienteNoPagaCount = aliadoReservas.filter((r) => !r.clientePaga).length;

    const ingresosMesMap: Record<string, number> = {};
    const personasMesMap: Record<string, number> = {};
    const comisionMesMap: Record<string, number> = {};

    historicalReservas.forEach((r) => {
      const d = new Date(r.fecha);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      ingresosMesMap[key] = (ingresosMesMap[key] || 0) + Number(r.precioTotal || 0);
      if (CONFIRMED_STATES.includes(r.estado)) {
        personasMesMap[key] = (personasMesMap[key] || 0) + (r.numeroPasajeros || 0);
        comisionMesMap[key] = (comisionMesMap[key] || 0) + Number(r.comisionAliado || 0);
      }
    });

    const ingresosPorMes = Object.entries(ingresosMesMap)
      .map(([mes, ingresos]) => ({ mes, ingresos }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const personasPorMes = Object.entries(personasMesMap)
      .map(([mes, personas]) => ({ mes, personas }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const comisionPorMes = Object.entries(comisionMesMap)
      .map(([mes, comision]) => ({ mes, comision }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // ── ALIADOS ───────────────────────────────────────────────────────────
    const aliadosMap: Record<
      string,
      { id: string; nombre: string; tipo: string; reservas: number; ingresos: number; comision: number }
    > = {};

    reservas
      .filter((r) => r.esReservaAliado && r.aliado)
      .forEach((r) => {
        const aid = r.aliado!.id;
        if (!aliadosMap[aid]) {
          aliadosMap[aid] = {
            id: aid,
            nombre: r.aliado!.nombre,
            tipo: r.aliado!.tipo,
            reservas: 0,
            ingresos: 0,
            comision: 0,
          };
        }
        aliadosMap[aid].reservas++;
        if (isConfirmed(r)) {
          aliadosMap[aid].ingresos += Number(r.precioTotal || 0);
          aliadosMap[aid].comision += Number(r.comisionAliado || 0);
        }
      });

    const aliadosStats = Object.values(aliadosMap).sort(
      (a, b) => b.reservas - a.reservas,
    );

    return NextResponse.json({
      totalReservas,
      personasTransportadas,
      ingresosTotales,
      comisionTotalGeneral,
      reservasPorMes,
      reservasTarjeta,
      reservasEfectivo,
      reservasPorServicio,
      reservasPorTipo,
      personasPorCapacidad,
      pagosBold,
      pagosEfectivo,
      comisionesHotel,
      comisionesAirbnb,
      clientePagaCount,
      clienteNoPagaCount,
      ingresosPorMes,
      personasPorMes,
      comisionPorMes,
      aliadosStats,
    });
  } catch (error) {
    console.error('[estadisticas] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
