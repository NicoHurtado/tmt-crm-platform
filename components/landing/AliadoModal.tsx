'use client';

import { useState } from 'react';
import { FiX, FiArrowRight, FiLoader } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import { useAliado, type Aliado } from '@/lib/hooks/useAliado';

interface AliadoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (aliado: Aliado) => void;
}

export default function AliadoModal({ isOpen, onClose, onSuccess }: AliadoModalProps) {
    const { language } = useLanguage();
    const { login } = useAliado();
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/public/aliados/validar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || t('landing.error_validar', language));
            }

            login(data.data);
            setCodigo('');
            onClose();
            if (onSuccess) onSuccess(data.data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <FiX size={24} />
                </button>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-2">
                        {t('landing.aliado_titulo', language)}
                    </h2>
                    <p className="text-gray-600">
                        {t('landing.aliado_descripcion', language)}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('landing.aliado_codigo', language)}
                        </label>
                        <input
                            type="text"
                            id="codigo"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                            placeholder="Ej: HTL123"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none transition-all text-center text-lg tracking-widest uppercase"
                            maxLength={6}
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || codigo.length < 3}
                        className="w-full bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <FiLoader className="animate-spin" /> {t('landing.validando', language)}
                            </>
                        ) : (
                            <>
                                {t('landing.acceder', language)} <FiArrowRight />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
