/**
 * Auditoría (solo lectura) de reservas cuya `fecha` NO está almacenada al mediodía UTC.
 *
 * Invariante del proyecto: `fecha` se guarda siempre como YYYY-MM-DDT12:00:00.000Z.
 * Así el día calendario es idéntico en UTC y en America/Bogota (UTC-5), y el
 * calendario de Google coincide con la fecha legible que ve el cliente.
 *
 * Una reserva almacenada, por ejemplo, a las 00:00Z se renderiza como el día
 * anterior en Bogota (legible) pero como el mismo día en UTC (Google Calendar),
 * produciendo el desfase de 1 día.
 *
 * Uso: npx tsx prisma/audit-fechas.ts
 */
import { prisma } from '../lib/prisma';

const bogotaDay = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d); // YYYY-MM-DD

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
    const reservas = await prisma.reserva.findMany({
        select: { id: true, codigo: true, fecha: true, hora: true, googleCalendarEventId: true },
        orderBy: { fecha: 'asc' },
    });

    // Solo cuentan como desfasadas las que muestran un DÍA distinto en Bogota vs UTC.
    // (05:00Z o 17:00Z resuelven al mismo día en ambas zonas: no hay desfase visible.)
    const desfasadas = reservas.filter((r) => bogotaDay(r.fecha) !== utcDay(r.fecha));

    console.log(`Total reservas:                 ${reservas.length}`);
    console.log(`Con desfase real (Bogota≠UTC):  ${desfasadas.length}`);
    console.log('');
    for (const r of desfasadas) {
        console.log(
            `${r.codigo}  guardada=${r.fecha.toISOString()}  ` +
                `legible(Bogota)=${bogotaDay(r.fecha)}  calendarUTC=${utcDay(r.fecha)}  ` +
                `evento=${r.googleCalendarEventId ?? '—'}`
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
