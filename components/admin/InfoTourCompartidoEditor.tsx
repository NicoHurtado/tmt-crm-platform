'use client';

import type { InfoTourCompartidoShape } from '@/lib/info-tour-compartido';

interface Props {
    value: InfoTourCompartidoShape;
    onChange: (next: InfoTourCompartidoShape) => void;
}

const ROWS: {
    field: keyof InfoTourCompartidoShape;
    label: string;
    placeholderEs: string;
    placeholderEn: string;
    multiline?: boolean;
}[] = [
    {
        field: 'titulo',
        label: 'Título de la tarjeta',
        placeholderEs: 'ej. Logística del tour',
        placeholderEn: 'e.g. Tour logistics',
    },
    {
        field: 'encuentro',
        label: 'Punto de encuentro',
        placeholderEs: 'Dirección o referencia del lugar de encuentro',
        placeholderEn: 'Meeting point address or reference',
        multiline: true,
    },
    {
        field: 'salida',
        label: 'Hora de salida',
        placeholderEs: 'ej. 7:50 AM',
        placeholderEn: 'e.g. 7:50 AM',
    },
    {
        field: 'nota',
        label: 'Nota adicional',
        placeholderEs: 'ej. Sin recogida en hotel',
        placeholderEn: 'e.g. No hotel pickup',
        multiline: true,
    },
];

export function InfoTourCompartidoEditor({ value, onChange }: Props) {
    const patch = (field: keyof InfoTourCompartidoShape, lang: 'es' | 'en', text: string) => {
        onChange({
            ...value,
            [field]: { ...value[field], [lang]: text },
        });
    };

    return (
        <div className="space-y-5">
            <p className="text-xs text-gray-500">
                Al crear un tour compartido o si el servicio aún no tiene textos guardados, se cargan los valores que antes venían fijos en la web (los puedes editar). En la reserva solo se muestra la tarjeta si hay al menos un texto. Si un idioma está vacío, se usa el otro.
            </p>
            {ROWS.map(({ field, label, placeholderEs, placeholderEn, multiline }) => (
                <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Español</label>
                            {multiline ? (
                                <textarea
                                    value={value[field].es}
                                    onChange={(e) => patch(field, 'es', e.target.value)}
                                    rows={3}
                                    placeholder={placeholderEs}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] resize-none"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={value[field].es}
                                    onChange={(e) => patch(field, 'es', e.target.value)}
                                    placeholder={placeholderEs}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D]"
                                />
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">English</label>
                            {multiline ? (
                                <textarea
                                    value={value[field].en}
                                    onChange={(e) => patch(field, 'en', e.target.value)}
                                    rows={3}
                                    placeholder={placeholderEn}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] resize-none"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={value[field].en}
                                    onChange={(e) => patch(field, 'en', e.target.value)}
                                    placeholder={placeholderEn}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D]"
                                />
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
