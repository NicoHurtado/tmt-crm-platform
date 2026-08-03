/**
 * Seed de socios de la API (`/api/socios/*`).
 *
 * Idempotente: se puede correr varias veces sin duplicar ni rotar llaves.
 * La llave se genera sola la primera vez; en corridas siguientes se conserva la
 * existente (no se sobrescribe, para no dejar tirado a un socio ya integrado).
 *
 * Para rotar la llave de un socio, pásala por variable de entorno:
 *   SOCIO_HOUSY_API_KEY=... npx tsx prisma/seed-socios.ts
 *
 * Uso: npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const SOCIOS = [
    { codigo: 'housy', nombre: 'Housy', envKey: 'SOCIO_HOUSY_API_KEY' },
    { codigo: 'housy-test', nombre: 'Housy (pruebas)', envKey: 'SOCIO_HOUSY_TEST_API_KEY' },
];

function generarApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
}

async function main() {
    console.log('🌱 Sembrando socios de la API...\n');

    for (const { codigo, nombre, envKey } of SOCIOS) {
        const existente = await prisma.socio.findUnique({ where: { codigo } });
        const apiKey = process.env[envKey] || existente?.apiKey || generarApiKey();

        const socio = await prisma.socio.upsert({
            where: { codigo },
            update: { nombre, apiKey, activo: true },
            create: { codigo, nombre, apiKey, activo: true },
        });

        const estado = existente ? 'actualizado' : 'creado';
        console.log(`✅ Socio ${estado}: ${socio.nombre} (codigo: ${socio.codigo})`);
        console.log(`   origen de sus reservas: socio:${socio.codigo}`);
        console.log(`   x-api-key: ${socio.apiKey}\n`);
    }

    console.log('⚠️  Entrega cada llave por un canal seguro. No la subas al repositorio.');
}

main()
    .catch((e) => {
        console.error('❌ Error sembrando socios:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
