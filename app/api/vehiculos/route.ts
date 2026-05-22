import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 600;

/**
 * GET /api/vehiculos
 * Listar vehículos
 * Query param: ?activo=true
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const activoParam = searchParams.get('activo');
        const activo = activoParam === null ? true : activoParam === 'true';

        const vehiculos = await prisma.vehiculo.findMany({
            where: {
                activo,
            },
            include: {
                // conductor: true, // No existe relación directa
            },
            orderBy: {
                capacidadMinima: 'asc',
            },
        });

        return NextResponse.json({ data: vehiculos }, {
            headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' }
        });
    } catch (error) {
        console.error('Error fetching vehiculos:', error);
        return NextResponse.json(
            { error: 'Error al obtener vehículos' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/vehiculos
 * Crear vehículo (ADMIN)
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
        const requiredFields = ['nombre', 'capacidadMinima', 'capacidadMaxima'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo requerido: ${field}` },
                    { status: 400 }
                );
            }
        }

        const vehiculo = await prisma.vehiculo.create({
            data: {
                nombre: body.nombre,
                capacidadMinima: parseInt(body.capacidadMinima),
                capacidadMaxima: parseInt(body.capacidadMaxima),
                imagen: body.imagen || '',
                activo: body.activo !== undefined ? body.activo : true,
                precioBase: body.precioBase ?? 0,
            },
        });

        return NextResponse.json(
            {
                data: vehiculo,
                message: 'Vehículo creado exitosamente',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating vehiculo:', error);
        return NextResponse.json(
            { error: 'Error al crear vehículo' },
            { status: 500 }
        );
    }
}
