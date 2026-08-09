import cloudinary from '@/lib/cloudinary';

// HEIC/HEIF es el formato por defecto de la cámara del iPhone. Safari suele
// convertir a JPEG al subir desde el selector de fotos, pero no siempre —
// compartiendo desde Archivos, o en algunos Android, llega el HEIC tal cual y
// el conductor se quedaba con un "Tipo de archivo no permitido" sin entender
// por qué. Cloudinary lo acepta y lo sirve convertido.
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const UPLOAD_ERRORS = {
    NO_FILE: 'No se proporcionó ningún archivo',
    INVALID_TYPE: 'Tipo de archivo no permitido. Solo JPG, PNG, WEBP o HEIC.',
    FILE_TOO_LARGE: 'El archivo es demasiado grande. Máximo 5MB.',
    UPLOAD_FAILED: 'Error al subir la imagen',
} as const;

interface ValidationResult {
    valid: boolean;
    error?: string;
}

/** MIME que no dice nada: hay que mirar la extensión. */
const MIME_SIN_INFORMACION = ['', 'application/octet-stream', 'binary/octet-stream'];

export function validateImageFile(file: File): ValidationResult {
    const tipo = (file.type || '').toLowerCase();
    const extension = (file.name.split('.').pop() || '').toLowerCase();

    // El MIME manda cuando existe. Solo si el navegador no dijo nada útil
    // (algunos móviles mandan el campo vacío o application/octet-stream) se cae
    // a la extensión: rechazar por un header ausente deja al conductor sin
    // poder subir su foto y sin saber por qué.
    const permitido = MIME_SIN_INFORMACION.includes(tipo)
        ? ALLOWED_EXTENSIONS.includes(extension)
        : ALLOWED_TYPES.includes(tipo);

    if (!permitido) {
        return { valid: false, error: UPLOAD_ERRORS.INVALID_TYPE };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: UPLOAD_ERRORS.FILE_TOO_LARGE };
    }
    return { valid: true };
}

export function generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${timestamp}-${sanitizedName}`;
}

/**
 * Sube una imagen a Cloudinary bajo la carpeta tmt/<folder>
 * @returns URL pública de la imagen en Cloudinary
 */
export async function uploadImageToBlob(
    file: File,
    folder: 'servicios' | 'vehiculos' | 'conductores' = 'servicios'
): Promise<string> {
    const validation = validateImageFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: `tmt/${folder}`,
                public_id: generateUniqueFilename(file.name).replace(/\.[^.]+$/, ''),
                resource_type: 'image',
            },
            (error, result) => {
                if (error || !result) return reject(error ?? new Error(UPLOAD_ERRORS.UPLOAD_FAILED));
                resolve(result as { secure_url: string });
            }
        ).end(buffer);
    });

    return result.secure_url;
}
