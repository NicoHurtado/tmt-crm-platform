import { PrismaClient, TipoComision } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Datos extraídos del Excel ────────────────────────────────────────────────
// Columnas por capacidadMinima del vehículo:
//   1 = Auto 1-3   4 = Camioneta 4   5 = Van 5-8   9 = Van 9-15
//  16 = Van 16-18  19 = Bus 19-25   26 = Bus 26-40

interface VehiclePrice {
  precio: number;
  comision: number; // solo para Lista 2
}

interface ServicePricing {
  excelNombre: string;
  // keywords para encontrar el servicio en DB (búsqueda case-insensitive en nombre.es)
  keywords: string[];
  // si hay keyword que debe estar ausente (ej. "Tour" para diferenciar traslado de tour)
  excludeKeywords?: string[];
  lista1: Partial<Record<number, number>>;
  lista2: Partial<Record<number, VehiclePrice>>;
  lista3: Partial<Record<number, number>>;
  // capacidadMinima de vehículos a desactivar (celdas en blanco)
  disabled: number[];
}

const PRICING: ServicePricing[] = [
  {
    excelNombre: 'DISPONIBILIDAD X HORAS',
    keywords: ['horas'],
    lista1:  { 1: 65000, 4: 75000, 5: 85000, 9: 105000, 16: 120000, 19: 150000, 26: 170000 },
    lista2:  { 1: { precio: 55000, comision: 5000 }, 4: { precio: 65000, comision: 5000 }, 5: { precio: 90000, comision: 10000 }, 9: { precio: 100000, comision: 10000 }, 16: { precio: 120000, comision: 10000 }, 19: { precio: 130000, comision: 10000 }, 26: { precio: 150000, comision: 10000 } },
    lista3:  { 1: 50000, 4: 60000, 5: 75000, 9: 95000, 16: 110000, 19: 120000, 26: 140000 },
    disabled: [],
  },
  {
    excelNombre: 'DESDE Y HACIA AL AEROPUERTO',
    keywords: ['aeropuerto'],
    lista1:  { 1: 140000, 4: 180000, 5: 290000, 9: 360000, 16: 400000, 19: 680000, 26: 750000 },
    lista2:  { 1: { precio: 130000, comision: 20000 }, 4: { precio: 170000, comision: 20000 }, 5: { precio: 280000, comision: 30000 }, 9: { precio: 350000, comision: 50000 }, 16: { precio: 400000, comision: 50000 }, 19: { precio: 650000, comision: 70000 }, 26: { precio: 750000, comision: 70000 } },
    lista3:  { 1: 120000, 4: 150000, 5: 230000, 9: 280000, 16: 350000, 19: 560000, 26: 650000 },
    disabled: [],
  },
  {
    excelNombre: 'GUATAPÉ',
    keywords: ['guatapé', 'el peñol'],
    excludeKeywords: ['traslado', 'compartido'],
    lista1:  { 1: 650000, 4: 700000, 5: 900000, 9: 1000000, 16: 1100000, 19: 1200000, 26: 1400000 },
    lista2:  { 1: { precio: 650000, comision: 65000 }, 4: { precio: 700000, comision: 70000 }, 5: { precio: 850000, comision: 100000 }, 9: { precio: 1000000, comision: 100000 }, 16: { precio: 1050000, comision: 100000 }, 19: { precio: 1200000, comision: 100000 }, 26: { precio: 1400000, comision: 100000 } },
    lista3:  { 1: 580000, 4: 650000, 5: 750000, 9: 900000, 16: 950000, 19: 1100000, 26: 1300000 },
    disabled: [],
  },
  {
    excelNombre: 'SANTA FE DE ANTIOQUIA (full day)',
    keywords: ['full day', 'santa fe'],
    lista1:  { 1: 650000, 4: 700000, 5: 850000, 9: 1000000, 16: 1100000, 19: 1200000, 26: 1400000 },
    // D14=650000 en Excel es error tipográfico → se usa 65000
    lista2:  { 1: { precio: 650000, comision: 65000 }, 4: { precio: 700000, comision: 70000 }, 5: { precio: 800000, comision: 100000 }, 9: { precio: 1000000, comision: 100000 }, 16: { precio: 1050000, comision: 100000 }, 19: { precio: 1200000, comision: 100000 }, 26: { precio: 1400000, comision: 100000 } },
    lista3:  { 1: 580000, 4: 650000, 5: 750000, 9: 900000, 16: 950000, 19: 1100000, 26: 1300000 },
    disabled: [],
  },
  {
    excelNombre: 'CITY TOUR',
    keywords: ['city tour'],
    lista1:  { 1: 450000, 4: 550000, 5: 700000, 9: 850000, 16: 950000, 19: 1050000, 26: 1150000 },
    lista2:  { 1: { precio: 400000, comision: 50000 }, 4: { precio: 500000, comision: 50000 }, 5: { precio: 650000, comision: 70000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 850000, comision: 100000 }, 19: { precio: 1050000, comision: 100000 }, 26: { precio: 1100000, comision: 150000 } },
    lista3:  { 1: 400000, 4: 500000, 5: 600000, 9: 650000, 16: 800000, 19: 950000, 26: 1000000 },
    disabled: [],
  },
  {
    excelNombre: 'COMUNA 13',
    keywords: ['comuna 13'],
    lista1:  { 1: 450000, 4: 550000, 5: 700000, 9: 850000, 16: 950000, 19: 1050000, 26: 1000000 },
    lista2:  { 1: { precio: 400000, comision: 50000 }, 4: { precio: 500000, comision: 50000 }, 5: { precio: 650000, comision: 70000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 850000, comision: 100000 }, 19: { precio: 1050000, comision: 100000 }, 26: { precio: 1000000, comision: 100000 } },
    lista3:  { 1: 400000, 4: 500000, 5: 600000, 9: 650000, 16: 800000, 19: 950000, 26: 1000000 },
    disabled: [],
  },
  {
    excelNombre: 'TOUR CAFETERO ITAGÜÍ',
    keywords: ['cafetera'],
    lista1:  { 1: 450000, 4: 550000, 5: 700000, 9: 750000, 16: 950000 },
    lista2:  { 1: { precio: 400000, comision: 50000 }, 4: { precio: 500000, comision: 50000 }, 5: { precio: 650000, comision: 70000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 850000, comision: 100000 } },
    lista3:  { 1: 400000, 4: 500000, 5: 600000, 9: 650000, 16: 800000 },
    disabled: [19, 26],
  },
  {
    excelNombre: 'TOUR CUATRIMOTOS',
    keywords: ['cuatrimotos', 'atv'],
    lista1:  { 1: 650000, 4: 700000, 5: 850000, 9: 1000000, 16: 1100000, 19: 1200000 },
    lista2:  { 1: { precio: 600000, comision: 70000 }, 4: { precio: 600000, comision: 70000 }, 5: { precio: 800000, comision: 100000 }, 9: { precio: 1000000, comision: 100000 }, 16: { precio: 1050000, comision: 100000 }, 19: { precio: 1150000, comision: 0 } },
    lista3:  { 1: 600000, 4: 550000, 5: 750000, 9: 800000, 16: 950000, 19: 1050000 },
    disabled: [26],
  },
  {
    excelNombre: 'TOUR PARAPENTE',
    keywords: ['parapente'],
    lista1:  { 1: 500000, 4: 600000, 5: 700000, 9: 750000, 16: 900000, 19: 1000000 },
    lista2:  { 1: { precio: 450000, comision: 50000 }, 4: { precio: 550000, comision: 50000 }, 5: { precio: 600000, comision: 70000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 850000, comision: 100000 }, 19: { precio: 950000, comision: 0 } },
    lista3:  { 1: 400000, 4: 500000, 5: 550000, 9: 700000, 16: 800000, 19: 900000 },
    disabled: [26],
  },
  {
    excelNombre: 'FULL DAY HACIENDA NÁPOLES',
    keywords: ['napoles'],
    lista1:  { 1: 1050000, 4: 1150000, 5: 1250000, 9: 1500000, 16: 1650000, 19: 1750000, 26: 1850000 },
    lista2:  { 1: { precio: 1000000, comision: 100000 }, 4: { precio: 1100000, comision: 100000 }, 5: { precio: 1200000, comision: 100000 }, 9: { precio: 1400000, comision: 100000 }, 16: { precio: 1650000, comision: 150000 }, 19: { precio: 1750000, comision: 150000 }, 26: { precio: 1850000, comision: 150000 } },
    lista3:  { 1: 950000, 4: 1000000, 5: 1100000, 9: 1350000, 16: 1500000, 19: 1600000, 26: 1700000 },
    disabled: [],
  },
  {
    excelNombre: 'FULL DAY FINCA SILLETERA',
    keywords: ['silletera'],
    lista1:  { 1: 650000, 4: 700000, 5: 850000, 9: 950000, 16: 1050000, 19: 1150000, 26: 1250000 },
    lista2:  { 1: { precio: 600000, comision: 100000 }, 4: { precio: 700000, comision: 100000 }, 5: { precio: 800000, comision: 0 }, 9: { precio: 950000, comision: 100000 }, 16: { precio: 1050000, comision: 100000 }, 19: { precio: 1150000, comision: 150000 }, 26: { precio: 1250000, comision: 150000 } },
    lista3:  { 1: 550000, 4: 600000, 5: 750000, 9: 950000, 16: 950000, 19: 1050000, 26: 1150000 },
    disabled: [],
  },
  {
    excelNombre: 'FULL DAY JARDÍN',
    keywords: ['full day jardin'],
    lista1:  { 1: 1050000, 4: 1150000, 5: 1200000, 9: 1500000, 16: 1500000, 19: 1750000, 26: 1850000 },
    lista2:  { 1: { precio: 1000000, comision: 100000 }, 4: { precio: 1100000, comision: 100000 }, 5: { precio: 1200000, comision: 100000 }, 9: { precio: 1400000, comision: 100000 }, 16: { precio: 1500000, comision: 100000 }, 19: { precio: 1750000, comision: 100000 }, 26: { precio: 1850000, comision: 0 } },
    lista3:  { 1: 950000, 4: 1000000, 5: 1100000, 9: 1350000, 16: 1450000, 19: 1600000, 26: 1700000 },
    disabled: [],
  },
  {
    excelNombre: 'FULL DAY JERICÓ',
    keywords: ['jerico'],
    lista1:  { 1: 1050000, 4: 1150000, 5: 1200000, 9: 1500000, 16: 1500000, 19: 1750000, 26: 1850000 },
    lista2:  { 1: { precio: 1000000, comision: 100000 }, 4: { precio: 1100000, comision: 100000 }, 5: { precio: 1200000, comision: 100000 }, 9: { precio: 1400000, comision: 100000 }, 16: { precio: 1500000, comision: 100000 }, 19: { precio: 1750000, comision: 100000 }, 26: { precio: 1850000, comision: 0 } },
    lista3:  { 1: 950000, 4: 1000000, 5: 1100000, 9: 1350000, 16: 1450000, 19: 1600000, 26: 1700000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADOS SANTA FE DE ANTIOQUIA',
    keywords: ['traslado', 'santa fe'],
    lista1:  { 1: 400000, 4: 450000, 5: 600000, 9: 850000, 16: 850000, 19: 950000, 26: 1100000 },
    lista2:  { 1: { precio: 380000, comision: 50000 }, 4: { precio: 450000, comision: 50000 }, 5: { precio: 600000, comision: 100000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 800000, comision: 100000 }, 19: { precio: 950000, comision: 100000 }, 26: { precio: 1100000, comision: 150000 } },
    lista3:  { 1: 300000, 4: 400000, 5: 500000, 9: 650000, 16: 700000, 19: 850000, 26: 950000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADO GUATAPÉ',
    keywords: ['traslado', 'guatape'],
    excludeKeywords: ['tour', 'penol'],
    lista1:  { 1: 400000, 4: 450000, 5: 600000, 9: 850000, 16: 850000, 19: 950000, 26: 1100000 },
    lista2:  { 1: { precio: 380000, comision: 50000 }, 4: { precio: 450000, comision: 50000 }, 5: { precio: 600000, comision: 100000 }, 9: { precio: 750000, comision: 100000 }, 16: { precio: 800000, comision: 100000 }, 19: { precio: 950000, comision: 100000 }, 26: { precio: 1100000, comision: 150000 } },
    lista3:  { 1: 300000, 4: 400000, 5: 500000, 9: 650000, 16: 700000, 19: 850000, 26: 950000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADO ARMENIA',
    keywords: ['armenia'],
    lista1:  { 1: 1300000, 4: 1450000, 5: 1650000, 9: 2200000, 16: 2250000, 19: 3000000, 26: 3500000 },
    lista2:  { 1: { precio: 1300000, comision: 200000 }, 4: { precio: 1450000, comision: 200000 }, 5: { precio: 1650000, comision: 200000 }, 9: { precio: 2100000, comision: 200000 }, 16: { precio: 2250000, comision: 200000 }, 19: { precio: 3000000, comision: 2000000 }, 26: { precio: 3500000, comision: 200000 } },
    lista3:  { 1: 1100000, 4: 1250000, 5: 1450000, 9: 2000000, 16: 2050000, 19: 2800000, 26: 3300000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADO MANIZALES',
    keywords: ['manizales'],
    lista1:  { 1: 1200000, 4: 1350000, 5: 1500000, 9: 2100000, 16: 2100000, 19: 2650000, 26: 3000000 },
    lista2:  { 1: { precio: 1200000, comision: 150000 }, 4: { precio: 1350000, comision: 150000 }, 5: { precio: 1450000, comision: 150000 }, 9: { precio: 2000000, comision: 150000 }, 16: { precio: 2100000, comision: 150000 }, 19: { precio: 2650000, comision: 150000 }, 26: { precio: 3000000, comision: 150000 } },
    lista3:  { 1: 1050000, 4: 1200000, 5: 1300000, 9: 1900000, 16: 1950000, 19: 2500000, 26: 2850000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADO PEREIRA',
    keywords: ['pereira'],
    lista1:  { 1: 1200000, 4: 1350000, 5: 1500000, 9: 2100000, 16: 2100000, 19: 2650000, 26: 3000000 },
    lista2:  { 1: { precio: 1200000, comision: 150000 }, 4: { precio: 1350000, comision: 150000 }, 5: { precio: 1450000, comision: 150000 }, 9: { precio: 2000000, comision: 150000 }, 16: { precio: 2100000, comision: 150000 }, 19: { precio: 2650000, comision: 150000 }, 26: { precio: 3000000, comision: 150000 } },
    lista3:  { 1: 1050000, 4: 1200000, 5: 1300000, 9: 1900000, 16: 1950000, 19: 2500000, 26: 2850000 },
    disabled: [],
  },
  {
    excelNombre: 'TRASLADO SALENTO',
    keywords: ['salento'],
    lista1:  { 1: 1300000, 4: 1450000, 5: 1650000, 9: 2200000, 16: 2250000, 19: 3000000, 26: 3500000 },
    lista2:  { 1: { precio: 1300000, comision: 200000 }, 4: { precio: 1450000, comision: 200000 }, 5: { precio: 1650000, comision: 200000 }, 9: { precio: 2100000, comision: 200000 }, 16: { precio: 2250000, comision: 200000 }, 19: { precio: 3000000, comision: 200000 }, 26: { precio: 3500000, comision: 200000 } },
    lista3:  { 1: 1100000, 4: 1250000, 5: 1450000, 9: 2000000, 16: 2050000, 19: 2800000, 26: 3300000 },
    disabled: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// keywords: ALL must match (AND logic within each keyword, OR logic via single keyword)
// excludeKeywords: NONE must match
function matchesService(nombreEs: string, keywords: string[], excludeKeywords?: string[]): boolean {
  const n = norm(nombreEs);
  const hasAll = keywords.every(k => n.includes(norm(k)));
  if (!hasAll) return false;
  if (excludeKeywords?.some(k => n.includes(norm(k)))) return false;
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Cargando vehículos y servicios...');

  const vehiculos = await prisma.vehiculo.findMany();
  const vehiculoByCapMin = new Map(vehiculos.map(v => [v.capacidadMinima, v]));

  const servicios = await prisma.servicio.findMany({
    include: { vehiculosPermitidos: true },
  });

  const aliados = await prisma.aliado.findMany({
    where: { activo: true },
  });
  const hotelAirbnb = aliados.filter(a => a.tipo === 'HOTEL' || a.tipo === 'AIRBNB');
  const agencias = aliados.filter(a => a.tipo === 'AGENCIA');

  console.log(`  Vehículos: ${vehiculos.length} | Servicios: ${servicios.length} | Aliados hotel/airbnb: ${hotelAirbnb.length} | Agencias: ${agencias.length}`);

  let svUpdated = 0;
  let svDisabled = 0;
  let aliadoRecords = 0;
  const warnings: string[] = [];

  for (const pricing of PRICING) {
    // Encontrar servicio en DB
    const servicio = servicios.find(s => {
      const nombreEs = (s.nombre as { es: string }).es ?? '';
      return matchesService(nombreEs, pricing.keywords, pricing.excludeKeywords);
    });

    if (!servicio) {
      warnings.push(`⚠️  No encontrado: "${pricing.excelNombre}" (keywords: ${pricing.keywords.join(', ')})`);
      continue;
    }

    const nombreEs = (servicio.nombre as { es: string }).es;
    console.log(`\n📋 ${pricing.excelNombre} → "${nombreEs}" (${servicio.id})`);

    // ── Lista 1: actualizar ServicioVehiculo.precio ──
    for (const [capMinStr, precio] of Object.entries(pricing.lista1)) {
      const capMin = Number(capMinStr);
      const vehiculo = vehiculoByCapMin.get(capMin);
      if (!vehiculo) { warnings.push(`  Vehículo capMin=${capMin} no encontrado`); continue; }

      await prisma.servicioVehiculo.upsert({
        where: { servicioId_vehiculoId: { servicioId: servicio.id, vehiculoId: vehiculo.id } },
        update: { precio },
        create: { servicioId: servicio.id, vehiculoId: vehiculo.id, precio },
      });
      svUpdated++;
    }

    // ── Eliminar vehículos sin precio (celdas en blanco = no aplica) ──
    for (const capMin of pricing.disabled) {
      const vehiculo = vehiculoByCapMin.get(capMin);
      if (!vehiculo) continue;
      const deleted = await prisma.servicioVehiculo.deleteMany({
        where: { servicioId: servicio.id, vehiculoId: vehiculo.id },
      });
      if (deleted.count > 0) {
        svDisabled++;
        console.log(`  🚫 Eliminado (no aplica): ${vehiculo.nombre}`);
      }
    }

    // ── Listas 2 y 3: PrecioVehiculoAliado ──
    const processAliados = async (
      aliadoList: typeof aliados,
      getPrecio: (capMin: number) => { precio: number; comision: number } | undefined,
    ) => {
      for (const aliado of aliadoList) {
        // Upsert ServicioAliado
        const servicioAliado = await prisma.servicioAliado.upsert({
          where: { aliadoId_servicioId: { aliadoId: aliado.id, servicioId: servicio.id } },
          update: { activo: true },
          create: { aliadoId: aliado.id, servicioId: servicio.id, activo: true },
        });

        // Upsert PrecioVehiculoAliado por cada vehículo activo
        const capMins = Object.keys(pricing.lista1).map(Number);
        for (const capMin of capMins) {
          if (pricing.disabled.includes(capMin)) continue;
          const vehiculo = vehiculoByCapMin.get(capMin);
          if (!vehiculo) continue;
          const p = getPrecio(capMin);
          if (!p) continue;

          await prisma.precioVehiculoAliado.upsert({
            where: { servicioAliadoId_vehiculoId: { servicioAliadoId: servicioAliado.id, vehiculoId: vehiculo.id } },
            update: { precioBase: p.precio, comisionValor: p.comision, tipoComision: TipoComision.FIJO, activo: true },
            create: { servicioAliadoId: servicioAliado.id, vehiculoId: vehiculo.id, precioBase: p.precio, comisionValor: p.comision, tipoComision: TipoComision.FIJO, activo: true },
          });
          aliadoRecords++;
        }
      }
    };

    await processAliados(
      hotelAirbnb,
      capMin => {
        const entry = pricing.lista2[capMin as keyof typeof pricing.lista2];
        return entry;
      },
    );

    await processAliados(
      agencias,
      capMin => {
        const precio = pricing.lista3[capMin as keyof typeof pricing.lista3];
        return precio !== undefined ? { precio, comision: 0 } : undefined;
      },
    );
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ RESUMEN');
  console.log(`  ServicioVehiculo actualizados: ${svUpdated}`);
  console.log(`  ServicioVehiculo desactivados: ${svDisabled}`);
  console.log(`  PrecioVehiculoAliado upserts:  ${aliadoRecords}`);
  if (warnings.length) {
    console.log('\n  Advertencias:');
    warnings.forEach(w => console.log(' ', w));
  }
  console.log('═'.repeat(60));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
