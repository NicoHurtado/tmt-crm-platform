import { put } from '@vercel/blob';

/**
 * Tipos de archivo permitidos para upload
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Tamaño máximo de archivo: 5MB
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Mensajes de error
 */
export const UPLOAD_ERRORS = {
    NO_FILE: 'No se proporcionó ningún archivo',
    INVALID_TYPE: 'Tipo de archivo no permitido. Solo JPG, PNG y WEBP.',
    FILE_TOO_LARGE: 'El archivo es demasiado grande. Máximo 5MB.',
    UPLOAD_FAILED: 'Error al subir la imagen',
} as const;

/**
 * Resultado de validación
 */
interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Valida un archivo antes de subirlo
 */
export function validateImageFile(file: File): ValidationResult {
    // Validar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: UPLOAD_ERRORS.INVALID_TYPE };
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: UPLOAD_ERRORS.FILE_TOO_LARGE };
    }

    return { valid: true };
}

/**
 * Genera un nombre de archivo único
 */
export function generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${timestamp}-${sanitizedName}`;
}

/**
 * Sube una imagen a Vercel Blob
 * @param file - Archivo a subir
 * @param folder - Carpeta de destino (ej: 'servicios', 'vehiculos')
 * @returns URL pública de la imagen en Vercel Blob
 */
export async function uploadImageToBlob(
    file: File,
    folder: 'servicios' | 'vehiculos' | 'conductores' = 'servicios'
): Promise<string> {
    // Validar archivo
    const validation = validateImageFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Generar nombre único
    const filename = generateUniqueFilename(file.name);
    const pathname = `${folder}/${filename}`;

    // Subir a Vercel Blob
    const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: false, // Ya tenemos timestamp en el nombre
    });

    return blob.url;
}
