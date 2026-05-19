import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const adicionales = await prisma.servicioAdicional.findMany({
        where: { servicioId: params.id },
        orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, data: adicionales });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();

    const adicional = await prisma.servicioAdicional.create({
        data: {
            servicioId: params.id,
            nombre: body.nombre,
            precio: body.precio || 0,
            tipo: body.tipo || 'FIJO',
            incluidoPorDefecto: body.incluidoPorDefecto || false,
        },
    });

    return NextResponse.json({ success: true, data: adicional });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { adicionalId, ...updates } = body;

    if (!adicionalId) return NextResponse.json({ error: 'adicionalId requerido' }, { status: 400 });

    const adicional = await prisma.servicioAdicional.update({
        where: { id: adicionalId },
        data: {
            ...(updates.nombre !== undefined && { nombre: updates.nombre }),
            ...(updates.precio !== undefined && { precio: updates.precio }),
            ...(updates.incluidoPorDefecto !== undefined && { incluidoPorDefecto: updates.incluidoPorDefecto }),
            ...(updates.activo !== undefined && { activo: updates.activo }),
        },
    });

    return NextResponse.json({ success: true, data: adicional });
}
