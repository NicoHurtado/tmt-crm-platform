/**
 * Verificación (solo lectura) de que los eventos de Google Calendar ya muestran el
 * mismo día que la fecha real de la reserva (zona America/Bogota).
 * Uso: npx tsx --env-file=.env prisma/verify-calendar-fechas.ts
 */
import { google } from 'googleapis';
import { prisma } from '../lib/prisma';

const bogotaDay = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
const utcDay = (d: Date) => d.toISOString().slice(0, 10);

function client() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return { calendar: google.calendar({ version: 'v3', auth }), calendarId: process.env.GOOGLE_CALENDAR_ID! };
}

async function main() {
    const { calendar, calendarId } = client();
    const reservas = await prisma.reserva.findMany({
        where: { googleCalendarEventId: { not: null } },
        select: { codigo: true, fecha: true, hora: true, googleCalendarEventId: true },
        orderBy: { fecha: 'asc' },
    });
    const desfasadas = reservas.filter((r) => bogotaDay(r.fecha) !== utcDay(r.fecha));

    let match = 0;
    let mismatch = 0;
    for (const r of desfasadas) {
        const ev = await calendar.events.get({ calendarId, eventId: r.googleCalendarEventId! });
        const start = ev.data.start?.dateTime || ev.data.start?.date || '';
        const startDay = start.slice(0, 10);
        const esperado = bogotaDay(r.fecha);
        const ok = startDay === esperado;
        ok ? match++ : mismatch++;
        console.log(`${ok ? '✅' : '❌'} ${r.codigo}  esperado=${esperado}  calendar=${startDay} (${start})`);
    }
    console.log(`\nCoinciden: ${match}   No coinciden: ${mismatch}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
