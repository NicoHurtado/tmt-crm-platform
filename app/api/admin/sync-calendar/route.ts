import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent, updateCalendarEvent, createOrUpdateTourCompartidoEvent } from '@/lib/google-calendar-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode'); // 'create' (default) or 'update'

        // 1. Determine which reservations to fetch based on mode
        const whereClause: any = {
            estado: {
                not: 'CANCELLED'
            }
        };

        if (mode === 'update') {
            whereClause.googleCalendarEventId = { not: null };
        } else {
            whereClause.googleCalendarEventId = null;
        }

        const reservationsToSync = await prisma.reserva.findMany({
            where: whereClause,
            include: {
                servicio: true,
                conductor: true,
                vehiculo: true,
                aliado: true,
                asistentes: true,
            },
            orderBy: {
                fecha: 'desc'
            }
        });

        console.log(`📅 Found ${reservationsToSync.length} reservations to ${mode === 'update' ? 'update' : 'sync'} with Google Calendar`);

        let syncedCount = 0;
        let errorCount = 0;
        const results: any[] = [];
        const tourCompartidoSynced = new Set<string>();

        // 2. Iterate and sync/update
        for (const reserva of reservationsToSync) {
            try {
                const isTourCompartido = reserva.servicio?.esCompartido;

                if (mode === 'update') {
                    if (isTourCompartido) {
                        const dateKey = `${reserva.servicioId}-${new Date(reserva.fecha).toISOString().split('T')[0]}`;
                        if (tourCompartidoSynced.has(dateKey)) {
                            results.push({ codigo: reserva.codigo, status: 'skipped', action: 'already synced via consolidated event' });
                            continue;
                        }
                        tourCompartidoSynced.add(dateKey);
                        const eventId = await createOrUpdateTourCompartidoEvent(reserva as any);
                        if (eventId) {
                            syncedCount++;
                            results.push({ codigo: reserva.codigo, status: 'success', eventId, action: 'tour_compartido_updated' });
                        } else {
                            errorCount++;
                            results.push({ codigo: reserva.codigo, status: 'failed', error: 'Could not update tour event' });
                        }
                    } else {
                        const success = await updateCalendarEvent(reserva);
                        if (success) {
                            syncedCount++;
                            results.push({ codigo: reserva.codigo, status: 'success', action: 'updated' });
                        } else {
                            errorCount++;
                            results.push({ codigo: reserva.codigo, status: 'failed', error: 'Could not update event' });
                        }
                    }
                } else {
                    if (isTourCompartido) {
                        const dateKey = `${reserva.servicioId}-${new Date(reserva.fecha).toISOString().split('T')[0]}`;
                        if (tourCompartidoSynced.has(dateKey)) {
                            results.push({ codigo: reserva.codigo, status: 'skipped', action: 'already synced via consolidated event' });
                            continue;
                        }
                        tourCompartidoSynced.add(dateKey);
                        const eventId = await createOrUpdateTourCompartidoEvent(reserva as any);
                        if (eventId) {
                            syncedCount++;
                            results.push({ codigo: reserva.codigo, status: 'success', eventId, action: 'tour_compartido_created' });
                        } else {
                            errorCount++;
                            results.push({ codigo: reserva.codigo, status: 'failed', error: 'Could not create tour event' });
                        }
                    } else {
                        const eventId = await createCalendarEvent(reserva);
                        if (eventId) {
                            await prisma.reserva.update({
                                where: { id: reserva.id },
                                data: { googleCalendarEventId: eventId }
                            });
                            syncedCount++;
                            results.push({ codigo: reserva.codigo, status: 'success', eventId, action: 'created' });
                        } else {
                            errorCount++;
                            results.push({ codigo: reserva.codigo, status: 'failed', error: 'Could not create event' });
                        }
                    }
                }

            } catch (err: any) {
                console.error(`❌ Error processing reservation ${reserva.codigo}:`, err);
                errorCount++;
                results.push({ codigo: reserva.codigo, status: 'error', message: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync completed. Synced: ${syncedCount}, Failed: ${errorCount}`,
            totalFound: reservationsToSync.length,
            syncedCount,
            errorCount,
            details: results
        });

    } catch (error: any) {
        console.error('❌ Error in calendar sync API:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
