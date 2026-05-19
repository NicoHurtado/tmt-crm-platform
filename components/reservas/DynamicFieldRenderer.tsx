'use client';

import { DynamicField, DynamicFieldValues } from '@/types/dynamic-fields';
import { useState } from 'react';
import { FiMinus, FiPlus } from 'react-icons/fi';

interface DynamicFieldRendererProps {
    field: DynamicField;
    value: any;
    onChange: (value: any) => void;
    language: 'ES' | 'EN';
}

export default function DynamicFieldRenderer({
    field,
    value,
    onChange,
    language,
}: DynamicFieldRendererProps) {
    const lang = language.toLowerCase() as 'es' | 'en';
    const label = field.etiqueta[lang];
    const placeholder = field.placeholder?.[lang];

    const renderField = () => {
        switch (field.tipo) {
            case 'TEXT':
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        required={field.requerido}
                        maxLength={field.tipo === 'TEXT' && 'maxLength' in field ? field.maxLength : undefined}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent"
                    />
                );

            case 'TEXTAREA':
                return (
                    <textarea
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        required={field.requerido}
                        rows={field.tipo === 'TEXTAREA' && 'rows' in field ? field.rows : 4}
                        maxLength={field.tipo === 'TEXTAREA' && 'maxLength' in field ? field.maxLength : undefined}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent resize-none"
                    />
                );

            case 'SELECT':
                if (field.tipo === 'SELECT' && 'opciones' in field) {
                    return (
                        <select
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            required={field.requerido}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent"
                        >
                            <option value="">
                                {language === 'ES' ? 'Selecciona una opción' : 'Select an option'}
                            </option>
                            {field.opciones.map((opcion) => (
                                <option key={opcion.valor} value={opcion.valor}>
                                    {opcion.etiqueta[lang]}
                                    {opcion.precio && ` (+$${opcion.precio.toLocaleString('es-CO')})`}
                                </option>
                            ))}
                        </select>
                    );
                }
                return null;

            case 'SWITCH':
                return (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onChange(!value)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${value ? 'bg-[#D6A75D]' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                        <span className="text-sm font-medium">
                            {value
                                ? language === 'ES'
                                    ? 'Sí'
                                    : 'Yes'
                                : language === 'ES'
                                    ? 'No'
                                    : 'No'}
                        </span>
                        {field.tienePrecio && field.precioUnitario && value && (
                            <span className="text-sm text-[#D6A75D] font-semibold">
                                +${field.precioUnitario.toLocaleString('es-CO')}
                            </span>
                        )}
                    </div>
                );

            case 'COUNTER':
                if (field.tipo === 'COUNTER') {
                    const currentValue = typeof value === 'number' ? value : field.min || 0;
                    return (
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    const newValue = Math.max(field.min || 0, currentValue - (field.step || 1));
                                    onChange(newValue);
                                }}
                                disabled={currentValue <= (field.min || 0)}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiMinus />
                            </button>

                            <div className="text-center min-w-[60px]">
                                <div className="text-2xl font-bold">{currentValue}</div>
                                {field.tienePrecio && field.precioUnitario && currentValue > 0 && (
                                    <div className="text-sm text-[#D6A75D] font-semibold">
                                        ${(currentValue * field.precioUnitario).toLocaleString('es-CO')}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    const newValue = currentValue + (field.step || 1);
                                    if (!field.max || newValue <= field.max) {
                                        onChange(newValue);
                                    }
                                }}
                                disabled={field.max ? currentValue >= field.max : false}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <FiPlus />
                            </button>
                        </div>
                    );
                }
                return null;

            default:
                return null;
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {label}
                {field.requerido && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField()}
            {field.ayuda && (
                <p className="text-sm text-gray-500">{field.ayuda[lang]}</p>
            )}
        </div>
    );
}

/**
 * Renders all dynamic fields for a service
 */
export function DynamicFieldsSection({
    fields,
    values,
    onChange,
    language,
}: {
    fields: DynamicField[];
    values: DynamicFieldValues;
    onChange: (values: DynamicFieldValues) => void;
    language: 'ES' | 'EN';
}) {
    if (!fields || fields.length === 0) {
        return null;
    }

    const handleFieldChange = (clave: string, value: any) => {
        onChange({
            ...values,
            [clave]: value,
        });
    };

    // Sort fields by orden
    const sortedFields = [...fields].sort((a, b) => a.orden - b.orden);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                {language === 'ES' ? 'Información Adicional' : 'Additional Information'}
            </h3>
            {sortedFields.map((field) => (
                <DynamicFieldRenderer
                    key={field.clave}
                    field={field}
                    value={values[field.clave]}
                    onChange={(value) => handleFieldChange(field.clave, value)}
                    language={language}
                />
            ))}
        </div>
    );
}
