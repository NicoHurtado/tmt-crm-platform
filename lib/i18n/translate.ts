// Función de traducción con soporte para claves anidadas
import es from './es.json';
import en from './en.json';

export type Language = 'es' | 'en';

const translations = {
    es,
    en
};

/**
 * Traduce una clave al idioma especificado
 * @param key - Clave de traducción en formato "seccion.subseccion.clave"
 * @param lang - Idioma ('es' | 'en')
 * @param params - Parámetros opcionales para interpolación {nombre: 'valor'}
 * @returns Texto traducido o la clave si no se encuentra
 */
export function t(key: string, lang: Language = 'es', params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = translations[lang];

    // Navegar por las claves anidadas
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // Si no se encuentra la clave, retornar la clave original
            console.warn(`Translation key not found: ${key} for language: ${lang}`);
            return key;
        }
    }

    // Si el valor final no es string, retornar la clave
    if (typeof value !== 'string') {
        console.warn(`Translation value is not a string: ${key}`);
        return key;
    }

    // Interpolación de parámetros si existen
    if (params) {
        return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
            return text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
        }, value);
    }

    return value;
}

/**
 * Formatea un precio en formato colombiano
 */
export function formatPrice(amount: number, lang: Language = 'es'): string {
    return new Intl.NumberFormat(lang === 'es' ? 'es-CO' : 'en-US', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Formatea una fecha según el idioma
 */
export function formatDate(date: Date | string, lang: Language = 'es'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat(lang === 'es' ? 'es-CO' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(dateObj);
}

/**
 * Formatea una hora
 */
export function formatTime(time: string): string {
    return time;
}
