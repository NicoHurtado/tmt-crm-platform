'use client';

import { useState, useEffect } from 'react';
import { DynamicField, DynamicFieldValues, validateDynamicFields } from '@/types/dynamic-fields';
import { DynamicFieldsSection } from '@/components/reservas/DynamicFieldRenderer';

interface DynamicFieldsProps {
    fields: any; // Accept any type - can be string, array, or object
    values: DynamicFieldValues;
    onChange: (values: DynamicFieldValues) => void;
    onPriceChange?: (price: number) => void;
    language?: 'ES' | 'EN';
}

export default function DynamicFields({
    fields,
    values,
    onChange,
    onPriceChange,
    language = 'ES',
}: DynamicFieldsProps) {
    // 1. Component Mount Log
    console.log('🚀 [DynamicFields] Component MOUNTED. Received fields:', {
        type: typeof fields,
        isArray: Array.isArray(fields),
        fields
    });

    const [dynamicPrice, setDynamicPrice] = useState(0);
    const [validatedFields, setValidatedFields] = useState<DynamicField[]>([]);

    // 2. Robust Validation (Supports both Array and String)
    useEffect(() => {
        console.log('🔄 [DynamicFields] Starting validation...');

        let fieldsToValidate = fields;

        // If it's a JSON string, parse it first
        if (typeof fields === 'string') {
            try {
                fieldsToValidate = JSON.parse(fields);
                console.log('✅ Parsed JSON string successfully');
            } catch (e) {
                console.error('❌ Error parsing JSON string:', e);
                setValidatedFields([]);
                return;
            }
        }

        // Now validate with the utility function
        try {
            const parsed = validateDynamicFields(fieldsToValidate);
            console.log('✅ [DynamicFields] Validation success:', parsed.length, 'fields', parsed);
            setValidatedFields(parsed);
        } catch (error) {
            console.warn('⚠️ Strict validation failed, trying fallback...');
            // Fallback: If it's already an array, use it directly
            if (Array.isArray(fieldsToValidate)) {
                console.log('⚠️ Using raw array as fallback:', fieldsToValidate);
                setValidatedFields(fieldsToValidate as DynamicField[]);
            } else {
                console.error('❌ Critical: Could not extract fields', error);
                setValidatedFields([]);
            }
        }
    }, [fields]);

    // 3. Price Calculation
    useEffect(() => {
        if (validatedFields.length === 0) {
            console.log('⏭️ Skipping price calculation - no validated fields');
            return;
        }

        let total = 0;

        console.log('🔄 Starting price calculation...', { values, validatedFields });

        validatedFields.forEach((field) => {
            console.log(`\n📋 Processing field: ${field.clave}`, {
                tipo: field.tipo,
                tienePrecio: field.tienePrecio,
                precioUnitario: field.precioUnitario,
                value: values[field.clave]
            });

            if (!field.tienePrecio || !field.precioUnitario) {
                console.log(`  ⏭️ Skipping ${field.clave} - no tiene precio configurado`);
                return;
            }

            const value = values[field.clave];
            if (value === undefined || value === null) {
                console.log(`  ⏭️ Skipping ${field.clave} - no value`);
                return;
            }

            switch (field.tipo) {
                case 'SWITCH':
                    if (value === true) {
                        console.log(`  ✅ SWITCH ${field.clave}: Adding ${field.precioUnitario}`);
                        total += field.precioUnitario;
                    }
                    break;

                case 'COUNTER':
                    if (typeof value === 'number' && value > 0) {
                        const price = value * field.precioUnitario;
                        console.log(`  ✅ COUNTER ${field.clave}: ${value} x ${field.precioUnitario} = ${price}`);
                        total += price;
                    }
                    break;

                case 'SELECT':
                    if (field.tipo === 'SELECT' && 'opciones' in field) {
                        console.log(`  🔍 SELECT ${field.clave}:`, {
                            selectedValue: value,
                            opciones: field.opciones
                        });

                        const selectedOption = field.opciones.find((opt) => opt.valor === value);
                        console.log(`  📌 Found option:`, selectedOption);

                        if (selectedOption?.precio) {
                            console.log(`  ✅ SELECT ${field.clave}: Adding option price ${selectedOption.precio}`);
                            total += selectedOption.precio;
                        } else {
                            console.log(`  ⚠️ SELECT ${field.clave}: No price found for selected option`);
                        }
                    }
                    break;
            }
        });

        console.log('💰 Final price calculation:', { total, previousPrice: dynamicPrice });

        if (total !== dynamicPrice) {
            console.log(`💵 Updating price from ${dynamicPrice} to ${total}`);
            setDynamicPrice(total);
            if (onPriceChange) {
                onPriceChange(total);
            }
        }
    }, [values, validatedFields, dynamicPrice, onPriceChange]);

    // Render
    if (!validatedFields || validatedFields.length === 0) {
        console.log('👻 [DynamicFields] Render blocked: No validated fields');
        return null;
    }

    console.log('🎨 [DynamicFields] Rendering with', validatedFields.length, 'fields');

    return (
        <div className="space-y-4">
            <DynamicFieldsSection
                fields={validatedFields}
                values={values}
                onChange={onChange}
                language={language}
            />

            {dynamicPrice > 0 && (
                <div className="bg-[#D6A75D]/20 border border-[#D6A75D] rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700">
                        <span className="font-bold text-[#D6A75D]">
                            +${dynamicPrice.toLocaleString('es-CO')}
                        </span>
                    </p>
                </div>
            )}
        </div>
    );
}








