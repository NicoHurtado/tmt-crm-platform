/**
 * verify-migration.ts
 *
 * Verifica que la migración a Railway fue correcta.
 * Compara conteos con el dump de Neon y revisa integridad de imágenes.
 *
 * Uso:
 *   DATABASE_URL=<railway-url> npx tsx scripts/verify-migration.ts neon-produccion.sql
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const DUMP_PATH = resolve(process.argv[2] ?? 'neon-produccion.sql');

function parseDumpCounts(path: string): Map<string, number> {
  const dump = readFileSync(path, 'utf8');
  const counts = new Map<string, number>();
  const re = /^COPY public\."?(\w+)"? \([^)]+\) FROM stdin;\n([\s\S]*?)^\\\./gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dump)) !== null) {
    const rows = m[2].trim().split('\n').filter(Boolean).length;
    if (rows > 0) counts.set(m[1], rows);
  }
  return counts;
}

async function main() {
  console.log('\n🔍 Verificación de migración\n');

  if (!existsSync(DUMP_PATH)) {
    console.error(`✗ No se encontró: ${DUMP_PATH}`);
    process.exit(1);
  }

  const dumpCounts = parseDumpCounts(DUMP_PATH);

  const checks: Array<{ table: string; dump: number; railway: number }> = [];

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.vehiculo.count(),
    prisma.conductor.count(),
    prisma.servicio.count(),
    prisma.aliado.count(),
    prisma.municipioConfig.count(),
    prisma.pedido.count(),
    prisma.servicioVehiculo.count(),
    prisma.servicioAdicional.count(),
    prisma.servicioAliado.count(),
    prisma.tarifaAliado.count(),
    prisma.tarifaMunicipioAliado.count(),
    prisma.tarifaMunicipioServicio.count(),
    prisma.precioVehiculoAliado.count(),
    prisma.reserva.count(),
    prisma.asistente.count(),
    prisma.reservaAdicional.count(),
    prisma.calificacion.count(),
    prisma.bdAntigua.count(),
  ]);

  const tables = [
    ['User', 'User'], ['Vehiculo', 'Vehiculo'], ['Conductor', 'Conductor'],
    ['Servicio', 'Servicio'], ['Aliado', 'Aliado'], ['MunicipioConfig', 'MunicipioConfig'],
    ['Pedido', 'Pedido'], ['ServicioVehiculo', 'ServicioVehiculo'],
    ['ServicioAdicional', 'ServicioAdicional'], ['ServicioAliado', 'ServicioAliado'],
    ['TarifaAliado', 'TarifaAliado'], ['TarifaMunicipioAliado', 'TarifaMunicipioAliado'],
    ['TarifaMunicipioServicio', 'tarifas_municipio_servicio'],
    ['PrecioVehiculoAliado', 'PrecioVehiculoAliado'],
    ['Reserva', 'Reserva'], ['Asistente', 'Asistente'],
    ['ReservaAdicional', 'ReservaAdicional'], ['Calificacion', 'Calificacion'],
    ['BdAntigua', 'bd_antigua'],
  ];

  let allOk = true;
  console.log('Tabla'.padEnd(30) + 'Neon'.padStart(8) + 'Railway'.padStart(10) + '  Estado');
  console.log('─'.repeat(58));

  tables.forEach(([label, dumpKey], i) => {
    const dump = dumpCounts.get(dumpKey) ?? 0;
    const railway = counts[i];
    const ok = railway >= dump;
    if (!ok) allOk = false;
    const status = ok ? '✅ OK' : `❌ FALTAN ${dump - railway}`;
    console.log(label.padEnd(30) + String(dump).padStart(8) + String(railway).padStart(10) + `  ${status}`);
  });

  // ── Verificación de imágenes ────────────────────────────────────────────
  console.log('\n── Imágenes ──');
  const servicios = await prisma.servicio.findMany({ select: { id: true, imagen: true } });
  const vehiculos = await prisma.vehiculo.findMany({ select: { id: true, imagen: true } });
  const conductores = await prisma.conductor.findMany({ select: { id: true, foto: true } });

  const imagenes = [
    ...servicios.map(s => ({ tabla: 'Servicio', id: s.id, url: s.imagen })),
    ...vehiculos.map(v => ({ tabla: 'Vehiculo', id: v.id, url: v.imagen })),
    ...conductores.filter(c => c.foto).map(c => ({ tabla: 'Conductor', id: c.id, url: c.foto! })),
  ];

  const cloudinary = imagenes.filter(i => i.url.includes('cloudinary.com')).length;
  const vercel = imagenes.filter(i => i.url.includes('vercel-storage.com')).length;
  const local = imagenes.filter(i => i.url.startsWith('/')).length;
  const otra = imagenes.length - cloudinary - vercel - local;

  console.log(`  Total imágenes:  ${imagenes.length}`);
  console.log(`  En Cloudinary:   ${cloudinary} ${cloudinary === imagenes.length ? '✅' : ''}`);
  if (vercel > 0) console.log(`  Vercel Blob:     ${vercel} ⚠  (pendientes de migrar)`);
  if (local > 0)  console.log(`  Rutas locales:   ${local} ⚠  (pendientes de migrar)`);
  if (otra > 0)   console.log(`  Otras:           ${otra}`);

  // ── Enum legacy check ───────────────────────────────────────────────────
  console.log('\n── Enums legacy ──');
  const legacyEstados = ['PAGADA_PENDIENTE_ASIGNACION','CONFIRMADA_PENDIENTE_PAGO',
    'ASIGNADA_PENDIENTE_COMPLETAR','CONFIRMADA_PENDIENTE_ASIGNACION',
    'PENDIENTE_COTIZACION','COMPLETADA','CANCELADA'];
  // Prisma no permite filtrar por valores que no están en el enum, así que verificamos con raw
  const legacyCount = await prisma.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(*)::int as count FROM "Reserva"
    WHERE estado::text = ANY(${legacyEstados})
  `;
  const legacy = Number((legacyCount[0] as any).count);
  if (legacy === 0) console.log('  EstadoReserva legacy: ✅ ninguno');
  else              console.log(`  EstadoReserva legacy: ❌ ${legacy} registros con valores viejos`);

  const boldCount = await prisma.$queryRaw<{count: bigint}[]>`
    SELECT COUNT(*)::int as count FROM "Reserva" WHERE "metodoPago"::text = 'BOLD'
  `;
  const bold = Number((boldCount[0] as any).count);
  if (bold === 0) console.log('  MetodoPago BOLD:      ✅ ninguno');
  else            console.log(`  MetodoPago BOLD:      ❌ ${bold} registros con BOLD`);

  console.log(`\n${allOk ? '✅ Verificación OK' : '❌ Hay diferencias — revisa los errores arriba'}\n`);
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
