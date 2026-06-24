import { PrismaClient } from '@prisma/client';
import { getConfiguracion, buildConfiguracion } from '../types/servicio-config';

const prisma = new PrismaClient();

// ─── Precios por persona (VALORES DE TOURS 2026) ───────────────────────────────
// Tramos: p1 = 1 persona, p2 = 2 personas, p3 = 3 o más personas (c/u).
// Celdas vacías del Excel completadas según indicación del usuario.
interface TourPP {
  label: string;
  id: string;            // id del servicio existente
  p1: number; p2: number; p3: number;
}

const TOURS: TourPP[] = [
  { label: 'Guatapé (Tour a Guatapé y El Peñol)', id: 'test-servicio-1',                p1: 700000, p2: 350000, p3: 270000 },
  { label: 'Comuna 13',                            id: 'cmihy359t00219svuz4yke7ta',       p1: 350000, p2: 250000, p3: 250000 },
  { label: 'Miradores (Mirador La Palma San Félix)', id: 'cmlvqpj820000bpfprrwe2ts8',     p1: 250000, p2: 170000, p3: 170000 },
  { label: 'Full Day Finca Silletera',             id: 'cmiz1jr5c00041lbkh9xw7dhd',       p1: 700000, p2: 520000, p3: 260000 },
  { label: 'Tour del Café',                        id: 'cmihyvsu4002x9svu626h98m2',       p1: 230000, p2: 230000, p3: 230000 },
];

// Nuevo servicio "Tour Oriente"
const ORIENTE = { p1: 600000, p2: 300000, p3: 250000 };

async function main() {
  console.log('🔄 Activando tours POR_PERSONA...\n');

  for (const tour of TOURS) {
    const servicio = await prisma.servicio.findUnique({
      where: { id: tour.id },
      select: { id: true, nombre: true, configuracion: true },
    });
    if (!servicio) {
      console.log(`⚠️  No encontrado: ${tour.label} (${tour.id})`);
      continue;
    }
    const cfgActual = getConfiguracion((servicio as any).configuracion);
    const nuevaConfig = buildConfiguracion(
      cfgActual.camposCustom,        // se conservan (no se renderizan bajo POR_PERSONA)
      cfgActual.infoCompartido,      // se conserva
      { tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: tour.p1, p2: tour.p2, p3: tour.p3 } },
    );
    await prisma.servicio.update({
      where: { id: tour.id },
      data: { configuracion: nuevaConfig as any },
    });
    const nombreEs = (servicio.nombre as any)?.es ?? tour.label;
    console.log(`✅ ${tour.label} → "${nombreEs}"  [${tour.p1}/${tour.p2}/${tour.p3}]`);
  }

  // ── Crear Tour Oriente (si no existe ya) ──
  const yaExiste = await prisma.servicio.findFirst({
    where: { nombre: { path: ['es'], equals: 'Tour Oriente' } },
    select: { id: true },
  });
  if (yaExiste) {
    await prisma.servicio.update({
      where: { id: yaExiste.id },
      data: {
        configuracion: buildConfiguracion([], null, {
          tipoTarifa: 'POR_PERSONA',
          preciosPorPersona: { p1: ORIENTE.p1, p2: ORIENTE.p2, p3: ORIENTE.p3 },
        }) as any,
      },
    });
    console.log(`\n✅ Tour Oriente ya existía (${yaExiste.id}) → precios actualizados [${ORIENTE.p1}/${ORIENTE.p2}/${ORIENTE.p3}]`);
  } else {
    const nuevo = await prisma.servicio.create({
      data: {
        nombre: { es: 'Tour Oriente', en: 'Oriente Tour' },
        descripcion: {
          es: 'Recorrido por el Oriente antioqueño. Tour por persona con recogida en tu dirección.',
          en: 'Tour through the Eastern Antioquia region. Per-person tour with pickup at your address.',
        },
        incluye: {
          es: ['Transporte', 'Conductor', 'Tarjeta de asistencia médica'],
          en: ['Transportation', 'Driver', 'Medical assistance card'],
        },
        imagen: 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg',
        duracion: 'Full day',
        activo: true,
        configuracion: buildConfiguracion([], null, {
          tipoTarifa: 'POR_PERSONA',
          preciosPorPersona: { p1: ORIENTE.p1, p2: ORIENTE.p2, p3: ORIENTE.p3 },
        }) as any,
      },
    });
    console.log(`\n✅ Tour Oriente creado (${nuevo.id}) → precios [${ORIENTE.p1}/${ORIENTE.p2}/${ORIENTE.p3}]`);
  }

  console.log('\n═'.repeat(50));
  console.log('✅ Listo. Tours POR_PERSONA configurados.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
