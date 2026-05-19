'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Aliado {
    id: string;
    nombre: string;
    codigo: string;
    tipo: string;
}

const STORAGE_KEY = 'aliado';
const EVENT_NAME = 'aliadoChanged';

export function useAliado() {
    const [aliado, setAliadoState] = useState<Aliado | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setAliadoState(JSON.parse(stored));
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setReady(true);

        const handleChange = () => {
            const updated = localStorage.getItem(STORAGE_KEY);
            if (updated) {
                try {
                    setAliadoState(JSON.parse(updated));
                } catch {
                    setAliadoState(null);
                }
            } else {
                setAliadoState(null);
            }
        };

        window.addEventListener(EVENT_NAME, handleChange);
        return () => window.removeEventListener(EVENT_NAME, handleChange);
    }, []);

    const login = useCallback((data: Aliado) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setAliadoState(data);
        window.dispatchEvent(new Event(EVENT_NAME));
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setAliadoState(null);
        window.dispatchEvent(new Event(EVENT_NAME));
    }, []);

    return { aliado, login, logout, ready };
}
