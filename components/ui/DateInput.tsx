'use client';

import { useRef } from 'react';

interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
    min?: string;
    max?: string;
    showHelper?: boolean;
}

export default function DateInput({
    value,
    onChange,
    className = '',
    required = false,
    min,
    max,
    showHelper = false,
}: DateInputProps) {
    const ref = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        if (ref.current) {
            try {
                ref.current.showPicker();
            } catch {
                ref.current.focus();
            }
        }
    };

    return (
        <>
            <input
                ref={ref}
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                onClick={openPicker}
                onFocus={openPicker}
                className={`${className} [color-scheme:light] cursor-pointer`}
                required={required}
                min={min}
                max={max}
            />
            {showHelper && (
                <p className="text-xs text-gray-500 mt-1">
                    Selecciona la fecha en el calendario
                </p>
            )}
        </>
    );
}
