import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/aliados
 * Listar aliados
 * Query param: ?activo=true
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);

        const activoParam = searchParams.get('activo');

        // Build where clause
        const where: any = {};

        // Only filter by active status if explicitly requested
        if (activoParam !== null) {
            where.activo = activoParam === 'true';
        }

        const aliados = await prisma.aliado.findMany({
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

        return NextResponse.json({ data: aliados });
    } catch (error) {
        console.error('Error fetching aliados:', error);
        return NextResponse.json(
            { error: 'Error al obtener aliados' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/aliados
 * Crear aliado (ADMIN)
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
        const requiredFields = ['nombre', 'email', 'contacto'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo requerido: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Generar código único de 6 dígitos
        const codigo = await generateUniqueCodigoAliado();

        const aliado = await prisma.aliado.create({
            data: {
                nombre: body.nombre,
                tipo: body.tipo || 'HOTEL',
                codigo,
                email: body.email,
                contacto: body.contacto,
                imagen: body.imagen || null,
                activo: body.activo !== undefined ? body.activo : true,
            },
        });

        return NextResponse.json(
            {
                data: aliado,
                message: 'Aliado creado exitosamente',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating aliado:', error);
        return NextResponse.json(
            { error: 'Error al crear aliado' },
            { status: 500 }
        );
    }
}

async function generateUniqueCodigoAliado(): Promise<string> {
    let codigo: string;
    let exists = true;

    while (exists) {
        // Generar número de 6 dígitos
        codigo = Math.floor(100000 + Math.random() * 900000).toString();

        const existing = await prisma.aliado.findUnique({
            where: { codigo },
        });

        exists = !!existing;
    }

    return codigo!;
}
