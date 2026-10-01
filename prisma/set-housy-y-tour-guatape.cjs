// JavaScript plano (sin tsx/esbuild) para poder correrlo con `node` directamente.
const path = require('path');
process.loadEnvFile('.env');
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;

const prisma = new PrismaClient();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Octubre 2026:
 *  1. Columna Aliado.soloPagoTarjeta (idempotente, igual a la migración 20261001120000).
 *  2. Housy → solo pago con tarjeta (Bold).
 *  3. Tour Guatapé PRIVADO → nueva info comercial e imagen; bote y almuerzo pasan a estar incluidos.
 *
 * Uso:  node prisma/set-housy-y-tour-guatape.cjs           (solo muestra lo que haría)
 *       node prisma/set-housy-y-tour-guatape.cjs --apply   (aplica)
 */

const TOUR_GUATAPE_ID = 'test-servicio-1'; // "Tour a Guatapé privado"
// Extras que ahora vienen incluidos en el precio (bote de lujo y almuerzo a la carta).
const EXTRAS_INCLUIDOS = ['almuerzoscarta', 'bote1a6', 'vueltabote7a15', 'bote16a22', 'bote23a30'];
const IMAGEN_LOCAL = path.join(process.cwd(), 'public/images/servicios/tour-guatape-2026.jpg');

const TOUR = {
    nombre: {
        es: 'Tour Guatapé: Color, Cultura y Paisajes',
        en: 'Guatapé Tour: Color, Culture & Landscapes',
    },
    descripcion: {
        es: 'A solo 2 horas de Medellín, descubre uno de los destinos más coloridos de Colombia. Ideal para quienes visitan Medellín por primera vez y desean vivir una experiencia completa entre paisajes, cultura y tradición. Te recogemos en tu dirección a las 7:50 a.m. y salimos todos los días. Política: la actividad se realiza con un mínimo de 3 personas.',
        en: "Just 2 hours from Medellín, discover one of Colombia's most colorful destinations. Ideal for first-time visitors to Medellín who want a complete experience of landscapes, culture and tradition. We pick you up at your address at 7:50 a.m., departures every day. Policy: the activity runs with a minimum of 3 people.",
    },
    incluye: {
        es: [
            'Hora de salida: 7:50 a.m.',
            'Punto de encuentro: tu dirección',
            'Vehículo tipo van ida y regreso desde Medellín',
            'Parada en Alto del Chocho',
            'Visita a la Réplica del Viejo Peñol',
            'Parada en la Casa al Revés (ingreso no incluido)',
            'Parada en la Piedra del Peñol (ingreso no incluido)',
            'Recorrido por el embalse en bote de lujo',
            'Almuerzo a la carta',
            'Recorrido por Guatapé (zócalos, malecón y calles icónicas)',
            'Tiempo libre para fotos y compras',
            'Tarjeta de asistencia médica',
            'Salidas: todos los días',
            'Actividad sujeta a un mínimo de 3 personas',
        ],
        en: [
            'Departure time: 7:50 a.m.',
            'Meeting point: your address',
            'Van round trip from Medellín',
            'Stop at Alto del Chocho',
            'Visit to the Old Peñol Replica',
            'Stop at the Upside-Down House (entry not included)',
            'Stop at El Peñol Rock (entry not included)',
            'Luxury boat ride on the reservoir',
            'À la carte lunch',
            'Guatapé town tour (zócalos, boardwalk and iconic streets)',
            'Free time for photos and shopping',
            'Medical assistance card',
            'Departures: every day',
            'Activity subject to a minimum of 3 people',
        ],
    },
    duracion: '8.5 – 9 horas aprox',
};

async function main() {
    const apply = process.argv.includes('--apply');
    console.log(apply ? '▶ APLICANDO cambios' : '▶ DRY RUN (usa --apply para escribir)');

    // 1. Columna nueva
    if (apply) {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "Aliado" ADD COLUMN IF NOT EXISTS "soloPagoTarjeta" BOOLEAN NOT NULL DEFAULT false'
        );
        console.log('✓ Columna Aliado.soloPagoTarjeta lista');
    }

    // 2. Housy → solo tarjeta
    const housy = await prisma.$queryRawUnsafe(
        `SELECT id, nombre, codigo FROM "Aliado" WHERE nombre ILIKE '%housy%'`
    );
    if (housy.length === 0) {
        console.warn('⚠ No se encontró ningún aliado con nombre "Housy"');
    }
    for (const a of housy) {
        console.log(`Aliado ${a.nombre} (${a.codigo}) → soloPagoTarjeta = true`);
        if (apply) {
            await prisma.$executeRawUnsafe(`UPDATE "Aliado" SET "soloPagoTarjeta" = true WHERE id = $1`, a.id);
        }
    }

    // 3. Tour Guatapé PRIVADO (por persona en tramos; los precios 700k/350k/270k no cambian)
    const servicio = await prisma.servicio.findUnique({
        where: { id: TOUR_GUATAPE_ID },
        select: { id: true, nombre: true, configuracion: true },
    });
    if (!servicio) throw new Error(`No existe el servicio ${TOUR_GUATAPE_ID}`);
    console.log(`Servicio: ${JSON.stringify(servicio.nombre)} → ${TOUR.nombre.es}`);

    const cfg = (servicio.configuracion && typeof servicio.configuracion === 'object' ? servicio.configuracion : {});
    const campos = Array.isArray(cfg.camposCustom) ? cfg.camposCustom : [];
    const camposFinal = campos.filter((c) => !EXTRAS_INCLUIDOS.includes(c.clave));
    console.log(`  Extras que se quitan (ya incluidos): ${campos.filter((c) => EXTRAS_INCLUIDOS.includes(c.clave)).map((c) => c.clave).join(', ') || 'ninguno'}`);

    if (apply) {
        const subida = await cloudinary.uploader.upload(IMAGEN_LOCAL, { folder: 'tmt/servicios' });
        console.log(`✓ Imagen subida: ${subida.secure_url}`);
        await prisma.servicio.update({
            where: { id: TOUR_GUATAPE_ID },
            data: {
                nombre: TOUR.nombre,
                descripcion: TOUR.descripcion,
                incluye: TOUR.incluye,
                duracion: TOUR.duracion,
                imagen: subida.secure_url,
                configuracion: { ...cfg, camposCustom: camposFinal },
            },
        });
        console.log('✓ Tour Guatapé privado actualizado');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
