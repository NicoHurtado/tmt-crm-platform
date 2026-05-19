import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva } from '@prisma/client';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reservaId, servicioId, estrellas, comentario, nombreCliente } = body;

        // Validations
        if (!reservaId || !servicioId || !estrellas || !nombreCliente) {
            return NextResponse.json(
                { error: 'Campos requeridos: reservaId, servicioId, estrellas, nombreCliente' },
                { status: 400 }
            );
        }

        if (estrellas < 1 || estrellas > 5) {
            return NextResponse.json(
                { error: 'Las estrellas deben estar entre 1 y 5' },
                { status: 400 }
            );
        }

        // Check if reservation exists and is completed
        const reserva = await prisma.reserva.findUnique({
            where: { id: reservaId },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        if (reserva.estado !== EstadoReserva.COMPLETED) {
            return NextResponse.json(
                { error: 'Solo se pueden calificar reservas completadas' },
                { status: 400 }
            );
        }

        // Check if already rated
        const existingRating = await prisma.calificacion.findUnique({
            where: { reservaId },
        });

        if (existingRating) {
            return NextResponse.json(
                { error: 'Esta reserva ya ha sido calificada' },
                { status: 400 }
            );
        }

        // Create rating
        const calificacion = await prisma.calificacion.create({
            data: {
                reservaId,
                servicioId,
                estrellas,
                comentario: comentario || null,
                nombreCliente,
                esPublica: true, // Public by default
            },
        });

        return NextResponse.json(
            {
                data: calificacion,
                message: 'Calificación enviada exitosamente'
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating calificacion:', error);
        return NextResponse.json(
            { error: 'Error al crear calificación' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // Try with new fields first (after migration)
        try {
            const calificaciones = await prisma.calificacion.findMany({
                include: {
                    servicio: true,
                },
                orderBy: [
                    { destacada: 'desc' }, // Featured first
                    { createdAt: 'desc' },
                ],
            });
            return NextResponse.json({ data: calificaciones });
        } catch (orderError) {
            // If destacada field doesn't exist yet (migration not run), use simple ordering
            console.log('Using fallback ordering (migration may not have run yet)');
            const calificaciones = await prisma.calificacion.findMany({
                include: {
                    servicio: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            return NextResponse.json({ data: calificaciones });
        }
    } catch (error) {
        console.error('Error fetching calificaciones:', error);
        return NextResponse.json(
            { error: 'Error al obtener calificaciones' },
            { status: 500 }
        );
    }
}
