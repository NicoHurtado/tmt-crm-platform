import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // CR-04: require admin session — this endpoint exposes all reservations for an aliado
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = {
            aliadoId: params.id,
        };

        // Date filtering
        if (startDate && endDate) {
            where.fecha = {
                gte: startOfDay(new Date(startDate)),
                lte: endOfDay(new Date(endDate)),
            };
        } else if (startDate) {
            where.fecha = {
                gte: startOfDay(new Date(startDate)),
            };
        }

        const reservas = await prisma.reserva.findMany({
            where,
            orderBy: {
                fecha: 'desc',
            },
            include: {
                servicio: {
                    select: {
                        nombre: true,
                    },
                },
                vehiculo: {
                    select: {
                        nombre: true,
                    },
                },
                conductor: {
                    select: {
                        nombre: true,
                    },
                },
                asistentes: true,
                adicionalesSeleccionados: {
                    include: {
                        adicional: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: reservas,
        });
    } catch (error) {
        console.error('Error fetching ally reservations:', error);
        return NextResponse.json(
            { error: 'Error al obtener reservas' },
            { status: 500 }
        );
    }
}
