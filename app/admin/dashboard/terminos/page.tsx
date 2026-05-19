'use client';

import { useState, useEffect } from 'react';
import { ScrollText, Save, CheckCircle, Eye, EyeOff } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

const TABS = [
    { key: 'terminos_condiciones', label: 'Términos y Condiciones', path: '/terminos-condiciones' },
    { key: 'politica_privacidad', label: 'Política de Privacidad', path: '/politica-privacidad' },
] as const;

type TabKey = typeof TABS[number]['key'];

interface ContentState {
    value: string;
    updatedAt: string | null;
    loading: boolean;
    saving: boolean;
    saved: boolean;
}

const defaultState = (): ContentState => ({
    value: '',
    updatedAt: null,
    loading: true,
    saving: false,
    saved: false,
});

export default function TerminosAdminPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('terminos_condiciones');
    const [preview, setPreview] = useState(false);
    const [contents, setContents] = useState<Record<TabKey, ContentState>>({
        terminos_condiciones: defaultState(),
        politica_privacidad: defaultState(),
    });

    useEffect(() => {
        TABS.forEach(({ key }) => {
            fetch(`/api/admin/terminos?key=${key}`)
                .then((r) => r.json())
                .then((data) => {
                    setContents((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], value: data.value ?? '', updatedAt: data.updatedAt ?? null, loading: false },
                    }));
                });
        });
    }, []);

    async function handleSave(key: TabKey) {
        setContents((prev) => ({ ...prev, [key]: { ...prev[key], saving: true, saved: false } }));
        const res = await fetch('/api/admin/terminos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: contents[key].value }),
        });
        if (res.ok) {
            const data = await res.json();
            setContents((prev) => ({
                ...prev,
                [key]: { ...prev[key], saving: false, saved: true, updatedAt: data.updatedAt },
            }));
            setTimeout(() => {
                setContents((prev) => ({ ...prev, [key]: { ...prev[key], saved: false } }));
            }, 3000);
        } else {
            setContents((prev) => ({ ...prev, [key]: { ...prev[key], saving: false } }));
        }
    }

    const current = contents[activeTab];
    const activeTabInfo = TABS.find((t) => t.key === activeTab)!;

    const formattedDate = current.updatedAt
        ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(current.updatedAt),
          )
        : null;

    return (
        <div className="min-h-screen bg-[#F0F2F5] p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <ScrollText size={20} className="text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Documentos Legales</h1>
                            {formattedDate && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Última actualización: {formattedDate}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPreview((v) => !v)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                            {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                            {preview ? 'Editar' : 'Vista previa'}
                        </button>
                        <button
                            onClick={() => handleSave(activeTab)}
                            disabled={current.saving || current.loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {current.saved ? (
                                <>
                                    <CheckCircle size={16} />
                                    Guardado
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    {current.saving ? 'Guardando...' : 'Guardar'}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setPreview(false); }}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-amber-500 text-white'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Editor / Preview */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            {preview ? (
                                <>Vista previa de{' '}
                                    <a href={activeTabInfo.path} target="_blank" className="font-mono text-gray-700 hover:underline">
                                        {activeTabInfo.path}
                                    </a>
                                </>
                            ) : (
                                <>Escribe en <strong>Markdown</strong>. Se renderizará automáticamente en{' '}
                                    <a href={activeTabInfo.path} target="_blank" className="font-mono text-gray-700 hover:underline">
                                        {activeTabInfo.path}
                                    </a>
                                </>
                            )}
                        </p>
                        {!preview && (
                            <span className="text-xs text-gray-400">
                                ## Título · **negrita** · *cursiva* · - lista
                            </span>
                        )}
                    </div>

                    {current.loading ? (
                        <div className="h-[600px] flex items-center justify-center text-gray-400 text-sm">
                            Cargando...
                        </div>
                    ) : preview ? (
                        <div className="h-[600px] overflow-y-auto p-6">
                            {current.value.trim() ? (
                                <MarkdownRenderer content={current.value} />
                            ) : (
                                <p className="text-gray-400 italic text-sm">Sin contenido para previsualizar.</p>
                            )}
                        </div>
                    ) : (
                        <textarea
                            key={activeTab}
                            value={current.value}
                            onChange={(e) =>
                                setContents((prev) => ({
                                    ...prev,
                                    [activeTab]: { ...prev[activeTab], value: e.target.value },
                                }))
                            }
                            className="w-full h-[600px] p-4 text-sm font-mono text-gray-800 resize-none outline-none"
                            placeholder={`# ${activeTabInfo.label}\n\n## 1. Primera sección\n\nEscribe aquí el contenido en Markdown...`}
                            spellCheck={false}
                        />
                    )}
                </div>

                <p className="text-xs text-gray-400 text-center">
                    Los cambios se aplican inmediatamente al guardar.
                </p>
            </div>
        </div>
    );
}
