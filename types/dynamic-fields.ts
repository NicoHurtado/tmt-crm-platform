import { z } from 'zod';

// ============================================
// MULTI-LANGUAGE TEXT
// ============================================

export const MultiLangTextSchema = z.object({
    es: z.string().min(1, 'Texto en español requerido'),
    en: z.string().min(1, 'English text required'),
});

export type MultiLangText = z.infer<typeof MultiLangTextSchema>;

// ============================================
// BASE FIELD SCHEMA
// ============================================

const BaseFieldSchema = z.object({
    clave: z
        .string()
        .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
        .min(1, 'Clave requerida'),
    etiqueta: MultiLangTextSchema,
    tipo: z.enum(['TEXT', 'SELECT', 'SWITCH', 'COUNTER', 'TEXTAREA']),
    requerido: z.boolean().default(false),
    placeholder: MultiLangTextSchema.optional(),
    ayuda: MultiLangTextSchema.optional(),
    orden: z.number().int().min(0),
    tienePrecio: z.boolean().default(false),
    precioUnitario: z.number().min(0).optional(),
});

// ============================================
// SELECT FIELD OPTION
// ============================================

export const SelectOptionSchema = z.object({
    valor: z.string().min(1, 'Valor requerido'),
    etiqueta: MultiLangTextSchema,
    precio: z.number().min(0).optional(),
});

export type SelectOption = z.infer<typeof SelectOptionSchema>;

// ============================================
// FIELD SCHEMAS BY TYPE
// ============================================

export const TextFieldSchema = BaseFieldSchema.extend({
    tipo: z.literal('TEXT'),
    maxLength: z.number().int().positive().optional(),
});

export const TextAreaFieldSchema = BaseFieldSchema.extend({
    tipo: z.literal('TEXTAREA'),
    maxLength: z.number().int().positive().optional(),
    rows: z.number().int().min(2).max(10).default(4),
});

export const SelectFieldSchema = BaseFieldSchema.extend({
    tipo: z.literal('SELECT'),
    opciones: z.array(SelectOptionSchema).min(1, 'Debe tener al menos una opción'),
});

export const SwitchFieldSchema = BaseFieldSchema.extend({
    tipo: z.literal('SWITCH'),
});

export const CounterFieldSchema = BaseFieldSchema.extend({
    tipo: z.literal('COUNTER'),
    min: z.number().int().min(0).default(0),
    max: z.number().int().positive().optional(),
    step: z.number().int().positive().default(1),
});

// ============================================
// UNION OF ALL FIELD TYPES
// ============================================

export const DynamicFieldSchema = z.discriminatedUnion('tipo', [
    TextFieldSchema,
    TextAreaFieldSchema,
    SelectFieldSchema,
    SwitchFieldSchema,
    CounterFieldSchema,
]);

export const DynamicFieldsArraySchema = z.array(DynamicFieldSchema);

// ============================================
// TYPESCRIPT TYPES
// ============================================

export type DynamicField = z.infer<typeof DynamicFieldSchema>;
export type TextField = z.infer<typeof TextFieldSchema>;
export type TextAreaField = z.infer<typeof TextAreaFieldSchema>;
export type SelectField = z.infer<typeof SelectFieldSchema>;
export type SwitchField = z.infer<typeof SwitchFieldSchema>;
export type CounterField = z.infer<typeof CounterFieldSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates dynamic fields configuration from database
 * @param fields - Raw JSON data from database
 * @returns Validated array of dynamic fields
 * @throws ZodError if validation fails
 */
export function validateDynamicFields(fields: unknown): DynamicField[] {
    try {
        return DynamicFieldsArraySchema.parse(fields);
    } catch (error) {
        console.error('❌ Invalid dynamic fields configuration:', error);
        throw error;
    }
}

/**
 * Safely validates dynamic fields, returning empty array on error
 * @param fields - Raw JSON data from database
 * @returns Validated array or empty array if invalid
 */
export function validateDynamicFieldsSafe(fields: unknown): DynamicField[] {
    try {
        return DynamicFieldsArraySchema.parse(fields);
    } catch (error) {
        console.warn('⚠️ Invalid dynamic fields configuration, returning empty array');
        return [];
    }
}

// ============================================
// DYNAMIC FIELD VALUES (FOR RESERVATIONS)
// ============================================

/**
 * Schema for dynamic field values submitted by users
 * Keys are field claves, values can be string, number, or boolean
 */
export const DynamicFieldValuesSchema = z.record(
    z.string(), // field clave
    z.union([z.string(), z.number(), z.boolean()]) // field value
);

export type DynamicFieldValues = z.infer<typeof DynamicFieldValuesSchema>;

/**
 * Validates user-submitted dynamic field values against field configuration
 * @param values - User submitted values
 * @param fields - Field configuration from service
 * @returns Validation result with errors if any
 */
export function validateFieldValues(
    values: unknown,
    fields: DynamicField[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // First validate basic structure
    const parseResult = DynamicFieldValuesSchema.safeParse(values);
    if (!parseResult.success) {
        return { valid: false, errors: ['Estructura de datos inválida'] };
    }

    const fieldValues = parseResult.data;

    // Validate each required field is present
    for (const field of fields) {
        if (field.requerido && !fieldValues[field.clave]) {
            errors.push(`Campo requerido: ${field.etiqueta.es}`);
        }

        const value = fieldValues[field.clave];
        if (value === undefined || value === null) continue;

        // Type-specific validation
        switch (field.tipo) {
            case 'TEXT':
            case 'TEXTAREA':
                if (typeof value !== 'string') {
                    errors.push(`${field.etiqueta.es} debe ser texto`);
                } else if (field.maxLength && value.length > field.maxLength) {
                    errors.push(
                        `${field.etiqueta.es} excede el máximo de ${field.maxLength} caracteres`
                    );
                }
                break;

            case 'COUNTER':
                if (typeof value !== 'number') {
                    errors.push(`${field.etiqueta.es} debe ser un número`);
                } else {
                    if (value < field.min) {
                        errors.push(`${field.etiqueta.es} debe ser al menos ${field.min}`);
                    }
                    if (field.max && value > field.max) {
                        errors.push(`${field.etiqueta.es} no puede exceder ${field.max}`);
                    }
                }
                break;

            case 'SWITCH':
                if (typeof value !== 'boolean') {
                    errors.push(`${field.etiqueta.es} debe ser verdadero o falso`);
                }
                break;

            case 'SELECT':
                if (typeof value !== 'string') {
                    errors.push(`${field.etiqueta.es} debe ser una opción válida`);
                } else {
                    const validOptions = field.opciones.map((opt) => opt.valor);
                    if (!validOptions.includes(value)) {
                        errors.push(`${field.etiqueta.es} tiene una opción inválida`);
                    }
                }
                break;
        }
    }

    return { valid: errors.length === 0, errors };
}

// ============================================
// HELPER FUNCTIONS FOR FIELD CREATION
// ============================================

/**
 * Creates a new text field with default values
 */
export function createTextField(
    clave: string,
    etiquetaEs: string,
    etiquetaEn: string,
    orden: number
): TextField {
    return {
        tipo: 'TEXT',
        clave,
        etiqueta: { es: etiquetaEs, en: etiquetaEn },
        requerido: false,
        orden,
        tienePrecio: false,
    };
}

/**
 * Creates a new counter field with pricing
 */
export function createCounterField(
    clave: string,
    etiquetaEs: string,
    etiquetaEn: string,
    orden: number,
    precioUnitario?: number
): CounterField {
    return {
        tipo: 'COUNTER',
        clave,
        etiqueta: { es: etiquetaEs, en: etiquetaEn },
        requerido: false,
        orden,
        min: 0,
        step: 1,
        tienePrecio: !!precioUnitario,
        precioUnitario,
    };
}

/**
 * Creates a new switch field with optional pricing
 */
export function createSwitchField(
    clave: string,
    etiquetaEs: string,
    etiquetaEn: string,
    orden: number,
    precioUnitario?: number
): SwitchField {
    return {
        tipo: 'SWITCH',
        clave,
        etiqueta: { es: etiquetaEs, en: etiquetaEn },
        requerido: false,
        orden,
        tienePrecio: !!precioUnitario,
        precioUnitario,
    };
}

/**
 * Creates a new select field with options
 */
export function createSelectField(
    clave: string,
    etiquetaEs: string,
    etiquetaEn: string,
    orden: number,
    opciones: SelectOption[]
): SelectField {
    return {
        tipo: 'SELECT',
        clave,
        etiqueta: { es: etiquetaEs, en: etiquetaEn },
        requerido: false,
        orden,
        opciones,
        tienePrecio: false,
    };
}
