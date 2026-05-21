import cloudinary from '@/lib/cloudinary';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const UPLOAD_ERRORS = {
    NO_FILE: 'No se proporcionó ningún archivo',
    INVALID_TYPE: 'Tipo de archivo no permitido. Solo JPG, PNG y WEBP.',
    FILE_TOO_LARGE: 'El archivo es demasiado grande. Máximo 5MB.',
    UPLOAD_FAILED: 'Error al subir la imagen',
} as const;

interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateImageFile(file: File): ValidationResult {
    if (!ALLOWED_TYPES.includes(file.type)) {
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
