import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// GET - Obtener tarifas de municipios para un aliado
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const tarifas = await prisma.tarifaMunicipioAliado.findMany({
            where: { aliadoId: id }
        });

        return NextResponse.json({
            success: true,
            data: tarifas
        });
    } catch (error) {
        console.error('Error fetching tarifas municipios:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener tarifas de municipios' },
            { status: 500 }
        );
    }
}

// PUT - Actualizar todas las tarifas de municipios
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id: aliadoId } = params;
        const body = await request.json();
        const { tarifas } = body; // Array de { municipio, valorExtra }

        if (!Array.isArray(tarifas)) {
            return NextResponse.json(
                { success: false, error: 'tarifas must be an array' },
                { status: 400 }
            );
        }

        // Eliminar tarifas existentes
        await prisma.tarifaMunicipioAliado.deleteMany({
            where: { aliadoId }
        });

        // Crear nuevas tarifas (solo las que tienen valor > 0)
        const tarifasValidas = tarifas.filter((t: any) =>
            t.valorExtra && parseFloat(t.valorExtra) > 0
        );

        if (tarifasValidas.length > 0) {
            await prisma.tarifaMunicipioAliado.createMany({
                data: tarifasValidas.map((t: any) => ({
                    aliadoId,
                    municipio: t.municipio,
                    valorExtra: parseFloat(t.valorExtra)
                }))
            });
        }

        // Obtener tarifas actualizadas
        const updated = await prisma.tarifaMunicipioAliado.findMany({
            where: { aliadoId }
        });

        return NextResponse.json({
            success: true,
            data: updated
        });
    } catch (error) {
        console.error('Error updating tarifas municipios:', error);
        return NextResponse.json(
            { success: false, error: 'Error al actualizar tarifas de municipios' },
            { status: 500 }
        );
    }
}
