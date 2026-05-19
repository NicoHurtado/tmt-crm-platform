import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/vehiculos
 * List all vehicles
 */
export async function GET(req: NextRequest) {
    try {
        const vehiculos = await prisma.vehiculo.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
        });

        return NextResponse.json({
            success: true,
            data: vehiculos,
        });
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        return NextResponse.json(
            { error: 'Error al obtener vehículos' },
            { status: 500 }
        );
    }
}
