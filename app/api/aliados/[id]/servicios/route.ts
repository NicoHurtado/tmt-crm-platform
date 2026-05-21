import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sortServicesByPriority } from '@/lib/service-order';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// GET - Obtener servicios configurados para un aliado
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // 1. Fetch all active services (with their globally-permitted vehicles) and ALL active vehicles
        const [allServicios, allVehiculos] = await Promise.all([
            prisma.servicio.findMany({
                where: { activo: true },
                include: {
                    vehiculosPermitidos: { select: { vehiculoId: true } }
                }
            }),
            prisma.vehiculo.findMany({
                where: { activo: true },
                orderBy: { capacidadMinima: 'asc' }
            })
        ]);

        const sortedServicios = sortServicesByPriority(allServicios);

        // 2. Fetch ServicioAliado records for this aliado
        const serviciosAliado = await prisma.servicioAliado.findMany({
            where: { aliadoId: id },
            include: { preciosVehiculos: true }
        });
        const servicioAliadoMap = new Map(serviciosAliado.map(sa => [sa.servicioId, sa]));

        // 3. Fetch TarifaAliado for this aliado
        const tarifasAliado = await prisma.tarifaAliado.findMany({
            where: { aliadoId: id }
        });
        const tarifasMap = new Map(tarifasAliado.map(t => [t.servicioId, t]));

        // 4. Build response — every service gets ALL platform vehicles
        const data = sortedServicios.map((servicio: any) => {
            const sa = servicioAliadoMap.get(servicio.id);
            const tarifa = tarifasMap.get(servicio.id);

            // Map vehiculoId → saved PrecioVehiculoAliado record
            const preciosVehiculosMap = new Map(
                (sa?.preciosVehiculos ?? []).map((pv: any) => [pv.vehiculoId, pv])
            );

            // Set of vehicles globally permitted for this service (ServicioVehiculo)
            const globallyPermitted = new Set(
                servicio.vehiculosPermitidos.map((sv: any) => sv.vehiculoId)
            );

            // All platform vehicles:
            // - If saved record exists → use pv.activo
            // - Else if vehicle is globally permitted for this service → default true
            // - Else → default false
            const vehiculos = allVehiculos.map((v: any) => {
                const pv = preciosVehiculosMap.get(v.id);
                const defaultActivo = pv !== undefined ? pv.activo : globallyPermitted.has(v.id);
                return {
                    vehiculoId: v.id,
                    nombre: v.nombre,
                    capacidadMinima: v.capacidadMinima,
                    capacidadMaxima: v.capacidadMaxima,
                    precioBase: Number(v.precioBase ?? 0),
                    activo: defaultActivo
                };
            });

            return {
                // Aliado-specific fields
                servicioId: servicio.id,
                activo: sa ? sa.activo : false,
                tipoComision: tarifa?.tipoComision ?? 'PORCENTAJE',
                comisionValor: tarifa ? Number(tarifa.comisionPorcentaje) : 0,
                vehiculos,
                // Full service fields (needed by wizard)
                id: servicio.id,
                nombre: servicio.nombre,
                descripcion: servicio.descripcion,
                imagen: servicio.imagen,
                duracion: servicio.duracion,
                incluye: servicio.incluye,
                precioBase: Number(servicio.precioBase ?? 0),
                aplicaRecargoNocturno: servicio.aplicaRecargoNocturno,
                recargoNocturnoInicio: servicio.recargoNocturnoInicio,
                recargoNocturnoFin: servicio.recargoNocturnoFin,
                montoRecargoNocturno: servicio.montoRecargoNocturno,
                esAeropuerto: servicio.esAeropuerto,
                esPorHoras: servicio.esPorHoras,
                esCompartido: servicio.esCompartido,
                esMunicipal: servicio.esMunicipal,
                esTraslado: servicio.esTraslado,
                destinoAutoFill: servicio.destinoAutoFill,
                infoTourCompartido: servicio.infoTourCompartido,
                camposPersonalizados: servicio.camposPersonalizados ?? [],
                adicionales: [],
                configuracion: servicio.configuracion,
                orden: servicio.orden,
            };
        });

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error fetching servicios aliado:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener servicios del aliado' },
            { status: 500 }
        );
    }
}

// POST - Crear/Actualizar configuración de servicio para aliado
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id: aliadoId } = params;
        const body = await request.json();
        const { servicioId, activo, tipoComision, comisionValor, vehiculos } = body;

        // Upsert ServicioAliado
        const servicioAliado = await prisma.servicioAliado.upsert({
            where: {
                aliadoId_servicioId: {
                    aliadoId,
                    servicioId
                }
            },
            update: {
                activo
            },
            create: {
                aliadoId,
                servicioId,
                activo
            }
        });

        // Upsert TarifaAliado
        await prisma.tarifaAliado.upsert({
            where: {
                aliadoId_servicioId: {
                    aliadoId,
                    servicioId
                }
            },
            update: {
                tipoComision: tipoComision || 'PORCENTAJE',
                comisionPorcentaje: parseFloat(comisionValor) || 0
            },
            create: {
                aliadoId,
                servicioId,
                tipoComision: tipoComision || 'PORCENTAJE',
                comisionPorcentaje: parseFloat(comisionValor) || 0,
                descuentoEspecial: 0,
                precioEspecial: null
            }
        });

        // Upsert PrecioVehiculoAliado with only activo boolean
        if (vehiculos && Array.isArray(vehiculos)) {
            for (const v of vehiculos) {
                await prisma.precioVehiculoAliado.upsert({
                    where: {
                        servicioAliadoId_vehiculoId: {
                            servicioAliadoId: servicioAliado.id,
                            vehiculoId: v.vehiculoId
                        }
                    },
                    update: {
                        activo: v.activo
                    },
                    create: {
                        servicioAliadoId: servicioAliado.id,
                        vehiculoId: v.vehiculoId,
                        activo: v.activo
                    }
                });
            }
        }

        // Obtain updated configuration
        const updated = await prisma.servicioAliado.findUnique({
            where: { id: servicioAliado.id },
            include: {
                servicio: true,
                preciosVehiculos: {
                    include: {
                        vehiculo: true
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: updated
        });
    } catch (error) {
        console.error('Error saving servicio aliado:', error);
        return NextResponse.json(
            { success: false, error: 'Error al guardar configuración del servicio' },
            { status: 500 }
        );
    }
}

// DELETE - Eliminar servicio de aliado
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id: aliadoId } = params;
        const { searchParams } = new URL(request.url);
        const servicioId = searchParams.get('servicioId');

        if (!servicioId) {
            return NextResponse.json(
                { success: false, error: 'servicioId is required' },
                { status: 400 }
            );
        }

        await prisma.servicioAliado.delete({
            where: {
                aliadoId_servicioId: {
                    aliadoId,
                    servicioId
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Servicio eliminado del aliado'
        });
    } catch (error) {
        console.error('Error deleting servicio aliado:', error);
        return NextResponse.json(
            { success: false, error: 'Error al eliminar servicio del aliado' },
            { status: 500 }
        );
    }
}
