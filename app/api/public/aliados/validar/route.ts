import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { codigo } = body;

        if (!codigo) {
            return NextResponse.json(
                { error: 'Código requerido' },
                { status: 400 }
            );
        }

        const aliado = await prisma.aliado.findUnique({
            where: { codigo },
            select: {
                id: true,
                nombre: true,
                codigo: true,
                tipo: true,
            },
        });

        if (!aliado) {
            return NextResponse.json(
                { error: 'Código no válido' },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: aliado });
    } catch (error) {
        console.error('Error validando aliado:', error);
        return NextResponse.json(
            { error: 'Error al validar aliado' },
            { status: 500 }
        );
    }
}
