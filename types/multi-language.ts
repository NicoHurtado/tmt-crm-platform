import { z } from 'zod';

/**
 * Multi-language text schema
 * Used for service name, description, and included items
 */
export const MultiLangTextSchema = z.object({
    es: z.string().min(1, 'Texto en español requerido'),
    en: z.string().min(1, 'English text required'),
});

export type MultiLangText = z.infer<typeof MultiLangTextSchema>;

/**
 * Multi-language array schema
 * Used for "incluye" (what's included) list
 */
export const MultiLangArraySchema = z.object({
    es: z.array(z.string()).min(1, 'Al menos un item en español'),
    en: z.array(z.string()).min(1, 'At least one item in English'),
});

export type MultiLangArray = z.infer<typeof MultiLangArraySchema>;

/**
 * Helper function to get text in specified language
 */
export function getLocalizedText(
    text: unknown,
    language: 'ES' | 'EN' | 'es' | 'en'
): string {
    try {
        const parsed = MultiLangTextSchema.parse(text);
        const lang = language.toUpperCase() as 'ES' | 'EN';
        return lang === 'ES' ? parsed.es : parsed.en;
    } catch {
        // Fallback: try to access properties directly if it's an object
        if (text && typeof text === 'object') {
            const obj = text as any;
            const lang = language.toLowerCase();
            // Try specific language, then 'es', then 'en', then first value
            return obj[lang] || obj['es'] || obj['en'] || Object.values(obj)[0] || '';
        }

        // Fallback for old format (plain string)
        if (typeof text === 'string') {
            return text;
        }
        return '';
    }
}

/**
 * Helper function to get array in specified language
 */
export function getLocalizedArray(
    arr: unknown,
    language: 'ES' | 'EN' | 'es' | 'en'
): string[] {
    try {
        const parsed = MultiLangArraySchema.parse(arr);
        const lang = language.toUpperCase() as 'ES' | 'EN';
        return lang === 'ES' ? parsed.es : parsed.en;
    } catch {
        // Fallback for old format (string array)
        if (Array.isArray(arr) && arr.every(item => typeof item === 'string')) {
            return arr;
        }
        return [];
    }
}

/**
 * Create multi-language text object
 */
export function createMultiLangText(es: string, en: string): MultiLangText {
    return { es, en };
}

/**
 * Create multi-language array object
 */
export function createMultiLangArray(es: string[], en: string[]): MultiLangArray {
    return { es, en };
}
