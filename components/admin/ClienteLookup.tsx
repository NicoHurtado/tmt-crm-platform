'use client';

import { useEffect, useRef, useState } from 'react';
import { FiSearch, FiLoader, FiUserCheck, FiCheck } from 'react-icons/fi';
import type { ClienteEncontrado } from '@/lib/clientes';

interface ClienteLookupProps {
    onSelect: (cliente: ClienteEncontrado) => void;
    /** Valor inicial del buscador (p. ej. el celular ya escrito). */
    initialQuery?: string;
}

const TIPO_DOC: Record<string, string> = { CC: 'CC', CE: 'CE', PASAPORTE: 'Pasaporte', TI: 'TI' };

/**
 * Buscador de clientes recurrentes para cotizaciones: con el celular o el número de
 * documento trae los datos personales de reservas anteriores (nombre, celular, correo,
 * documento) para no volver a escribirlos.
 */
export default function ClienteLookup({ onSelect, initialQuery = '' }: ClienteLookupProps) {
    const [query, setQuery] = useState(initialQuery);
    const [loading, setLoading] = useState(false);
    const [resultados, setResultados] = useState<ClienteEncontrado[] | null>(null);
    const [aplicado, setAplicado] = useState<string | null>(null);
    const ultimaBusqueda = useRef(0);

    useEffect(() => {
        const limpio = query.replace(/[^0-9a-zA-Z]/g, '');
        if (limpio.length < 5) {
            setResultados(null);
            setLoading(false);
            return;
        }
        const id = ++ultimaBusqueda.current;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/clientes/buscar?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
                const data = await res.json();
                if (id !== ultimaBusqueda.current) return;
                setResultados(res.ok ? (data.data || []) : []);
            } catch {
                if (id === ultimaBusqueda.current) setResultados([]);
            } finally {
                if (id === ultimaBusqueda.current) setLoading(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    const usar = (c: ClienteEncontrado) => {
        onSelect(c);
        setAplicado(c.email || c.whatsapp);
    };

    return (
        <div className="mb-6 p-4 rounded-xl border border-blue-200 bg-blue-50/60">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
                <FiUserCheck className="text-blue-600" />
                ¿Cliente que ya ha reservado o cotizado?
            </label>
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    inputMode="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setAplicado(null); }}
                    placeholder="Escribe el celular o el número de documento"
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                />
                {loading && <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
                Llena nombre, celular, correo y documento. El servicio, la fecha y las direcciones se llenan aparte.
            </p>

            {resultados && !loading && resultados.length === 0 && (
                <p className="text-sm text-gray-600 mt-3">No encontramos clientes con ese dato. Llena los datos abajo.</p>
            )}

            {resultados && resultados.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {resultados.map((c) => {
                        const key = c.email || c.whatsapp;
                        const esAplicado = aplicado === key;
                        return (
                            <li key={key} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex-1 min-w-0 text-sm">
                                    <p className="font-semibold text-gray-900 truncate">{c.nombre}</p>
                                    <p className="text-gray-600 truncate">
                                        {c.whatsapp} · {c.email}
                                        {c.numeroDocumento ? ` · ${TIPO_DOC[c.tipoDocumento || ''] || c.tipoDocumento} ${c.numeroDocumento}` : ''}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {c.totalReservas} reserva{c.totalReservas !== 1 ? 's' : ''} · última el{' '}
                                        {new Date(c.ultimaReserva).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => usar(c)}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${esAplicado
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-[#D6A75D] hover:bg-[#C5964A] text-black'}`}
                                >
                                    {esAplicado ? <><FiCheck /> Datos llenados</> : 'Usar datos'}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
