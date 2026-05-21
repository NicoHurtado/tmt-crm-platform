import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateBoldHash } from '@/lib/bold';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { reservaId, pedidoId } = await req.json();

        // Debe proporcionar reservaId O pedidoId
        if (!reservaId && !pedidoId) {
            return NextResponse.json(
                { error: 'reservaId or pedidoId is required' },
                { status: 400 }
            );
        }

        let orderId: string;
        let finalAmount: number;
        let entityType: 'reserva' | 'pedido';

        // Caso 1: Pedido (múltiples servicios)
        if (pedidoId) {
            const pedido = await prisma.pedido.findUnique({
                where: { id: pedidoId },
            });

            if (!pedido) {
                return NextResponse.json(
                    { error: 'Pedido not found' },
                    { status: 404 }
                );
            }

            // Verificar que el pedido necesita pago
            if (pedido.estadoPago !== 'PENDIENTE') {
                return NextResponse.json(
                    { error: 'Pedido no requiere pago o ya fue pagado' },
                    { status: 400 }
                );
            }

            orderId = pedido.codigo;
            finalAmount = Math.round(Number(pedido.precioTotal));
            entityType = 'pedido';
        }
        // Caso 2: Reserva individual
        else {
            const reserva = await prisma.reserva.findUnique({
                where: { id: reservaId },
            });

            if (!reserva) {
                return NextResponse.json(
                    { error: 'Reserva not found' },
                    { status: 404 }
                );
            }

            // Verificar que la reserva necesita pago
            if (reserva.estado !== 'PENDING_PAYMENT' && reserva.estado !== 'PAYMENT_FAILED') {
                return NextResponse.json(
                    { error: 'Reserva no requiere pago o ya fue pagada' },
                    { status: 400 }
                );
            }

            orderId = reserva.codigo;
            // reserva.precioTotal already includes the Bold commission (added at creation
            // in /api/reservas POST). Re-adding it here was charging customers 6% twice
            // whenever the tracking page regenerated the hash.
            finalAmount = Math.round(Number(reserva.precioTotal));
            entityType = 'reserva';
        }

        // Generar hash de Bold
        const hash = generateBoldHash(orderId, finalAmount, 'COP');

        // Guardar hash en la base de datos
        if (entityType === 'pedido') {
            await prisma.pedido.update({
                where: { id: pedidoId },
                data: { hashPago: hash },
            });
        } else {
            await prisma.reserva.update({
                where: { id: reservaId },
                data: { hashPago: hash },
            });
        }

        return NextResponse.json({
            success: true,
            hash,
            orderId,
            amount: finalAmount,
            currency: 'COP',
            entityType,
        });
    } catch (error) {
        console.error('Generate hash error:', error);
        return NextResponse.json(
            { error: 'Failed to generate payment hash', details: String(error) },
            { status: 500 }
        );
    }
}
