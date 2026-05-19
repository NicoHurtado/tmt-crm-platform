'use client';

import { MapPin, Clock, Info } from 'lucide-react';
import { getSharedTourLogisticsDisplay } from '@/lib/info-tour-compartido';

export function SharedTourLogisticsCard({
    info,
    language,
}: {
    info: unknown;
    language: 'es' | 'en';
}) {
    const d = getSharedTourLogisticsDisplay(info, language);
    if (!d) return null;

    const rows: {
        value: string;
        label: string;
        icon: typeof MapPin;
        emphasize?: boolean;
    }[] = [];

    if (d.encuentro.trim()) {
        rows.push({
            value: d.encuentro,
            label: language === 'es' ? 'Encuentro' : 'Meeting point',
            icon: MapPin,
        });
    }
    if (d.salida.trim()) {
        rows.push({
            value: d.salida,
            label: language === 'es' ? 'Salida' : 'Departure',
            icon: Clock,
        });
    }
    if (d.nota.trim()) {
        rows.push({
            value: d.nota,
            label: language === 'es' ? 'Importante' : 'Important',
            icon: Info,
            emphasize: true,
        });
    }

    const showTitle = d.titulo.trim();
    if (!showTitle && rows.length === 0) return null;

    return (
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm ring-1 ring-black/[0.03]">
            {showTitle ? (
                <h3 className="text-[15px] font-semibold text-gray-900 tracking-tight border-b border-gray-100 pb-3">
                    {d.titulo}
                </h3>
            ) : null}
            {rows.length > 0 ? (
                <ul className={showTitle ? 'mt-4 space-y-4' : 'space-y-4'}>
                    {rows.map(({ value, label, icon: Icon, emphasize }, i) => (
                        <li
                            key={i}
                            className={
                                emphasize
                                    ? 'flex gap-3 rounded-xl bg-gray-50/90 px-3 py-2.5 border border-gray-100'
                                    : 'flex gap-3'
                            }
                        >
                            <span
                                className={
                                    emphasize
                                        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-gray-100 text-gray-500'
                                        : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D6A75D]/15 text-[#9a7135]'
                                }
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                    {label}
                                </p>
                                <p
                                    className={
                                        emphasize
                                            ? 'text-sm text-gray-600 leading-snug mt-0.5'
                                            : 'text-sm text-gray-800 leading-snug mt-0.5'
                                    }
                                >
                                    {value}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
