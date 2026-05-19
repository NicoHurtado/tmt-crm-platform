import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalizedText } from '@/types/multi-language';
import { checkApiKey, unauthorized } from '../_auth';
import { getDatos } from '@/types/reserva-datos';

export const dynamic = 'force-dynamic';

function formatReserva(r: any) {
    return {
        id: r.id,
        codigo: r.codigo,
        estado: r.estado,
        estadoPago: r.estadoPago,
        metodoPago: r.metodoPago,
        fecha: r.fecha,
        hora: r.hora,
        municipio: r.municipio,
        otroMunicipio: r.otroMunicipio,
        numeroPasajeros: r.numeroPasajeros,
        idioma: r.idioma,
        clientePaga: r.clientePaga,
        esCotizacion: r.esCotizacion,
        esReservaAliado: r.esReservaAliado,
        esPedido: r.esPedido,
        notas: r.notas,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        cliente: {
            nombre: r.nombreCliente,
            whatsapp: r.whatsappCliente,
            email: r.emailCliente,
        },
        servicio: r.servicio ? {
            id: r.servicio.id,
            nombre: getLocalizedText(r.servicio.nombre, 'ES'),
            nombreEN: getLocalizedText(r.servicio.nombre, 'EN'),
            esAeropuerto: r.servicio.esAeropuerto,
        } : null,
        vehiculo: r.vehiculo ? {
            id: r.vehiculo.id,
            nombre: r.vehiculo.nombre,
            capacidad: `${r.vehiculo.capacidadMinima}–${r.vehiculo.capacidadMaxima}`,
        } : null,
        conductor: r.conductor ? {
            id: r.conductor.id,
            nombre: r.conductor.nombre,
            whatsapp: r.conductor.whatsapp,
            placa: r.conductor.placa,
        } : null,
        aliado: r.aliado ? {
            id: r.aliado.id,
            nombre: r.aliado.nombre,
            codigo: r.aliado.codigo,
            tipo: r.aliado.tipo,
        } : null,
        precios: {
            precioBase: Number(r.precioBase),
            precioAdicionales: Number(r.precioAdicionales),
            recargoNocturno: Number(r.recargoNocturno),
            tarifaMunicipio: Number(r.tarifaMunicipio),
            descuentoAliado: Number(r.descuentoAliado),
            comisionAliado: Number(r.comisionAliado),
            precioTotal: Number(r.precioTotal),
        },
        aeropuerto: r.servicio?.esAeropuerto ? (() => { const d = getDatos(r.datos); return { tipo: d.aeropuertoTipo, nombre: d.aeropuertoNombre, numeroVuelo: d.numeroVuelo, lugarRecogida: d.lugarRecogida }; })() : undefined,
        asistentes: (r.asistentes || []).map((a: any) => ({
            nombre: a.nombre,
            tipoDocumento: a.tipoDocumento,
            numeroDocumento: a.numeroDocumento,
        })),
    };
}

/**
 * GET /api/n8n/reservas
 * Query params: estado, fecha (YYYY-MM-DD), desde, hasta, servicioTipo
 */
export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const { searchParams } = new URL(request.url);
        const where: any = {};

        const estado = searchParams.get('estado');
        if (estado) where.estado = estado;

        const fecha = searchParams.get('fecha');
        if (fecha) {
            const d = new Date(fecha + 'T00:00:00.000Z');
            where.fecha = { gte: d, lt: new Date(d.getTime() + 86400000) };
        }

        const desde = searchParams.get('desde');
        const hasta = searchParams.get('hasta');
        if (desde || hasta) {
            where.fecha = {};
            if (desde) where.fecha.gte = new Date(desde + 'T00:00:00.000Z');
            if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59.000Z');
        }

        const servicioTipo = searchParams.get('servicioTipo');
        if (servicioTipo) where.servicio = { tipo: servicioTipo };

        const reservas = await prisma.reserva.findMany({
            where,
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                aliado: true,
                asistentes: true,
            },
            orderBy: [{ fecha: 'desc' }, { hora: 'asc' }],
        });

        return NextResponse.json({
            success: true,
            count: reservas.length,
            data: reservas.map(formatReserva),
        });
    } catch (error) {
        console.error('[n8n] GET /reservas error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
