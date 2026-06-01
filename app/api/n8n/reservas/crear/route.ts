// app/api/n8n/reservas/crear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkApiKey, unauthorized } from '../../_auth';
import { calculateReservationPrice } from '@/lib/priceCalculator';
import { calculateBoldCommission } from '@/lib/bold';
import { TipoServicio, Municipio, EstadoReserva, EstadoPago } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function generateUniqueCodigo(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo: string;
    let exists = true;
    do {
        codigo = '';
        for (let i = 0; i < 8; i++) {
            codigo += chars.charAt(crypto.randomInt(0, chars.length));
        }
        const existing = await prisma.reserva.findUnique({ where: { codigo } });
        exists = !!existing;
    } while (exists);
    return codigo!;
}

export async function POST(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const body = await request.json();
        const {
            nombreCliente,
            whatsappCliente,
            emailCliente,
            servicioTipo,
            servicioId,
            fecha,
            hora,
            numeroPasajeros,
            idioma = 'ES',
            municipio,
            datosDinamicos = {},
        } = body;

        const missing = ['nombreCliente', 'whatsappCliente', 'emailCliente', 'fecha', 'hora', 'numeroPasajeros']
            .filter((k) => !body[k]);
        if (!servicioTipo && !servicioId) missing.push('servicioTipo o servicioId');
        if (missing.length > 0) {
            return NextResponse.json(
                { success: false, error: `Campos requeridos: ${missing.join(', ')}` },
                { status: 400 }
            );
        }

        if (!Number.isInteger(numeroPasajeros) || numeroPasajeros < 1) {
            return NextResponse.json(
                { success: false, error: 'numeroPasajeros debe ser un número entero mayor a 0' },
                { status: 400 }
            );
        }

        // La fecha debe llegar como YYYY-MM-DD. Se almacena al mediodía UTC
        // (T12:00:00.000Z) para que el día calendario sea idéntico en UTC y en
        // America/Bogota (UTC-5) y no se desplace en el calendario ni en los correos.
        const fechaSolo = typeof fecha === 'string' ? fecha.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaSolo)) {
            return NextResponse.json(
                { success: false, error: 'Fecha inválida. Use formato YYYY-MM-DD' },
                { status: 400 }
            );
        }
        const fechaDate = new Date(fechaSolo + 'T12:00:00.000Z');
        if (isNaN(fechaDate.getTime())) {
            return NextResponse.json(
                { success: false, error: 'Fecha inválida. Use formato YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const servicio = await prisma.servicio.findFirst({
            where: servicioId
                ? { id: servicioId, activo: true }
                : { tipoServicio: servicioTipo as TipoServicio, activo: true },
            include: {
                vehiculosPermitidos: {
                    include: { vehiculo: true },
                },
            },
        });

        if (!servicio) {
            return NextResponse.json({ success: false, error: 'Servicio no disponible' }, { status: 400 });
        }

        const vehiculosOrdenados = [...servicio.vehiculosPermitidos].sort(
            (a, b) => a.vehiculo.capacidadMaxima - b.vehiculo.capacidadMaxima
        );
        const vehiculoEntry = vehiculosOrdenados.find(
            (v) => v.vehiculo.capacidadMaxima >= numeroPasajeros
        );

        if (!vehiculoEntry) {
            return NextResponse.json(
                { success: false, error: `No hay vehículo disponible para ${numeroPasajeros} pasajeros` },
                { status: 400 }
            );
        }

        const cantidadHoras = datosDinamicos?.cantidadHoras as number | undefined;
        const municipioEnum = (municipio as Municipio) ?? ('MEDELLIN' as Municipio);

        const priceBreakdown = await calculateReservationPrice(
            servicio as any,
            vehiculoEntry.vehiculoId,
            datosDinamicos,
            fechaDate,
            hora,
            municipioEnum,
            undefined,
            cantidadHoras
        );

        const camposTotal = priceBreakdown.camposDinamicos.reduce((sum: number, c: any) => sum + c.total, 0);
        const comisionBold = calculateBoldCommission(priceBreakdown.total);
        const precioTotal = priceBreakdown.total + comisionBold;

        const codigo = await generateUniqueCodigo();

        await prisma.reserva.create({
            data: {
                codigo,
                nombreCliente,
                whatsappCliente,
                emailCliente,
                servicioId: servicio.id,
                vehiculoId: vehiculoEntry.vehiculoId,
                fecha: fechaDate,
                hora,
                numeroPasajeros,
                idioma: idioma as 'ES' | 'EN',
                municipio: municipio ? (municipio as Municipio) : null,
                datos: datosDinamicos,
                precioBase: priceBreakdown.precioBase,
                precioAdicionales: camposTotal,
                recargoNocturno: priceBreakdown.recargoNocturno,
                tarifaMunicipio: priceBreakdown.tarifaMunicipio,
                descuentoAliado: 0,
                comisionBold,
                comisionAliado: 0,
                precioTotal,
                estado: EstadoReserva.PENDING_PAYMENT,
                estadoPago: EstadoPago.PENDIENTE,
                metodoPago: 'TARJETA',
                origen: 'web_directa',
                clientePaga: true,
                esReservaAliado: false,
            },
        });

        const nombreServicio =
            (servicio.nombre as { es: string; en: string })[idioma === 'EN' ? 'en' : 'es'];
        const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';

        return NextResponse.json({
            success: true,
            codigo,
            url: `${appUrl}/reservas/confirmar/${codigo}`,
            servicio: nombreServicio,
            precioEstimado: precioTotal,
            fecha,
            hora,
        });
    } catch (error) {
        console.error('[n8n crear reserva]', error);
        return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
    }
}
