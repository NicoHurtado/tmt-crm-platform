import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/corporativo?aliado=<codigo del aliado>
 * Links corporativos abiertos de un aliado, para mostrarlos en su portal (/reservas/<codigo>).
 * Público: solo datos de la ruta, nunca pasajeros ni precios.
 */
export async function GET(req: NextRequest) {
    const codigoAliado = req.nextUrl.searchParams.get('aliado') ?? '';
    if (!codigoAliado) return NextResponse.json({ success: true, data: [] });

    const eventos = await prisma.eventoCorporativo.findMany({
        where: {
            activo: true,
            aliado: { codigo: codigoAliado, activo: true, corporativoActivo: true },
            horarios: { some: { activo: true } },
        },
        orderBy: { createdAt: 'asc' },
        select: {
            codigo: true,
            titulo: true,
            empresa: true,
            origen: true,
            destino: true,
            descripcion: true,
            aeropuertoNombre: true,
            aeropuertoTipo: true,
        },
    });
    return NextResponse.json({ success: true, data: eventos });
}
