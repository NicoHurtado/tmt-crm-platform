import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildConfiguracion, getConfiguracion } from '@/types/servicio-config';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/servicios
 * Lista servicios activos
 * Query param: ?activo=true
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Filtro por activo (por defecto solo activos)
        const activoParam = searchParams.get('activo');
        const activo = activoParam === null ? true : activoParam === 'true';

        // Filtro por esMunicipal (opcional)
        const esMunicipalRaw = searchParams.get('esMunicipal');
        const esMunicipalParam = esMunicipalRaw !== null ? esMunicipalRaw : null;

        // Build where clause
        const where: any = { activo };
        if (esMunicipalParam !== null) {
            where.esMunicipal = esMunicipalParam === 'true';
        }

        const servicios = await prisma.servicio.findMany({
            where,
            include: {
                vehiculosPermitidos: {
                    include: {
                        vehiculo: true
                    }
                }
            }
        });

        // El orden de presentación se decide en el cliente (filas por categoría).
        const enriched = servicios.map((s: any) => {
            const cfg = getConfiguracion(s.configuracion);
            return {
                ...s,
                camposPersonalizados: cfg.camposCustom,
                infoTourCompartido: cfg.infoCompartido,
                tipoTarifa: cfg.tipoTarifa ?? null,
                preciosPorPersona: cfg.preciosPorPersona ?? null,
            };
        });

        return NextResponse.json({ data: enriched, success: true });
    } catch (error) {
        console.error('Error fetching servicios:', error);
        return NextResponse.json(
            { error: 'Error al obtener servicios' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/servicios
 * Crear servicio (ADMIN)
 */
export async function POST(request: Request) {
    try {
        // Verificar auth admin
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validar campos requeridos
        const requiredFields = ['nombre'];

        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `Campo requerido: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Crear servicio
        const servicio = await prisma.servicio.create({
            data: {
                nombre: body.nombre,
                descripcion: body.descripcion || body.descripcionLarga || body.descripcionCorta || '',
                imagen: body.imagen || '',
                duracion: body.duracion || (body.duracionHoras ? `${body.duracionHoras} horas` : null),
                incluye: body.incluye || [],

                // Recargo Nocturno
                aplicaRecargoNocturno: body.aplicaRecargoNocturno || false,
                recargoNocturnoInicio: body.recargoNocturnoInicio || null,
                recargoNocturnoFin: body.recargoNocturnoFin || null,
                montoRecargoNocturno: body.montoRecargoNocturno ? parseFloat(body.montoRecargoNocturno) : null,

                // Special service logic flags
                esAeropuerto: body.esAeropuerto || false,
                esPorHoras: body.esPorHoras || false,
                destinoAutoFill: body.destinoAutoFill || null,

                // Dynamic fields in configuracion JSON
                configuracion: buildConfiguracion(body.camposPersonalizados || []) as any,

                activo: body.activo !== undefined ? body.activo : true,
            },
            include: {
            },
        });

        return NextResponse.json(
            {
                data: servicio,
                message: 'Servicio creado exitosamente',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating servicio:', error);
        return NextResponse.json(
            { error: 'Error al crear servicio' },
            { status: 500 }
        );
    }
}
