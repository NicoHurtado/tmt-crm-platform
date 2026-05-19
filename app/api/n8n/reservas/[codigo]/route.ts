import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalizedText } from '@/types/multi-language';
import { checkApiKey, unauthorized } from '../../_auth';
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
        aeropuerto: r.servicio?.esAeropuerto ? {
            ...(() => { const d = getDatos(r.datos); return { tipo: d.aeropuertoTipo, nombre: d.aeropuertoNombre, numeroVuelo: d.numeroVuelo, lugarRecogida: d.lugarRecogida }; })(),
        } : undefined,
        asistentes: (r.asistentes || []).map((a: any) => ({
            nombre: a.nombre,
            tipoDocumento: a.tipoDocumento,
            numeroDocumento: a.numeroDocumento,
            email: a.email,
            telefono: a.telefono,
        })),
    };
}

/** GET /api/n8n/reservas/[codigo] */
export async function GET(
    request: NextRequest,
    { params }: { params: { codigo: string } }
) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const reserva = await prisma.reserva.findUnique({
            where: { codigo: params.codigo },
            include: { servicio: true, vehiculo: true, conductor: true, aliado: true, asistentes: true },
        });

        if (!reserva) {
            return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: formatReserva(reserva) });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

/**
 * PATCH /api/n8n/reservas/[codigo]
 * Allows n8n to update: estado, conductorId, notas, clientePaga
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { codigo: string } }
) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const body = await request.json();
        const updateData: any = {};

        const VALID_ESTADOS = [
            'PENDING_PAYMENT',
            'CONFIRMED_UNASSIGNED',
            'CONFIRMED_ASSIGNED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'PAYMENT_FAILED',
        ] as const;

        if (body.estado !== undefined) {
            if (!VALID_ESTADOS.includes(body.estado)) {
                return NextResponse.json({ error: `Estado inválido: ${body.estado}` }, { status: 400 });
            }
            updateData.estado = body.estado;
        }
        if (body.conductorId !== undefined) updateData.conductorId = body.conductorId || null;
        if (body.notas !== undefined) updateData.notas = body.notas || null;
        if (body.clientePaga !== undefined) updateData.clientePaga = body.clientePaga === null ? null : Boolean(body.clientePaga);

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        const reserva = await prisma.reserva.update({
            where: { codigo: params.codigo },
            data: updateData,
            include: { servicio: true, vehiculo: true, conductor: true, aliado: true, asistentes: true },
        });

        return NextResponse.json({ success: true, data: formatReserva(reserva) });
    } catch (error: any) {
        if (error?.code === 'P2025') {
            return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
