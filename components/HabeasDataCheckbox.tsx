'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HabeasDataCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    required?: boolean;
}

export default function HabeasDataCheckbox({
    checked,
    onChange,
    required = true
}: HabeasDataCheckboxProps) {
    const [error, setError] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        onChange(isChecked);
        if (required && !isChecked) {
            setError(true);
        } else {
            setError(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    id="habeas-data-checkbox"
                    checked={checked}
                    onChange={handleChange}
                    className={`mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${error ? 'border-red-500' : ''
                        }`}
                    required={required}
                />
                <label
                    htmlFor="habeas-data-checkbox"
                    className="text-sm text-gray-700 cursor-pointer"
                >
                    Acepto la{' '}
                    <Link
                        href="/politica-privacidad"
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                        Política de Tratamiento de Datos Personales
                    </Link>
                    {' '}y autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012.
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            </div>

            {error && (
                <p className="text-sm text-red-600 ml-7">
                    Debes aceptar la política de tratamiento de datos para continuar
                </p>
            )}

            <p className="text-xs text-gray-500 ml-7">
                Tus datos serán utilizados únicamente para la prestación del servicio de transporte
                y comunicaciones relacionadas. Puedes consultar, actualizar o eliminar tus datos en
                cualquier momento.
            </p>
        </div>
    );
}
