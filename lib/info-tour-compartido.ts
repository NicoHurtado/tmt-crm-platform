/** Shape stored in Servicio.infoTourCompartido (JSON) */
export type InfoTourCompartidoBilingue = { es: string; en: string };

export type InfoTourCompartidoShape = {
    titulo: InfoTourCompartidoBilingue;
    encuentro: InfoTourCompartidoBilingue;
    salida: InfoTourCompartidoBilingue;
    nota: InfoTourCompartidoBilingue;
};

export const EMPTY_INFO_TOUR_COMPARTIDO: InfoTourCompartidoShape = {
    titulo: { es: '', en: '' },
    encuentro: { es: '', en: '' },
    salida: { es: '', en: '' },
    nota: { es: '', en: '' },
};

/** Textos que antes estaban fijos en el código; el admin los puede cambiar. */
export const PRESET_INFO_TOUR_COMPARTIDO: InfoTourCompartidoShape = {
    titulo: { es: 'Logística del tour', en: 'Tour logistics' },
    encuentro: {
        es: 'Casa del Reloj · Cra 35 con Cll 7, Provenza.',
        en: 'Casa del Reloj · Cra 35 with Calle 7, Provenza.',
    },
    salida: { es: '7:50 AM', en: '7:50 AM' },
    nota: {
        es: 'Sin servicio de recogida — debes llegar por tu cuenta.',
        en: 'No pickup — you must arrive on your own.',
    },
};

function pickPair(raw: unknown, key: string): InfoTourCompartidoBilingue {
    if (!raw || typeof raw !== 'object') return { es: '', en: '' };
    const o = raw as Record<string, unknown>;
    const v = o[key];
    if (!v || typeof v !== 'object') return { es: '', en: '' };
    const b = v as Record<string, string>;
    return {
        es: String(b.es ?? b.ES ?? '').trim(),
        en: String(b.en ?? b.EN ?? '').trim(),
    };
}

export function normalizeInfoTourCompartido(raw: unknown): InfoTourCompartidoShape {
    if (!raw || typeof raw !== 'object') {
        return { ...EMPTY_INFO_TOUR_COMPARTIDO };
    }
    return {
        titulo: pickPair(raw, 'titulo'),
        encuentro: pickPair(raw, 'encuentro'),
        salida: pickPair(raw, 'salida'),
        nota: pickPair(raw, 'nota'),
    };
}

export function isInfoTourCompartidoEmpty(n: InfoTourCompartidoShape): boolean {
    const pairs = [n.titulo, n.encuentro, n.salida, n.nota];
    return pairs.every((p) => !p.es.trim() && !p.en.trim());
}

/** Formulario admin: si en BD no hay datos, muestra el preset listo para guardar. */
export function infoTourCompartidoForAdminForm(raw: unknown): InfoTourCompartidoShape {
    const n = normalizeInfoTourCompartido(raw);
    if (isInfoTourCompartidoEmpty(n)) {
        return {
            titulo: { ...PRESET_INFO_TOUR_COMPARTIDO.titulo },
            encuentro: { ...PRESET_INFO_TOUR_COMPARTIDO.encuentro },
            salida: { ...PRESET_INFO_TOUR_COMPARTIDO.salida },
            nota: { ...PRESET_INFO_TOUR_COMPARTIDO.nota },
        };
    }
    return n;
}

/** Solo textos del admin; si un idioma está vacío, usa el otro. Sin valores inventados. */
function pickLineNoDefault(n: InfoTourCompartidoBilingue, L: 'es' | 'en'): string {
    const primary = n[L]?.trim();
    if (primary) return primary;
    const alt = L === 'es' ? n.en?.trim() : n.es?.trim();
    return alt || '';
}

export type SharedTourLogisticsDisplay = {
    titulo: string;
    encuentro: string;
    salida: string;
    nota: string;
};

/** Si no hay ningún dato guardado en el admin, devuelve null (no se muestra tarjeta). */
export function getSharedTourLogisticsDisplay(
    info: unknown,
    lang: 'es' | 'en'
): SharedTourLogisticsDisplay | null {
    const n = normalizeInfoTourCompartido(info);
    const L = lang === 'en' ? 'en' : 'es';
    const titulo = pickLineNoDefault(n.titulo, L);
    const encuentro = pickLineNoDefault(n.encuentro, L);
    const salida = pickLineNoDefault(n.salida, L);
    const nota = pickLineNoDefault(n.nota, L);
    if (!titulo && !encuentro && !salida && !nota) return null;
    return { titulo, encuentro, salida, nota };
}
