import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EstadoReserva } from '@prisma/client';
import { getDatos } from '@/types/reserva-datos';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// GET /api/reservas/by-id/[id] - Fetch reservation by ID
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const reserva = await prisma.reserva.findUnique({
            where: { id: params.id },
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                calificacion: true,
                aliado: true,
                asistentes: true,
                adicionalesSeleccionados: {
                    include: {
                        adicional: true,
                    },
                },
            },
        });

        if (!reserva) {
            return NextResponse.json(
                { error: 'Reserva no encontrada' },
                { status: 404 }
            );
        }

        return NextResponse.json(reserva);
    } catch (error) {
        console.error('Error fetching reserva by ID:', error);
        return NextResponse.json(
            { error: 'Error al obtener la reserva' },
            { status: 500 }
        );
    }
}

// PUT /api/reservas/by-id/[id] - Update reservation
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // CR-06: require admin session — unauthenticated callers must not modify reservations
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();

        // Prepare update data
        const updateData: any = {};

        // Estado y conductor
        if (body.estado !== undefined) {
            updateData.estado = body.estado;
        }
        if (body.conductorId !== undefined) {
            updateData.conductorId = body.conductorId;
        }

        // Customer data
        if (body.nombreCliente !== undefined) {
            updateData.nombreCliente = body.nombreCliente;
        }
        if (body.emailCliente !== undefined) {
            updateData.emailCliente = body.emailCliente;
        }
        if (body.whatsappCliente !== undefined) {
            updateData.whatsappCliente = body.whatsappCliente;
        }
        if (body.idioma !== undefined) {
            updateData.idioma = body.idioma;
        }

        // Service Details Updates
        if (body.fecha) {
            // Ensure we store it as noon UTC to avoid timezone issues
            updateData.fecha = new Date(body.fecha + 'T12:00:00.000Z');
        }
        if (body.hora) {
            updateData.hora = body.hora;
        }
        if (body.numeroPasajeros) {
            updateData.numeroPasajeros = Number(body.numeroPasajeros);
        }
        if (body.vehiculoId) {
            updateData.vehiculoId = body.vehiculoId;
        }
        if (body.municipio !== undefined) {
            // Convert empty string to null for Tour Compartido (municipio is optional)
            updateData.municipio = body.municipio === '' ? null : body.municipio;
        }
        if (body.notas !== undefined) {
            updateData.notas = body.notas === '' ? null : body.notas;
        }

        // Fields that live in datos JSON — merge instead of writing to columns
        const datosPatch: Record<string, unknown> = {};
        if (body.numeroVuelo !== undefined) {
            datosPatch.numeroVuelo = body.numeroVuelo === '' ? undefined : body.numeroVuelo;
        }
        if (body.lugarRecogida !== undefined) {
            datosPatch.lugarRecogida = body.lugarRecogida === '' ? undefined : body.lugarRecogida;
        }
        if (body.aeropuertoNombre !== undefined) {
            datosPatch.aeropuertoNombre = body.aeropuertoNombre === '' ? undefined : body.aeropuertoNombre;
        }
        if (Object.keys(datosPatch).length > 0) {
            const existing = await prisma.reserva.findUnique({ where: { id: params.id }, select: { datos: true } });
            const currentDatos = getDatos((existing as any)?.datos);
            const merged = { ...currentDatos };
            for (const [k, v] of Object.entries(datosPatch)) {
                if (v === undefined) delete merged[k];
                else merged[k] = v;
            }
            updateData.datos = merged;
        }

        // Pricing updates (for quotes)
        if (body.precioTotal !== undefined) {
            updateData.precioTotal = parseFloat(body.precioTotal);
        }
        if (body.precioBase !== undefined) {
            updateData.precioBase = parseFloat(body.precioBase);
        }

        // Update asistentes (passengers) if provided
        if (body.asistentes && Array.isArray(body.asistentes)) {
            for (const asistente of body.asistentes) {
                if (asistente.id) {
                    // Update existing asistente
                    await prisma.asistente.update({
                        where: { id: asistente.id },
                        data: {
                            nombre: asistente.nombre,
                            tipoDocumento: asistente.tipoDocumento,
                            numeroDocumento: asistente.numeroDocumento,
                            email: asistente.email || null,
                            telefono: asistente.telefono || null,
                        },
                    });
                }
            }
        }

        // Update reservation
        const reserva = await prisma.reserva.update({
            where: { id: params.id },
            data: updateData,
            include: {
                servicio: true,
                vehiculo: true,
                conductor: true,
                calificacion: true,
                aliado: true,
                asistentes: true,
                adicionalesSeleccionados: {
                    include: {
                        adicional: true,
                    },
                },
            },
        });

        // Send email notifications based on state changes
        if (body.estado && body.estado !== body.previousEstado) {
            try {
                const emailService = await import('@/lib/email-service');
                const idioma = reserva.idioma || 'ES';

                switch (body.estado) {
                    case EstadoReserva.PENDING_PAYMENT:
                        const aliadoEmail = reserva.aliado?.email || null;
                        await emailService.sendReservaConfirmadaEmail(reserva as any, idioma, aliadoEmail);
                        break;
                    case EstadoReserva.CONFIRMED_UNASSIGNED:
                        await emailService.sendPagoAprobadoEmail(reserva as any, idioma);
                        break;
                    case EstadoReserva.CONFIRMED_ASSIGNED:
                        if (reserva.conductor) {
                            await emailService.sendConductorAsignadoEmail(reserva as any, idioma);
                        }
                        break;
                    case EstadoReserva.COMPLETED:
                        await emailService.sendServicioCompletadoEmail(reserva as any, idioma);
                        break;
                    case EstadoReserva.CANCELLED:
                        // Email de cancelación no implementado aún
                        break;
                }
            } catch (emailError) {
                console.error('Error sending email notification:', emailError);
                // Don't fail the update if email fails
            }
        }

        // Sync with Google Calendar if needed
        if (body.estado || body.conductorId || body.fecha || body.hora) {
            try {
                // Check if this is a Tour Compartido reservation
                if (reserva.servicio?.esCompartido) {
                    // Use consolidation function to update/maintain all reservations for the day
                    const { createOrUpdateTourCompartidoEvent } = await import('@/lib/google-calendar-service');
                    await createOrUpdateTourCompartidoEvent(reserva as any);
                } else {
                    // Regular services: update individual event
                    const { updateCalendarEvent, deleteCalendarEvent } = await import('@/lib/google-calendar-service');
                    if (reserva.googleCalendarEventId) {
                        if (reserva.estado === EstadoReserva.CANCELLED) {
                            await deleteCalendarEvent(reserva.googleCalendarEventId);

                            // Clean up the ID from our database since it's gone from Calendar
                            await prisma.reserva.update({
                                where: { id: params.id },
                                data: { googleCalendarEventId: null }
                            });
                        } else {
                            await updateCalendarEvent(reserva as any);
                        }
                    }
                }
            } catch (calendarError) {
                console.error('Error updating calendar event:', calendarError);
                // Don't fail the update if calendar sync fails
            }
        }

        return NextResponse.json({
            data: reserva,
            message: 'Reserva actualizada exitosamente'
        });
    } catch (error) {
        console.error('Error updating reserva:', error);
        return NextResponse.json(
            { error: 'Error al actualizar la reserva' },
            { status: 500 }
        );
    }
}
