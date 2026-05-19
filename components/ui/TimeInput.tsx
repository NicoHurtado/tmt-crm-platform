'use client';

import { useState, useEffect } from 'react';

interface TimeInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
    showHelper?: boolean;
}

export default function TimeInput({ value, onChange, className = '', placeholder = 'Ej: 16:50', required = false, showHelper = true }: TimeInputProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        // Detectar si es dispositivo móvil
        const checkMobile = () => {
            const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
            setIsMobile(mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        // Sincronizar el displayValue con el value prop
        if (value && !isMobile) {
            setDisplayValue(value);
        }
    }, [value, isMobile]);

    const handleDesktopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value.replace(/[^\d]/g, ''); // Solo números
        
        // Limitar a 4 dígitos (hhmm)
        if (inputValue.length > 4) {
            inputValue = inputValue.slice(0, 4);
        }

        // Formatear con ":"
        let formatted = '';
        if (inputValue.length > 0) {
            formatted = inputValue.slice(0, 2);
            if (inputValue.length > 2) {
                formatted += ':' + inputValue.slice(2, 4);
            }
        }

        setDisplayValue(formatted);

        // Si está completo, validar
        if (inputValue.length === 4) {
            const hours = parseInt(inputValue.slice(0, 2));
            const minutes = parseInt(inputValue.slice(2, 4));

            // Validación básica
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                onChange(timeValue);
            }
        } else if (formatted === '') {
            onChange('');
        }
    };

    const handleDesktopBlur = () => {
        // Al perder el foco, validar la hora completa
        if (displayValue.length === 5) {
            const parts = displayValue.split(':');
            if (parts.length === 2) {
                const hours = parseInt(parts[0]);
                const minutes = parseInt(parts[1]);

                if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                    const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    onChange(timeValue);
                    setDisplayValue(timeValue);
                }
            }
        }
    };

    if (isMobile) {
        // En móviles, usar el input nativo
        return (
            <input
                type="time"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={className}
                required={required}
            />
        );
    }

    // En desktop, usar input de texto con máscara
    return (
        <>
            <input
                type="text"
                value={displayValue}
                onChange={handleDesktopChange}
                onBlur={handleDesktopBlur}
                placeholder={placeholder}
                className={className}
                required={required}
                maxLength={5}
            />
            {showHelper && (
                <p className="text-xs text-gray-500 mt-1">
                    Formato 24 horas (00:00 - 23:59). Ejemplo: 09:30, 16:50, 22:15
                </p>
            )}
        </>
    );
}

