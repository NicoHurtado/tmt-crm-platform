import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva, MetodoPago } from '@prisma/client';
import { sendReservaConfirmadaEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { codigoReserva, metodoPago } = await request.json();

        if (!codigoReserva || !metodoPago) {
            return NextResponse.json(
                { success: false, error: 'Código de reserva y método de pago requeridos' },
                { status: 400 }
            );
        }

        if (metodoPago !== 'EFECTIVO' && metodoPago !== 'TARJETA') {
            return NextResponse.json(
                { success: false, error: 'Método de pago inválido' },
                { status: 400 }
            );
        }

        const reserva = await prisma.reserva.findUnique({
            where: { codigo: codigoReserva },
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                aliado: true,
                asistentes: true,
                adicionalesSeleccionados: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { success: false, error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        if (reserva.estado !== EstadoReserva.PENDING_PAYMENT) {
            return NextResponse.json(
                { success: false, error: 'Esta reserva ya fue procesada' },
                { status: 400 }
            );
        }

        if (metodoPago === 'TARJETA') {
            return NextResponse.json({ success: true, reserva });
        }

        const precioSinBold = Math.max(0, Number(reserva.precioTotal) - Number(reserva.comisionBold ?? 0));

        const updateResult = await prisma.reserva.updateMany({
            where: {
                codigo: codigoReserva,
                estado: EstadoReserva.PENDING_PAYMENT,
            },
            data: {
                metodoPago: 'EFECTIVO' as MetodoPago,
                estado: EstadoReserva.CONFIRMED_UNASSIGNED,
                comisionBold: 0,
                precioTotal: precioSinBold,
            },
        });

        if (updateResult.count === 0) {
            return NextResponse.json(
                { success: false, error: 'Esta reserva ya fue procesada' },
                { status: 409 }
            );
        }

        const updated = await prisma.reserva.findUnique({
            where: { codigo: codigoReserva },
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                aliado: true,
                asistentes: true,
                adicionalesSeleccionados: true,
            },
        });

        if (updated) {
            sendReservaConfirmadaEmail(
                updated as any,
                (updated.idioma as 'ES' | 'EN') ?? 'ES'
            ).catch(console.error);
        }

        return NextResponse.json({ success: true, reserva: updated });
    } catch (error) {
        console.error('[confirmar-metodo-pago]', error);
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
