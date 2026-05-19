import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/conductores
 * Listar conductores
 * Query params: ?activo=true, ?disponible=true
 */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        const where: any = {};

        // Filtro activo
        const activoParam = searchParams.get('activo');
        if (activoParam !== null) {
            where.activo = activoParam === 'true';
        }

        // Filtro disponible
        const disponibleParam = searchParams.get('disponible');
        if (disponibleParam !== null) {
            where.disponible = disponibleParam === 'true';
        }

        const conductores = await prisma.conductor.findMany({
            where,
            include: {
                _count: {
                    select: { reservas: true },
                },
            },
            orderBy: {
                nombre: 'asc',
            },
        });

        return NextResponse.json({ data: conductores });
    } catch (error) {
        console.error('Error fetching conductores:', error);
        return NextResponse.json(
            { error: 'Error al obtener conductores' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/conductores
 * Crear conductor (ADMIN)
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validar campos requeridos
        const requiredFields = ['nombre', 'whatsapp', 'telefono', 'documento', 'placa'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo requerido: ${field}` },
                    { status: 400 }
                );
            }
        }

        const conductor = await prisma.conductor.create({
            data: {
                nombre: body.nombre,
                whatsapp: body.whatsapp,
                telefono: body.telefono,
                documento: body.documento,
                placa: body.placa,
                foto: body.foto || null,
                fotosVehiculo: body.fotosVehiculo || [],
                activo: body.activo !== undefined ? body.activo : true,
                disponible: body.disponible !== undefined ? body.disponible : true,
            },
        });

        return NextResponse.json(
            {
                data: conductor,
                message: 'Conductor creado exitosamente',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating conductor:', error);
        return NextResponse.json(
            { error: 'Error al crear conductor' },
            { status: 500 }
        );
    }
}
