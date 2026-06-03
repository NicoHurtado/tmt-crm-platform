/**
 * Detecta reservas cuyo googleCalendarEventId ya no existe en Google (evento
 * borrado manualmente) y recrea el evento. Solo reservas ACTIVAS y futuras o de hoy.
 *
 * Dry-run:  npx tsx --env-file=.env prisma/fix-stale-events.ts
 * Ejecutar: RUN=1 npx tsx --env-file=.env prisma/fix-stale-events.ts
 */
import { google } from 'googleapis';
import { prisma } from '../lib/prisma';
import { createCalendarEvent, createOrUpdateTourCompartidoEvent } from '../lib/google-calendar-service';

function client() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return { calendar: google.calendar({ version: 'v3', auth }), calendarId: process.env.GOOGLE_CALENDAR_ID! };
}

const RELACIONES = { servicio: true, conductor: true, vehiculo: true, aliado: true, asistentes: true } as const;

async function main() {
    const ejecutar = process.env.RUN === '1';
    console.log(ejecutar ? '🟢 EJECUCIÓN' : '🟡 DRY-RUN. RUN=1 para aplicar.');
    const { calendar, calendarId } = client();

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    const reservas = await prisma.reserva.findMany({
        where: { googleCalendarEventId: { not: null }, estado: { not: 'CANCELLED' }, fecha: { gte: hoy } },
        include: RELACIONES,
        orderBy: { fecha: 'asc' },
    });

    let stale = 0, fixed = 0, fail = 0;
    for (const r of reservas) {
        try {
            await calendar.events.get({ calendarId, eventId: r.googleCalendarEventId! });
            continue; // existe, ok
        } catch (e: any) {
            if (e?.code !== 404 && e?.code !== 410) { console.log(`? ${r.codigo} error inesperado: ${e?.code}`); continue; }
        }
        stale++;
        const linea = `${r.codigo}  ${r.fecha.toISOString().slice(0, 10)} ${r.hora}  evt-borrado=${r.googleCalendarEventId}`;
        if (!ejecutar) { console.log('· ' + linea); continue; }
        try {
            const esCompartido = (r.servicio as any)?.esCompartido === true;
            await prisma.reserva.update({ where: { id: r.id }, data: { googleCalendarEventId: null } });
            const nuevo = esCompartido
                ? await createOrUpdateTourCompartidoEvent({ ...r, googleCalendarEventId: null } as any)
                : await createCalendarEvent({ ...r, googleCalendarEventId: null } as any);
            if (nuevo) {
                if (!esCompartido) await prisma.reserva.update({ where: { id: r.id }, data: { googleCalendarEventId: nuevo } });
                fixed++; console.log('✅ ' + linea + ` → nuevo=${nuevo}`);
            } else { fail++; console.log('❌ ' + linea); }
        } catch (e) { fail++; console.log(`❌ ${linea} :: ${(e as Error).message}`); }
    }
    console.log(`\nStale: ${stale}   Recreados: ${fixed}   Fallidos: ${fail}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
