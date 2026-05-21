import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkApiKey, unauthorized } from '../_auth';
import { buildFullSystemPrompt, type ServicioContextData } from '@/lib/n8n/formatServicioContext';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const rawServicios = await prisma.servicio.findMany({
            where: { activo: true },
            include: {
                vehiculosPermitidos: {
                    where: { vehiculo: { activo: true } },
                    include: { vehiculo: true },
                },
                tarifasMunicipios: true,
                adicionales: {
                    where: { activo: true },
                },
            },
            orderBy: { orden: 'asc' },
        });

        const servicios: ServicioContextData[] = rawServicios.map((s) => ({
            id: s.id,
            tipoServicio: s.tipoServicio,
            nombre: s.nombre,
            descripcion: s.descripcion,
            incluye: s.incluye,
            duracion: s.duracion,
            precioBase: Number(s.precioBase),
            aplicaRecargoNocturno: s.aplicaRecargoNocturno,
            recargoNocturnoInicio: s.recargoNocturnoInicio ?? null,
            recargoNocturnoFin: s.recargoNocturnoFin ?? null,
            montoRecargoNocturno: s.montoRecargoNocturno ? Number(s.montoRecargoNocturno) : null,
            esPorHoras: s.esPorHoras,
            esMunicipal: s.esMunicipal,
            configuracion: s.configuracion,
            vehiculosPermitidos: s.vehiculosPermitidos.map((sv) => ({
                precio: sv.precio ? Number(sv.precio) : null,
                vehiculo: {
                    nombre: sv.vehiculo.nombre,
                    capacidadMinima: sv.vehiculo.capacidadMinima,
                    capacidadMaxima: sv.vehiculo.capacidadMaxima,
                    precioBase: Number(sv.vehiculo.precioBase),
                },
            })),
            tarifasMunicipios: s.tarifasMunicipios.map((t) => ({
                municipio: t.municipio,
                valorExtra: Number(t.valorExtra),
            })),
            adicionales: s.adicionales.map((a) => ({
                nombre: a.nombre,
                precio: Number(a.precio),
                incluidoPorDefecto: a.incluidoPorDefecto,
            })),
        }));

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
        const systemPrompt = buildFullSystemPrompt(servicios, appUrl);

        return NextResponse.json({
            systemPrompt,
            updatedAt: new Date().toISOString(),
            serviciosCount: servicios.length,
        });
    } catch (error) {
        console.error('[contexto-servicios]', error);
        return NextResponse.json({ error: 'Error al obtener contexto de servicios' }, { status: 500 });
    }
}
