// lib/aliado-match.ts
//
// Identifica a un aliado a partir de lo que escribe el huésped por WhatsApp
// ("vengo de parte de Amoblados Velázquez", "Housy", "código 982705").
// Tolera mayúsculas, tildes, espacios, la palabra "hotel"/"hostel" y errores de una o
// dos letras (Velázquez ↔ VELASQUEZ). Función pura: recibe la lista de aliados activos.

export interface AliadoCandidato {
    id: string;
    nombre: string;
    codigo: string;
}

export type ResultadoAliado<T extends AliadoCandidato> =
    | { estado: 'encontrado'; aliado: T }
    | { estado: 'ambiguo'; candidatos: T[] }
    | { estado: 'no_encontrado'; candidatos: T[] };

const PALABRAS_GENERICAS = new Set(['hotel', 'hoteles', 'hostel', 'hostal', 'airbnb', 'agencia', 'tmt', 'travel', 'the', 'de', 'la', 'el', 'los', 'las', 'sas']);

function sinTildes(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Palabras significativas del texto (sin tildes, sin palabras genéricas). */
function palabras(s: string): string[] {
    return sinTildes(s)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 0 && !PALABRAS_GENERICAS.has(w));
}

/** Texto compacto para comparar: "Amoblados Velázquez" → "amobladosvelazquez". */
export function compactarNombre(s: string): string {
    return palabras(s).join('');
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

/** Similitud 0..1 entre dos textos compactos. */
function similitud(a: string, b: string): number {
    const max = Math.max(a.length, b.length);
    return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

/**
 * Puntaje de coincidencia entre lo que escribió el huésped y el nombre del aliado (0..1).
 * 1 = idéntico; ≥ 0.8 se considera el mismo aliado.
 */
export function puntajeAliado(texto: string, nombreAliado: string): number {
    const q = compactarNombre(texto);
    const n = compactarNombre(nombreAliado);
    if (q.length < 3 || n.length < 3) return 0;
    if (q === n) return 1;
    // El huésped escribió el nombre completo dentro de una frase, o solo una parte distintiva.
    if (q.includes(n)) return 0.95;
    if (n.includes(q) && q.length >= 4) return 0.9;
    let mejor = similitud(q, n);
    // Comparar también contra ventanas de la frase del tamaño del nombre ("vengo de parte de X").
    const ws = palabras(texto);
    const nPalabras = Math.max(1, palabras(nombreAliado).length);
    for (let i = 0; i + nPalabras <= ws.length; i++) {
        mejor = Math.max(mejor, similitud(ws.slice(i, i + nPalabras).join(''), n));
    }
    return mejor;
}

const UMBRAL = 0.8;

/**
 * Busca el aliado que corresponde al texto: primero por código exacto (6 dígitos del
 * aliado), luego por nombre. Si dos aliados quedan con el mismo puntaje alto, es ambiguo.
 */
export function buscarAliado<T extends AliadoCandidato>(texto: string, aliados: T[]): ResultadoAliado<T> {
    const limpio = String(texto ?? '').trim();
    const porCodigo = aliados.find((a) => a.codigo === limpio || (/^\d{4,}$/.test(a.codigo) && new RegExp(`\\b${a.codigo}\\b`).test(limpio)));
    if (porCodigo) return { estado: 'encontrado', aliado: porCodigo };

    const puntuados = aliados
        .map((a) => ({ a, p: puntajeAliado(limpio, a.nombre) }))
        .sort((x, y) => y.p - x.p);
    const aptos = puntuados.filter((x) => x.p >= UMBRAL);
    if (aptos.length === 0) {
        return { estado: 'no_encontrado', candidatos: puntuados.filter((x) => x.p >= 0.5).slice(0, 3).map((x) => x.a) };
    }
    if (aptos.length > 1 && aptos[0].p - aptos[1].p < 0.05) {
        return { estado: 'ambiguo', candidatos: aptos.slice(0, 3).map((x) => x.a) };
    }
    return { estado: 'encontrado', aliado: aptos[0].a };
}
