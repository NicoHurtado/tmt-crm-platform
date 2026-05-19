import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva } from '@prisma/client';
import { canCancelReservation } from '@/lib/timeline-states';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params;

        // WR-04: optional email/whatsapp verification.
        // When the client sends { email } in the body we verify it matches the reservation
        // before allowing cancellation, preventing anyone who knows the booking code from cancelling.
        // TODO: update app/tracking/[codigo]/page.tsx handleCancelReservation to send { email } in the body.
        let bodyEmail: string | undefined;
        try {
            const body = await req.json();
            bodyEmail = body?.email?.trim?.() || undefined;
        } catch {
            // no body or non-JSON body — proceed without identity check
        }

        // Find reservation
        const reserva = await prisma.reserva.findUnique({
            where: { codigo },
            include: {
                servicio: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        // Verify caller identity when email is provided
        if (bodyEmail) {
            const emailLower = bodyEmail.toLowerCase();
            const clientEmail = (reserva.emailCliente || '').toLowerCase();
            const clientWhatsapp = (reserva.whatsappCliente || '').toLowerCase();
            if (clientEmail !== emailLower && clientWhatsapp !== emailLower) {
                return NextResponse.json(
                    { error: 'Datos no coinciden con la reserva' },
                    { status: 403 }
                );
            }
        }

        // Check if can be cancelled
        if (!canCancelReservation(reserva.fecha, reserva.estado)) {
            return NextResponse.json(
                { error: 'No se puede cancelar esta reserva. Debe faltar más de 24 horas o el estado no lo permite.' },
                { status: 400 }
            );
        }

        // Update reservation status
        const updatedReserva = await prisma.reserva.update({
            where: { id: reserva.id },
            data: {
                estado: EstadoReserva.CANCELLED,
            },
            include: {
                servicio: true,
                aliado: true,
            },
        });

        // Send cancellation email
        try {
            const { sendCancelacionEmail } = await import('@/lib/email-service');
            await sendCancelacionEmail(updatedReserva as any, reserva.idioma);
        } catch (emailError) {
            console.error('Error sending cancellation email:', emailError);
            // Don't fail the cancellation if email fails
        }

        return NextResponse.json({
            data: updatedReserva,
            message: 'Reserva cancelada exitosamente'
        });
    } catch (error) {
        console.error('Error cancelling reserva:', error);
        return NextResponse.json(
            { error: 'Error al cancelar reserva' },
            { status: 500 }
        );
    }
}
