import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateDynamicFields } from '@/types/dynamic-fields';
import { MultiLangTextSchema, MultiLangArraySchema } from '@/types/multi-language';
import { buildConfiguracion, getConfiguracion } from '@/types/servicio-config';
import { categoriaDeServicio, modeloPrecioDeServicio, tipoServicioEstructural } from '@/lib/servicio-categoria';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/servicios/[id]
 * Get service details
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const servicio = await prisma.servicio.findUnique({
            where: { id: params.id },
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

        if (!servicio) {
            return NextResponse.json(
                { error: 'Servicio no encontrado' },
                { status: 404 }
            );
        }

        const cfg = getConfiguracion((servicio as any).configuracion);
        return NextResponse.json({
            success: true,
            data: {
                ...servicio,
                camposPersonalizados: cfg.camposCustom,
                infoTourCompartido: cfg.infoCompartido,
                tipoTarifa: cfg.tipoTarifa ?? null,
                preciosPorPersona: cfg.preciosPorPersona ?? null,
            },
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        return NextResponse.json(
            { error: 'Error al obtener servicio' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/servicios/[id]
 * Update service
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
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
            orden,
            tipoTarifa,
            preciosPorPersona,
            vehiculos, // Array of { vehiculoId, precio? }
        } = body;

        // Validate multi-language format if provided
        if (nombre) {
            try {
                MultiLangTextSchema.parse(nombre);
            } catch (error) {
                return NextResponse.json(
                    { error: 'Formato de nombre multi-idioma inválido' },
                    { status: 400 }
                );
            }
        }

        if (descripcion) {
            try {
                MultiLangTextSchema.parse(descripcion);
            } catch (error) {
                return NextResponse.json(
                    { error: 'Formato de descripción multi-idioma inválido' },
                    { status: 400 }
                );
            }
        }

        if (incluye) {
            try {
                MultiLangArraySchema.parse(incluye);
            } catch (error) {
                return NextResponse.json(
                    { error: 'Formato de incluye multi-idioma inválido' },
                    { status: 400 }
                );
            }
        }

        // Validate dynamic fields if provided
        if (camposPersonalizados) {
            try {
                validateDynamicFields(camposPersonalizados);
            } catch (error) {
                return NextResponse.json(
                    { error: 'Configuración de campos dinámicos inválida', details: error },
                    { status: 400 }
                );
            }
        }

        // Estado actual del servicio: necesario para (a) preservar config no enviada y
        // (b) calcular categoría/modelo con los flags EFECTIVOS (entrante ?? actual),
        // porque un update parcial puede no enviar todos los flags.
        const actual = await prisma.servicio.findUnique({
            where: { id: params.id },
            select: {
                configuracion: true,
                tipoServicio: true,
                esAeropuerto: true,
                esTraslado: true,
                esPorHoras: true,
                esCompartido: true,
                esMunicipal: true,
            },
        });
        const cfgActual = getConfiguracion((actual as any)?.configuracion);

        // Para preservar campos de configuracion no enviados, leer la config actual.
        const configChange = camposPersonalizados !== undefined
            || infoTourCompartido !== undefined
            || tipoTarifa !== undefined
            || preciosPorPersona !== undefined;
        let nuevaConfiguracion: any = undefined;
        if (configChange) {
            nuevaConfiguracion = buildConfiguracion(
                camposPersonalizados !== undefined ? (camposPersonalizados ?? []) : cfgActual.camposCustom,
                infoTourCompartido !== undefined ? (esCompartido ? infoTourCompartido : null) : cfgActual.infoCompartido,
                {
                    tipoTarifa: tipoTarifa !== undefined ? tipoTarifa : cfgActual.tipoTarifa,
                    preciosPorPersona: preciosPorPersona !== undefined ? preciosPorPersona : cfgActual.preciosPorPersona,
                },
            );
        }

        // Flags efectivos = lo enviado, o lo que ya tenía el servicio.
        const flagsEfectivos = {
            esAeropuerto: esAeropuerto !== undefined ? !!esAeropuerto : !!actual?.esAeropuerto,
            esTraslado: esTraslado !== undefined ? !!esTraslado : !!actual?.esTraslado,
            esPorHoras: esPorHoras !== undefined ? !!esPorHoras : !!actual?.esPorHoras,
            esCompartido: esCompartido !== undefined ? !!esCompartido : !!actual?.esCompartido,
            esMunicipal: esMunicipal !== undefined ? !!esMunicipal : !!actual?.esMunicipal,
            tipoTarifa: (tipoTarifa !== undefined ? tipoTarifa : cfgActual.tipoTarifa) as 'POR_PERSONA' | null,
        };
        const categoria = categoriaDeServicio(flagsEfectivos);
        const modeloPrecio = modeloPrecioDeServicio(flagsEfectivos);
        const tipoEstructural = tipoServicioEstructural(flagsEfectivos);

        // Update service
        const servicio = await prisma.servicio.update({
            where: { id: params.id },
            data: {
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
                categoria,
                modeloPrecio,
                // tipoServicio legacy: solo se fija si los flags lo determinan (estructural).
                // Si no, se deja como está para no pisar tipos de tour curados a mano.
                ...(tipoEstructural ? { tipoServicio: tipoEstructural } : {}),
                ...(nuevaConfiguracion !== undefined ? { configuracion: nuevaConfiguracion as any } : {}),
                ...(guiaEspanolDisponible !== undefined ? { guiaEspanolDisponible } : {}),
                ...(precioGuiaEspanol !== undefined ? { precioGuiaEspanol } : {}),
                ...(guiaInglesDisponible !== undefined ? { guiaInglesDisponible } : {}),
                ...(precioGuiaIngles !== undefined ? { precioGuiaIngles } : {}),
                ...(orden !== undefined ? { orden: parseInt(orden) } : {}),
                // Update vehicle relationships
                vehiculosPermitidos: vehiculos
                    ? {
                        deleteMany: {},
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

        const updCfg = getConfiguracion((servicio as any).configuracion);
        return NextResponse.json({
            success: true,
            data: {
                ...servicio,
                camposPersonalizados: updCfg.camposCustom,
                infoTourCompartido: updCfg.infoCompartido,
                tipoTarifa: updCfg.tipoTarifa ?? null,
                preciosPorPersona: updCfg.preciosPorPersona ?? null,
            },
        });
    } catch (error) {
        console.error('Error updating service:', error);
        return NextResponse.json(
            { error: 'Error al actualizar servicio' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/servicios/[id]
 * Delete service
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        // Check if service has reservations
        const reservasCount = await prisma.reserva.count({
            where: { servicioId: params.id },
        });

        if (reservasCount > 0) {
            return NextResponse.json(
                {
                    error: `No se puede eliminar el servicio porque tiene ${reservasCount} reserva(s) asociada(s)`,
                },
                { status: 400 }
            );
        }

        // Delete service (cascade will delete vehiculosPermitidos)
        await prisma.servicio.delete({
            where: { id: params.id },
        });

        return NextResponse.json({
            success: true,
            message: 'Servicio eliminado exitosamente',
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        return NextResponse.json(
            { error: 'Error al eliminar servicio' },
            { status: 500 }
        );
    }
}
