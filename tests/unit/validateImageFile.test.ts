import { describe, it, expect } from 'vitest';
import { validateImageFile, UPLOAD_ERRORS } from '@/lib/upload';

/** Construye un File de `size` bytes con el tipo y nombre pedidos. */
function archivo(nombre: string, tipo: string, size = 1024): File {
    const f = new File([new Uint8Array(size)], nombre, { type: tipo });
    // File.size viene del contenido; se fuerza para probar el límite sin
    // reservar 6MB de memoria en el test.
    Object.defineProperty(f, 'size', { value: size });
    return f;
}

describe('validateImageFile', () => {
    it('acepta los formatos de siempre', () => {
        for (const [nombre, tipo] of [
            ['foto.jpg', 'image/jpeg'],
            ['foto.png', 'image/png'],
            ['foto.webp', 'image/webp'],
        ]) {
            expect(validateImageFile(archivo(nombre, tipo)).valid).toBe(true);
        }
    });

    // La cámara del iPhone entrega HEIC. Safari suele convertir a JPEG al subir,
    // pero compartiendo desde Archivos llega el HEIC tal cual y antes se
    // rechazaba, dejando al conductor sin poder poner su foto.
    it('acepta HEIC y HEIF', () => {
        expect(validateImageFile(archivo('IMG_0042.heic', 'image/heic')).valid).toBe(true);
        expect(validateImageFile(archivo('IMG_0042.heif', 'image/heif')).valid).toBe(true);
    });

    // Algunos navegadores móviles mandan el MIME vacío o genérico.
    it('cae a la extensión cuando el navegador no manda un MIME útil', () => {
        expect(validateImageFile(archivo('foto.jpg', '')).valid).toBe(true);
        expect(validateImageFile(archivo('foto.heic', 'application/octet-stream')).valid).toBe(true);
        expect(validateImageFile(archivo('documento.pdf', '')).valid).toBe(false);
    });

    // Un MIME presente manda sobre la extensión: si no, bastaba renombrar un
    // .pdf a .jpg para colarlo.
    it('no deja que la extensión desmienta un MIME explícito', () => {
        const r = validateImageFile(archivo('malicioso.jpg', 'application/pdf'));
        expect(r.valid).toBe(false);
        expect(r.error).toBe(UPLOAD_ERRORS.INVALID_TYPE);
    });

    it('rechaza formatos de imagen fuera de la lista', () => {
        expect(validateImageFile(archivo('animacion.gif', 'image/gif')).valid).toBe(false);
    });

    it('rechaza archivos de más de 5MB', () => {
        const r = validateImageFile(archivo('grande.jpg', 'image/jpeg', 6 * 1024 * 1024));
        expect(r.valid).toBe(false);
        expect(r.error).toBe(UPLOAD_ERRORS.FILE_TOO_LARGE);
    });
});
