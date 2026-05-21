/**
 * Seed MunicipioConfig table with the municipalities served by Transportes Medellín Travel.
 * Run: DATABASE_URL="..." npx tsx scripts/seed-municipios.ts
 *
 * Idempotent: uses upsert on id — safe to re-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Recargo en COP — ajusta desde el panel admin en /admin/municipios
const municipios = [
  { id: 'cm-medellin',   nombreES: 'Medellín',             nombreEN: 'Medellín',             recargo: 0,  orden: 1 },
  { id: 'cm-poblado',    nombreES: 'El Poblado',            nombreEN: 'El Poblado',           recargo: 0,  orden: 2 },
  { id: 'cm-laureles',   nombreES: 'Laureles / Estadio',    nombreEN: 'Laureles / Estadio',   recargo: 0,  orden: 3 },
  { id: 'cm-envigado',   nombreES: 'Envigado',              nombreEN: 'Envigado',             recargo: 0,  orden: 4 },
  { id: 'cm-sabaneta',   nombreES: 'Sabaneta',              nombreEN: 'Sabaneta',             recargo: 0,  orden: 5 },
  { id: 'cm-itagui',     nombreES: 'Itagüí',                nombreEN: 'Itagüí',               recargo: 0,  orden: 6 },
  { id: 'cm-bello',      nombreES: 'Bello',                 nombreEN: 'Bello',                recargo: 0,  orden: 7 },
  { id: 'cm-rionegro',   nombreES: 'Rionegro',              nombreEN: 'Rionegro',             recargo: 0,  orden: 8 },
  { id: 'cm-guatape',    nombreES: 'Guatapé',               nombreEN: 'Guatapé',              recargo: 0,  orden: 9 },
  { id: 'cm-santafe',    nombreES: 'Santa Fe de Antioquia', nombreEN: 'Santa Fe de Antioquia', recargo: 0, orden: 10 },
];

async function main() {
  console.log('🌱 Seeding MunicipioConfig...\n');

  for (const m of municipios) {
    const result = await prisma.municipioConfig.upsert({
      where: { id: m.id },
      create: { ...m, activo: true },
      update: { nombreES: m.nombreES, nombreEN: m.nombreEN, recargo: m.recargo, orden: m.orden, activo: true },
    });
    console.log(`  ✓ ${result.nombreES.padEnd(30)} recargo=${result.recargo}`);
  }

  const total = await prisma.municipioConfig.count();
  console.log(`\n✅ MunicipioConfig: ${total} registros en total`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
