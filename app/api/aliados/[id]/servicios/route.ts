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

        // 1. Servicios activos con sus ServicioVehiculo (precio incluido) + vehículos
        const [allServicios, allVehiculos] = await Promise.all([
            prisma.servicio.findMany({
                where: { activo: true },
                include: {
                    vehiculosPermitidos: { select: { vehiculoId: true, precio: true } }
                }
            }),
            prisma.vehiculo.findMany({
                where: { activo: true },
                orderBy: { capacidadMinima: 'asc' }
            })
        ]);

        const sortedServicios = sortServicesByPriority(allServicios);

        // 2. ServicioAliado + comisiones por vehículo
        const serviciosAliado = await prisma.servicioAliado.findMany({
            where: { aliadoId: id },
            include: { preciosVehiculos: true }
        });
        const servicioAliadoMap = new Map(serviciosAliado.map(sa => [sa.servicioId, sa]));

        // 3. Construir respuesta — cada servicio expone sus ServicioVehiculo con precio + comisión opcional del aliado
        const data = sortedServicios.map((servicio: any) => {
            const sa = servicioAliadoMap.get(servicio.id);

            const preciosVehiculosMap = new Map(
                (sa?.preciosVehiculos ?? []).map((pv: any) => [pv.vehiculoId, pv])
            );

            // Vehículos permitidos para este servicio.
            // precioServicio aquí = precio base del aliado (PrecioVehiculoAliado.precioBase).
            // El precio público del servicio (ServicioVehiculo.precio) NO se usa en el contexto aliado.
            const vehiculos = servicio.vehiculosPermitidos.map((sv: any) => {
                const veh = allVehiculos.find((v: any) => v.id === sv.vehiculoId);
                const pv: any = preciosVehiculosMap.get(sv.vehiculoId);
                const precioServicio = pv ? Number(pv.precioBase ?? 0) : 0;
                const tipoComision = (pv?.tipoComision ?? 'PORCENTAJE') as 'PORCENTAJE' | 'FIJO';
                const comisionValor = pv ? Number(pv.comisionValor) : 0;
                const comisionMonto = tipoComision === 'FIJO'
                    ? comisionValor
                    : precioServicio * (comisionValor / 100);
                const precioFinalAliado = precioServicio + comisionMonto;
                return {
                    vehiculoId: sv.vehiculoId,
                    nombre: veh?.nombre ?? '',
                    capacidadMinima: veh?.capacidadMinima ?? 0,
                    capacidadMaxima: veh?.capacidadMaxima ?? 0,
                    imagen: veh?.imagen ?? null,
                    precioServicio,
                    activo: pv ? pv.activo : true,
                    tipoComision,
                    comisionValor,
                    precioFinalAliado,
                };
            });

            return {
                servicioId: servicio.id,
                activo: sa ? sa.activo : false,
                vehiculos,
                // Service fields
                id: servicio.id,
                nombre: servicio.nombre,
                descripcion: servicio.descripcion,
                imagen: servicio.imagen,
                duracion: servicio.duracion,
                incluye: servicio.incluye,
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

// POST - Crear/Actualizar configuración de servicio + comisiones por vehículo
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
        const { servicioId, activo, vehiculos } = body;

        // Upsert ServicioAliado (flag de activación)
        const servicioAliado = await prisma.servicioAliado.upsert({
            where: {
                aliadoId_servicioId: { aliadoId, servicioId }
            },
            update: { activo },
            create: { aliadoId, servicioId, activo }
        });

        // Upsert PrecioVehiculoAliado con comisión por vehículo
        if (vehiculos && Array.isArray(vehiculos)) {
            await Promise.all(vehiculos.map((v: any) => {
                const tipoComision = (v.tipoComision === 'FIJO' ? 'FIJO' : 'PORCENTAJE') as 'FIJO' | 'PORCENTAJE';
                const comisionValor = Number(v.comisionValor) || 0;
                const precioBase = Number(v.precioBase) || 0;
                return prisma.precioVehiculoAliado.upsert({
                    where: {
                        servicioAliadoId_vehiculoId: {
                            servicioAliadoId: servicioAliado.id,
                            vehiculoId: v.vehiculoId
                        }
                    },
                    update: {
                        activo: v.activo ?? true,
                        precioBase,
                        tipoComision,
                        comisionValor,
                    },
                    create: {
                        servicioAliadoId: servicioAliado.id,
                        vehiculoId: v.vehiculoId,
                        activo: v.activo ?? true,
                        precioBase,
                        tipoComision,
                        comisionValor,
                    }
                });
            }));
        }

        return NextResponse.json({ success: true });
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
                aliadoId_servicioId: { aliadoId, servicioId }
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
