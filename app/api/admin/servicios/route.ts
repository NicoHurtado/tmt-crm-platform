import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MultiLangTextSchema, MultiLangArraySchema } from '@/types/multi-language';
import { buildConfiguracion, getConfiguracion } from '@/types/servicio-config';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/servicios
 * List all services with pagination and filters
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const esMunicipalParam = searchParams.get('esMunicipal');
        const activo = searchParams.get('activo');

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (esMunicipalParam !== null && esMunicipalParam !== undefined) {
            where.esMunicipal = esMunicipalParam === 'true';
        }

        if (activo !== null && activo !== undefined) {
            where.activo = activo === 'true';
        }

        // Fetch services
        let servicios = await prisma.servicio.findMany({
            where,
            skip: search ? undefined : skip, // Si hay búsqueda, no paginamos aún
            take: search ? undefined : limit,
            orderBy: [{ orden: 'asc' }, { createdAt: 'desc' }],
            include: {
                vehiculosPermitidos: {
                    include: {
                        vehiculo: true,
                    },
                },
                _count: {
                    select: {
                        reservas: true,
                    },
                },
            },
        });

        // Filtrar por búsqueda en memoria (ya que nombre es JSON)
        // Busca SOLO en los nombres de los servicios
        if (search) {
            const searchLower = search.toLowerCase();
            servicios = servicios.filter((servicio: any) => {
                const nombreEs = (servicio.nombre as any)?.es?.toLowerCase() || '';
                const nombreEn = (servicio.nombre as any)?.en?.toLowerCase() || '';
                
                return nombreEs.includes(searchLower) || nombreEn.includes(searchLower);
            });
        }

        const total = servicios.length;

        // Aplicar paginación después del filtro
        if (search) {
            servicios = servicios.slice(skip, skip + limit);
        }

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

        return NextResponse.json({
            success: true,
            data: enriched,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        return NextResponse.json(
            { error: 'Error al obtener servicios' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/servicios
 * Create a new service
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await req.json();

        const {
            nombre,
            descripcion,
            imagen,
            duracion,
            incluye,
            aplicaRecargoNocturno,
            recargoNocturnoInicio,
            recargoNocturnoFin,
            montoRecargoNocturno,
            esAeropuerto,
            esTraslado,
            esPorHoras,
            esCompartido,
            esMunicipal,
            destinoAutoFill,
            infoTourCompartido,
            camposPersonalizados,
            guiaEspanolDisponible,
            precioGuiaEspanol,
            guiaInglesDisponible,
            precioGuiaIngles,
            vehiculos,
            orden,
            tipoTarifa,
            preciosPorPersona,
        } = body;

        // Validate required fields
        if (!nombre || !descripcion || !imagen) {
            return NextResponse.json(
                { error: 'Campos requeridos faltantes' },
                { status: 400 }
            );
        }

        // Validate multi-language format
        try {
            MultiLangTextSchema.parse(nombre);
            MultiLangTextSchema.parse(descripcion);
            MultiLangArraySchema.parse(incluye);
        } catch (error) {
            return NextResponse.json(
                { error: 'Formato multi-idioma inválido. Asegúrate de proporcionar texto en español e inglés.' },
                { status: 400 }
            );
        }

        // Create service
        const servicio = await prisma.servicio.create({
            data: {
                nombre,
                descripcion,
                imagen,
                duracion,
                incluye: incluye || [],
                aplicaRecargoNocturno: aplicaRecargoNocturno || false,
                recargoNocturnoInicio: aplicaRecargoNocturno ? recargoNocturnoInicio : null,
                recargoNocturnoFin: aplicaRecargoNocturno ? recargoNocturnoFin : null,
                montoRecargoNocturno: aplicaRecargoNocturno ? montoRecargoNocturno : null,
                esAeropuerto: esAeropuerto || false,
                esTraslado: esTraslado || false,
                esPorHoras: esPorHoras || false,
                esCompartido: esCompartido || false,
                esMunicipal: esMunicipal || false,
                destinoAutoFill: destinoAutoFill || null,
                configuracion: buildConfiguracion(
                    camposPersonalizados || [],
                    esCompartido ? infoTourCompartido : null,
                    { tipoTarifa: tipoTarifa ?? null, preciosPorPersona: preciosPorPersona ?? null },
                ) as any,
                guiaEspanolDisponible: guiaEspanolDisponible || false,
                precioGuiaEspanol: guiaEspanolDisponible ? precioGuiaEspanol : null,
                guiaInglesDisponible: guiaInglesDisponible || false,
                precioGuiaIngles: guiaInglesDisponible ? precioGuiaIngles : null,
                orden: orden !== undefined ? parseInt(orden) : 999,
                activo: true,
                vehiculosPermitidos: vehiculos
                    ? {
                        create: vehiculos.map((v: any) => {
                            const precio = Number(v.precio);
                            if (!Number.isFinite(precio) || precio <= 0) {
                                throw new Error('Cada vehículo del servicio requiere un precio mayor a 0');
                            }
                            const precioOlaya =
                                v.precioOlaya != null && Number.isFinite(Number(v.precioOlaya)) && Number(v.precioOlaya) > 0
                                    ? Number(v.precioOlaya)
                                    : null;
                            return {
                                vehiculoId: v.vehiculoId,
                                precio,
                                precioOlaya,
                            };
                        }),
                    }
                    : undefined,
            },
            include: {
                vehiculosPermitidos: {
                    include: {
                        vehiculo: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: servicio,
        });
    } catch (error) {
        console.error('Error creating service:', error);
        return NextResponse.json(
            { error: 'Error al crear servicio' },
            { status: 500 }
        );
    }
}
