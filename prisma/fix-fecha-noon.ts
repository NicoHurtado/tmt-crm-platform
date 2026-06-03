/**
 * Normaliza TODA reserva cuya `fecha` no esté almacenada al mediodía UTC
 * (invariante del proyecto). El día calendario que el cliente eligió es el día
 * UTC de la fecha guardada (igual que muestra el calendario admin con
 * `fecha.split('T')[0]`). Lo re-anclamos a las 12:00 UTC para que coincidan
 * el admin y Google Calendar (que interpreta en America/Bogota).
 *
 * Luego re-empuja el evento de Google Calendar de las reservas corregidas que
 * ya tienen evento, para que la fecha del calendario coincida con el día real.
 *
 * Dry-run (por defecto):  npx tsx --env-file=.env prisma/fix-fecha-noon.ts
 * Ejecutar de verdad:     RUN=1 npx tsx --env-file=.env prisma/fix-fecha-noon.ts
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import {
    updateCalendarEvent,
    createOrUpdateTourCompartidoEvent,
} from '../lib/google-calendar-service';

const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const isNoonUTC = (d: Date) =>
    d.getUTCHours() === 12 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

const RELACIONES = {
    servicio: true,
    conductor: true,
    vehiculo: true,
    aliado: true,
    asistentes: true,
} as const;

async function main() {
    const ejecutar = process.env.RUN === '1';
    console.log(ejecutar ? '🟢 MODO EJECUCIÓN' : '🟡 DRY-RUN. Usa RUN=1 para aplicar.');

    const todas = await prisma.reserva.findMany({
        include: RELACIONES,
        orderBy: { fecha: 'asc' },
    });

    const malas = todas.filter((r) => !isNoonUTC(r.fecha));
    console.log(`Reservas con fecha fuera de mediodía UTC: ${malas.length}\n`);

    if (ejecutar && malas.length > 0) {
        const backupPath = `prisma/backup-fechas-${Date.now()}.json`;
        writeFileSync(
            backupPath,
            JSON.stringify(
                malas.map((r) => ({
                    id: r.id,
                    codigo: r.codigo,
                    fecha: r.fecha.toISOString(),
                    googleCalendarEventId: r.googleCalendarEventId,
                })),
                null,
                2,
            ),
        );
        console.log(`💾 Backup escrito en ${backupPath}\n`);
    }

    let fixed = 0;
    let resynced = 0;
    let fail = 0;

    for (const r of malas) {
        const nuevaFecha = new Date(`${utcDay(r.fecha)}T12:00:00.000Z`);
        const linea =
            `${r.codigo}  ${r.fecha.toISOString()} → ${nuevaFecha.toISOString()} ${r.hora}` +
            (r.googleCalendarEventId ? `  evt=${r.googleCalendarEventId}` : '  (sin evento)');

        if (!ejecutar) {
            console.log('· ' + linea);
            continue;
        }

        try {
            await prisma.reserva.update({
                where: { id: r.id },
                data: { fecha: nuevaFecha },
            });
            fixed++;

            if (r.googleCalendarEventId) {
                const conNuevaFecha = { ...r, fecha: nuevaFecha };
                const esCompartido = (r.servicio as any)?.esCompartido === true;
                const ok = esCompartido
                    ? (await createOrUpdateTourCompartidoEvent(conNuevaFecha as any)) !== null
                    : (await updateCalendarEvent(conNuevaFecha as any)) === true;
                if (ok) resynced++;
                else { fail++; console.log('❌ (resync sin éxito) ' + linea); continue; }
            }
            console.log('✅ ' + linea);
        } catch (e) {
            fail++;
            console.log(`❌ (error) ${linea} :: ${(e as Error).message}`);
        }
    }

    if (ejecutar) {
        console.log(`\nFechas corregidas: ${fixed}   Eventos re-sincronizados: ${resynced}   Fallidos: ${fail}`);
    } else {
        console.log('\nDry-run completo. Ejecuta con RUN=1 para aplicar.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
