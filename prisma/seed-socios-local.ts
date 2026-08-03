/**
 * Datos mínimos para probar la API de socios en una base LOCAL.
 *
 * Replica el servicio de aeropuerto tal como está en producción (tarifas JMC/Olaya,
 * recargo nocturno 22:00–03:00 de $20.000 y el adicional "Póster aeropuerto"), para
 * poder ejercitar /api/socios/* sin conectarse a la base real.
 *
 * NO correr contra producción: ahí el servicio y los vehículos ya existen.
 * Todo es `upsert`, así que se puede repetir sin duplicar.
 *
 * Uso:
 *   export LOCAL_DB="postgresql://tmt:tmt@localhost:5433/tmt?schema=public"
 *   DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" npx tsx prisma/seed-socios-local.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICIO_ID = 'local-aeropuerto';

// nombre · capacidad · precio José María Córdova · precio Olaya Herrera
const VEHICULOS = [
    { id: 'local-auto', nombre: 'Auto 1 - 3', min: 1, max: 3, jmc: 140_000, olaya: 80_000 },
    { id: 'local-camioneta', nombre: 'Camioneta 4', min: 4, max: 4, jmc: 180_000, olaya: 80_000 },
    { id: 'local-van-8', nombre: 'Van 5 - 8', min: 5, max: 8, jmc: 240_000, olaya: 120_000 },
    { id: 'local-van-15', nombre: 'Van 9 - 15', min: 9, max: 15, jmc: 300_000, olaya: 170_000 },
    { id: 'local-van-18', nombre: 'Van 16 - 18', min: 16, max: 18, jmc: 370_000, olaya: 200_000 },
    { id: 'local-bus-25', nombre: 'Bus 19 - 25', min: 19, max: 25, jmc: 680_000, olaya: 350_000 },
    { id: 'local-bus-40', nombre: 'Bus 26 - 40', min: 26, max: 40, jmc: 750_000, olaya: 450_000 },
];

async function main() {
    if (/neon\.tech|railway/.test(process.env.DATABASE_URL ?? '')) {
        throw new Error('Este seed es solo para bases locales. DATABASE_URL apunta a una base remota.');
    }

    console.log('🌱 Sembrando datos locales para probar la API de socios...\n');

    for (const v of VEHICULOS) {
        await prisma.vehiculo.upsert({
            where: { id: v.id },
            update: {},
            create: {
                id: v.id,
                nombre: v.nombre,
                capacidadMinima: v.min,
                capacidadMaxima: v.max,
                imagen: '',
                activo: true,
            },
        });
    }
    console.log(`✅ ${VEHICULOS.length} vehículos`);

    const servicio = await prisma.servicio.upsert({
        where: { id: SERVICIO_ID },
        update: {},
        create: {
            id: SERVICIO_ID,
            tipoServicio: 'TRANSPORTE_AEROPUERTO',
            nombre: { es: 'Traslado Privado Aeropuerto', en: 'Private Airport Transfer' },
            descripcion: { es: 'Traslado privado desde/hacia el aeropuerto', en: 'Private airport transfer' },
            incluye: { es: ['Conductor profesional'], en: ['Professional driver'] },
            imagen: '',
            activo: true,
            esAeropuerto: true,
            categoria: 'AEROPUERTO',
            modeloPrecio: 'POR_VEHICULO',
            aplicaRecargoNocturno: true,
            recargoNocturnoInicio: '22:00',
            recargoNocturnoFin: '03:00',
            montoRecargoNocturno: 20_000,
            configuracion: {
                camposCustom: [
                    {
                        tipo: 'SWITCH',
                        clave: 'Posterairport',
                        orden: 0,
                        etiqueta: { es: 'Póster aeropuerto', en: 'Airport poster' },
                        requerido: false,
                        tienePrecio: true,
                        precioUnitario: 15_000,
                    },
                ],
                infoCompartido: null,
            },
        },
    });
    console.log(`✅ Servicio de aeropuerto — servicioId: ${servicio.id}`);

    for (const v of VEHICULOS) {
        await prisma.servicioVehiculo.upsert({
            where: { servicioId_vehiculoId: { servicioId: SERVICIO_ID, vehiculoId: v.id } },
            update: { precio: v.jmc, precioOlaya: v.olaya },
            create: { servicioId: SERVICIO_ID, vehiculoId: v.id, precio: v.jmc, precioOlaya: v.olaya },
        });
    }
    console.log('✅ Tarifas JMC y Olaya por vehículo\n');
    console.log(`Usa este servicioId al probar: ${SERVICIO_ID}`);
}

main()
    .catch((e) => {
        console.error('❌', e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
