import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/resend-email
 * Reenviar email de confirmación para una reserva específica
 * Body: { codigo: string }
 * Requiere autenticación de admin
 */
export async function POST(req: NextRequest) {
    try {
        // Verificar autenticación
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { codigo } = body;

        if (!codigo) {
            return NextResponse.json(
                { error: 'Código de reserva requerido' },
                { status: 400 }
            );
        }

        // Buscar la reserva
        const reserva = await prisma.reserva.findUnique({
            where: { codigo },
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
                asistentes: true,
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: `Reserva ${codigo} no encontrada` },
                { status: 404 }
            );
        }

        // Determinar qué tipo de email enviar según el tipo de servicio
        const { sendReservaConfirmadaEmail, sendTourCompartidoConfirmationEmail } = await import('@/lib/email-service');

        let emailType = '';

        if (reserva.servicio?.esCompartido) {
            await sendTourCompartidoConfirmationEmail(reserva as any, reserva.idioma || 'ES');
            emailType = 'Tour Compartido Confirmation';
        } else {
            const aliadoEmail = reserva.aliado?.email || null;
            await sendReservaConfirmadaEmail(reserva as any, reserva.idioma || 'ES', aliadoEmail);
            emailType = 'Reserva Confirmada';
        }

        console.log(`✅ [Resend] Email "${emailType}" reenviado para reserva ${codigo} a ${reserva.emailCliente}`);

        return NextResponse.json({
            success: true,
            message: `Email "${emailType}" reenviado exitosamente`,
            details: {
                codigo: reserva.codigo,
                emailCliente: reserva.emailCliente,
                servicio: reserva.servicio?.tipoServicio,
                emailType,
            }
        });

    } catch (error: any) {
        console.error('❌ [Resend] Error reenviando email:', error);
        return NextResponse.json(
            { error: error.message || 'Error al reenviar email' },
            { status: 500 }
        );
    }
}
