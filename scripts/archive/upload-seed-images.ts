/**
 * Sube las imágenes del seed a Cloudinary e imprime las URLs.
 * No necesita base de datos.
 *
 * Uso: npx tsx scripts/upload-seed-images.ts
 */

import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PUBLIC_DIR = path.join(process.cwd(), 'public');

const SEED_IMAGES = [
    { file: 'van-removebg-preview.png', folder: 'tmt/vehiculos', key: 'vehiculo_van' },
    { file: 'guatape.jpg',              folder: 'tmt/servicios', key: 'servicio_guatape' },
];

async function main() {
    console.log('Subiendo imágenes del seed a Cloudinary...\n');

    for (const img of SEED_IMAGES) {
        const localPath = path.join(PUBLIC_DIR, img.file);
        const result = await cloudinary.uploader.upload(localPath, {
            folder: img.folder,
            public_id: img.key,
            overwrite: true,
            resource_type: 'image',
        });
        console.log(`${img.file}`);
        console.log(`  → ${result.secure_url}\n`);
    }

    console.log('Listo. Copia las URLs al seed.ts.');
}

main().catch((e) => { console.error(e); process.exit(1); });
