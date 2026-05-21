/**
 * Script de migración: sube imágenes locales (/public) a Cloudinary
 * y actualiza los registros en la base de datos.
 *
 * Uso: npx tsx scripts/migrate-images-to-cloudinary.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();
const PUBLIC_DIR = path.join(process.cwd(), 'public');

async function uploadLocalImage(localPath: string, folder: string): Promise<string> {
    const result = await cloudinary.uploader.upload(localPath, {
        folder: `tmt/${folder}`,
        resource_type: 'image',
    });
    return result.secure_url;
}

function isLocalPath(url: string | null): boolean {
    return !!url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/http');
}

async function migrateServicios() {
    const servicios = await prisma.servicio.findMany({ select: { id: true, imagen: true } });
    console.log(`\nServicios: ${servicios.length} registros`);

    for (const s of servicios) {
        if (!isLocalPath(s.imagen)) {
            console.log(`  ✓ [${s.id}] ya tiene URL externa`);
            continue;
        }

        const localFile = path.join(PUBLIC_DIR, s.imagen);
        if (!fs.existsSync(localFile)) {
            console.log(`  ✗ [${s.id}] archivo no encontrado: ${s.imagen}`);
            continue;
        }

        try {
            const url = await uploadLocalImage(localFile, 'servicios');
            await prisma.servicio.update({ where: { id: s.id }, data: { imagen: url } });
            console.log(`  ↑ [${s.id}] ${s.imagen} → ${url}`);
        } catch (e) {
            console.error(`  ✗ [${s.id}] error:`, e);
        }
    }
}

async function migrateVehiculos() {
    const vehiculos = await prisma.vehiculo.findMany({ select: { id: true, imagen: true } });
    console.log(`\nVehículos: ${vehiculos.length} registros`);

    for (const v of vehiculos) {
        if (!isLocalPath(v.imagen)) {
            console.log(`  ✓ [${v.id}] ya tiene URL externa`);
            continue;
        }

        const localFile = path.join(PUBLIC_DIR, v.imagen);
        if (!fs.existsSync(localFile)) {
            console.log(`  ✗ [${v.id}] archivo no encontrado: ${v.imagen}`);
            continue;
        }

        try {
            const url = await uploadLocalImage(localFile, 'vehiculos');
            await prisma.vehiculo.update({ where: { id: v.id }, data: { imagen: url } });
            console.log(`  ↑ [${v.id}] ${v.imagen} → ${url}`);
        } catch (e) {
            console.error(`  ✗ [${v.id}] error:`, e);
        }
    }
}

async function migrateConductores() {
    const conductores = await prisma.conductor.findMany({ select: { id: true, foto: true } });
    console.log(`\nConductores: ${conductores.length} registros`);

    for (const c of conductores) {
        if (!c.foto || !isLocalPath(c.foto)) {
            console.log(`  ✓ [${c.id}] sin foto local`);
            continue;
        }

        const localFile = path.join(PUBLIC_DIR, c.foto);
        if (!fs.existsSync(localFile)) {
            console.log(`  ✗ [${c.id}] archivo no encontrado: ${c.foto}`);
            continue;
        }

        try {
            const url = await uploadLocalImage(localFile, 'conductores');
            await prisma.conductor.update({ where: { id: c.id }, data: { foto: url } });
            console.log(`  ↑ [${c.id}] ${c.foto} → ${url}`);
        } catch (e) {
            console.error(`  ✗ [${c.id}] error:`, e);
        }
    }
}

async function main() {
    console.log('=== Migración de imágenes → Cloudinary ===');
    console.log(`Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

    await migrateServicios();
    await migrateVehiculos();
    await migrateConductores();

    console.log('\n=== Migración completada ===');
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
