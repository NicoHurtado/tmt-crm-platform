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
        // CR-04: este endpoint expone todas las reservas de un aliado.
        // Acceso permitido si: (a) sesión admin de NextAuth, o
        // (b) el aliado se identifica con su propio código (lo conoce solo el aliado).
        // Esto mantiene la protección (un id sin el código correcto no autoriza)
        // y permite que cada aliado vea sus reservas sin sesión admin.
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const codigo = searchParams.get('codigo');

        const session = await getServerSession(authOptions);
        if (!session) {
            if (!codigo) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
            const aliado = await prisma.aliado.findUnique({
                where: { id: params.id },
                select: { codigo: true },
            });
            if (!aliado || aliado.codigo !== codigo) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
            }
        }

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
