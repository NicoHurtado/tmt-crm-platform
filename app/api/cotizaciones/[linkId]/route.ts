import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cotizaciones/[linkId]
 * Obtener datos de una cotización por su link único
 * Endpoint público (no requiere autenticación)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { linkId: string } }
) {
    try {
        const { linkId } = params;

        // Buscar la cotización por linkCotizacion
        const cotizacion = await prisma.reserva.findUnique({
            where: {
                linkCotizacion: linkId
            },
            include: {
                servicio: true,
                vehiculo: true,
                asistentes: true,
                conductor: true,
                aliado: true,
                calificacion: true,
            }
        });

        if (!cotizacion) {
            return NextResponse.json(
                { error: 'Cotización no encontrada' },
                { status: 404 }
            );
        }

        // Verificar que sea realmente una cotización
        if (!cotizacion.esCotizacion) {
            return NextResponse.json(
                { error: 'Este link no corresponde a una cotización válida' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: cotizacion
        });

    } catch (error: any) {
        console.error('❌ Error obteniendo cotización:', error);
        return NextResponse.json(
            { error: error.message || 'Error al obtener cotización' },
            { status: 500 }
        );
    }
}
