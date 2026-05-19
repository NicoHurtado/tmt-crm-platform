import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLocalizedText } from '@/types/multi-language';
import { checkApiKey, unauthorized } from '../_auth';

export const dynamic = 'force-dynamic';

/** GET /api/n8n/servicios — Active services with vehicle pricing */
export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const servicios = await prisma.servicio.findMany({
            where: { activo: true },
            include: {
                vehiculosPermitidos: {
                    include: { vehiculo: true },
                },
            },
            orderBy: { orden: 'asc' },
        });

        const data = servicios.map(s => ({
            id: s.id,
            tipo: s.tipoServicio,
            nombre: getLocalizedText(s.nombre, 'ES'),
            nombreEN: getLocalizedText(s.nombre, 'EN'),
            descripcion: getLocalizedText(s.descripcion, 'ES'),
            precioBase: Number(s.precioBase),
            duracion: s.duracion,
            esAeropuerto: s.esAeropuerto,
            esPorHoras: s.esPorHoras,
            aplicaRecargoNocturno: s.aplicaRecargoNocturno,
            vehiculos: s.vehiculosPermitidos.map(sv => ({
                id: sv.vehiculo.id,
                nombre: sv.vehiculo.nombre,
                capacidadMin: sv.vehiculo.capacidadMinima,
                capacidadMax: sv.vehiculo.capacidadMaxima,
                precio: Number(sv.precio),
            })),
        }));

        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
