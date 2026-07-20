/**
 * Crea en Google Calendar los eventos de reservas activas que quedaron SIN evento.
 *
 * Contexto: los tours compartidos y POR_PERSONA se guardaban con `hora = ""` porque
 * el wizard nunca la pedía. Eso producía un dateTime inválido, Google devolvía 400 y
 * el evento nunca se creaba — en silencio. La causa ya está corregida; este script
 * recupera las reservas que quedaron huérfanas antes del fix.
 *
 * Solo toca reservas:
 *   - sin googleCalendarEventId
 *   - en estado activo (no CANCELLED — ahí la ausencia de evento es correcta)
 *   - con fecha de hoy en adelante (los eventos pasados solo agregan ruido)
 *
 * Las que no tengan hora válida se crean con la hora de respaldo y el título
 * "⚠️ HORA POR CONFIRMAR" para que el equipo la corrija en el calendario.
 *
 * Dry-run (por defecto):  npx tsx --env-file=.env prisma/backfill-eventos-faltantes.ts
 * Ejecutar de verdad:     RUN=1 npx tsx --env-file=.env prisma/backfill-eventos-faltantes.ts
 */
import { prisma } from '../lib/prisma';
import {
    createCalendarEvent,
    createOrUpdateTourCompartidoEvent,
    parseHoraReserva,
} from '../lib/google-calendar-service';

const RELACIONES = {
    servicio: true,
    conductor: true,
    vehiculo: true,
    aliado: true,
    asistentes: true,
} as const;

async function main() {
    const ejecutar = process.env.RUN === '1';
    console.log(
        ejecutar
            ? '🟢 MODO EJECUCIÓN — se crearán eventos en Google Calendar'
            : '🟡 DRY-RUN (no se llama a Google). Usa RUN=1 para ejecutar.'
    );

    // Medianoche de hoy en Bogotá, expresada en UTC. Las fechas se guardan al mediodía
    // UTC, así que comparar contra el inicio del día de hoy incluye las reservas de hoy.
    const hoyBogota = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    const desde = new Date(`${hoyBogota}T00:00:00.000Z`);

    const huerfanas = await prisma.reserva.findMany({
        where: {
            googleCalendarEventId: null,
            estado: { not: 'CANCELLED' },
            fecha: { gte: desde },
        },
        include: RELACIONES,
        orderBy: { fecha: 'asc' },
    });

    console.log(`\nReservas activas futuras sin evento: ${huerfanas.length}\n`);

    let creados = 0;
    let fallidos = 0;

    for (const reserva of huerfanas) {
        const horaValida = parseHoraReserva(reserva.hora);
        const aviso = horaValida ? '' : '  ⚠️ sin hora válida → se marcará HORA POR CONFIRMAR';
        const etiqueta = [
            reserva.codigo,
            reserva.fecha.toISOString().slice(0, 10),
            `hora=${JSON.stringify(reserva.hora)}`,
            reserva.estado,
            reserva.esCotizacion ? 'cotización' : 'web',
        ].join(' | ');

        if (!ejecutar) {
            console.log(`[dry-run] ${etiqueta}${aviso}`);
            continue;
        }

        try {
            const eventId = reserva.servicio?.esCompartido
                ? await createOrUpdateTourCompartidoEvent(reserva as any)
                : await createCalendarEvent(reserva as any);

            if (!eventId) {
                console.log(`❌ ${etiqueta} — Google no devolvió eventId`);
                fallidos++;
                continue;
            }

            await prisma.reserva.update({
                where: { id: reserva.id },
                data: { googleCalendarEventId: eventId },
            });
            console.log(`✅ ${etiqueta} → ${eventId}${aviso}`);
            creados++;
        } catch (error) {
            console.log(`❌ ${etiqueta} — ${error instanceof Error ? error.message : String(error)}`);
            fallidos++;
        }
    }

    if (ejecutar) {
        console.log(`\nResumen: ${creados} creados, ${fallidos} fallidos.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
