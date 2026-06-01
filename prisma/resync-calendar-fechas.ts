/**
 * Re-sincroniza en Google Calendar SOLO las reservas cuyo evento muestra un día
 * distinto al de la plataforma (desfase Bogota≠UTC). Actualiza el evento existente
 * (events.update) para que la fecha del calendario coincida con la fecha real de la
 * reserva. NO modifica la base de datos, NO borra eventos.
 *
 * Dry-run (por defecto):   npx tsx --env-file=.env prisma/resync-calendar-fechas.ts
 * Ejecutar de verdad:      RUN=1 npx tsx --env-file=.env prisma/resync-calendar-fechas.ts
 */
import { prisma } from '../lib/prisma';
import {
    updateCalendarEvent,
    createOrUpdateTourCompartidoEvent,
} from '../lib/google-calendar-service';

const bogotaDay = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

const RELACIONES = {
    servicio: true,
    conductor: true,
    vehiculo: true,
    aliado: true,
    asistentes: true,
} as const;

async function main() {
    const ejecutar = process.env.RUN === '1';
    console.log(ejecutar ? '🟢 MODO EJECUCIÓN' : '🟡 DRY-RUN (no se llama a Google). Usa RUN=1 para ejecutar.');

    const candidatas = await prisma.reserva.findMany({
        where: { googleCalendarEventId: { not: null } },
        include: RELACIONES,
        orderBy: { fecha: 'asc' },
    });

    const desfasadas = candidatas.filter((r) => bogotaDay(r.fecha) !== utcDay(r.fecha));
    console.log(`Reservas con evento y desfase real: ${desfasadas.length}\n`);

    let ok = 0;
    let fail = 0;

    for (const r of desfasadas) {
        const esCompartido = (r.servicio as any)?.esCompartido === true;
        const linea =
            `${r.codigo}  evento=${r.googleCalendarEventId}  ` +
            `calendarAntes=${utcDay(r.fecha)} → calendarDespues=${bogotaDay(r.fecha)} ${r.hora}` +
            (esCompartido ? '  [tour compartido]' : '');

        if (!ejecutar) {
            console.log('· ' + linea);
            continue;
        }

        try {
            const resultado = esCompartido
                ? await createOrUpdateTourCompartidoEvent(r as any)
                : await updateCalendarEvent(r as any);
            const exito = esCompartido ? resultado !== null : resultado === true;
            if (exito) {
                ok++;
                console.log('✅ ' + linea);
            } else {
                fail++;
                console.log('❌ (sin éxito) ' + linea);
            }
        } catch (e) {
            fail++;
            console.log(`❌ (error) ${linea} :: ${(e as Error).message}`);
        }
    }

    if (ejecutar) {
        console.log(`\nActualizados: ${ok}   Fallidos: ${fail}`);
    } else {
        console.log('\nDry-run completo. Ejecuta con RUN=1 para aplicar los cambios en Google Calendar.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
