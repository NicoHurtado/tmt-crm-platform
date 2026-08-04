'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiLink, FiRefreshCw } from 'react-icons/fi';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

/**
 * Estadísticas de las reservas que entran por la API de socios.
 *
 * Va en su propio componente y con su propio endpoint (`/api/admin/estadisticas/socios`)
 * porque la pregunta es distinta a la del resto de la página: allá se mira el mes
 * calendario, aquí interesa "cómo va la alianza en las últimas N semanas".
 */

const VENTANAS = [
    { dias: 7, label: '7 días' },
    { dias: 14, label: '14 días' },
    { dias: 21, label: '21 días' },
    { dias: 30, label: '30 días' },
    { dias: 90, label: '90 días' },
    { dias: 0, label: 'Todo' },
] as const;

const COLORES = ['#D6A75D', '#64748B', '#10B981', '#6366F1', '#EF4444', '#8B5CF6'];

interface Desglose {
    nombre: string;
    cantidad: number;
}

interface UltimaReserva {
    codigo: string;
    creada: string;
    fecha: string;
    hora: string;
    estado: string;
    pasajeros: number;
    vehiculo: string | null;
    total: number;
}

interface SocioStat {
    id: string;
    codigo: string;
    nombre: string;
    activo: boolean;
    reservas: number;
    vigentes: number;
    canceladas: number;
    facturado: number;
    pasajeros: number;
    ticketPromedio: number;
    nocturnas: number;
    porDia: Array<{ dia: string; cantidad: number }>;
    porVehiculo: Desglose[];
    porAeropuerto: Desglose[];
    porSentido: Desglose[];
    ultimas: UltimaReserva[];
}

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const ESTADO_COLOR: Record<string, string> = {
    CONFIRMED_UNASSIGNED: 'bg-sky-50 text-sky-700',
    CONFIRMED_ASSIGNED: 'bg-indigo-50 text-indigo-700',
    IN_PROGRESS: 'bg-amber-50 text-amber-700',
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    CANCELLED: 'bg-red-50 text-red-600',
};

function Kpi({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] font-medium text-gray-400 leading-none">{label}</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight mt-2 leading-none">{valor}</p>
            {nota && <p className="text-[11px] text-gray-400 mt-1.5">{nota}</p>}
        </div>
    );
}

/** Barras horizontales para los desgloses — más legible que un pie con 7 categorías. */
function Desgloses({ titulo, datos }: { titulo: string; datos: Desglose[] }) {
    if (datos.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{titulo}</h4>
                <p className="text-xs text-gray-400 py-6 text-center">Sin datos</p>
            </div>
        );
    }
    const alto = Math.max(140, datos.length * 38);
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{titulo}</h4>
            <ResponsiveContainer width="100%" height={alto}>
                <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis
                        type="category"
                        dataKey="nombre"
                        width={135}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                    />
                    <Tooltip
                        formatter={(v: number) => [`${v} reserva${v === 1 ? '' : 's'}`, '']}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="cantidad" radius={[0, 5, 5, 0]} isAnimationActive={false}>
                        {datos.map((_, i) => (
                            <Cell key={i} fill={COLORES[i % COLORES.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function SociosStatsPanel() {
    const [dias, setDias] = useState<number>(30);
    const [socios, setSocios] = useState<SocioStat[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = async (d: number) => {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/estadisticas/socios?dias=${d}`);
            if (!res.ok) throw new Error('No se pudieron cargar las estadísticas');
            const json = await res.json();
            setSocios(json.socios ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargar(dias);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dias]);

    return (
        <div className="space-y-5">
            {/* Selector de ventana */}
            <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-3 flex-wrap">
                <FiLink className="text-[#D6A75D]" size={16} />
                <div className="mr-auto">
                    <h3 className="text-sm font-semibold text-gray-700 leading-tight">
                        Reservas que entran por la API de socios
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        Apps externas que venden nuestro transporte. No son aliados: no llevan comisión.
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                    {VENTANAS.map((v) => (
                        <button
                            key={v.dias}
                            type="button"
                            onClick={() => setDias(v.dias)}
                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                dias === v.dias
                                    ? 'bg-white text-[#D6A75D] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => cargar(dias)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-[#D6A75D] hover:border-[#D6A75D] transition-colors"
                    title="Actualizar"
                >
                    <FiRefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
            )}

            {cargando && !socios && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-sm text-gray-400">
                    Cargando…
                </div>
            )}

            {socios?.length === 0 && !cargando && (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <p className="text-sm text-gray-500 font-medium">No hay socios de API registrados</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                        Se crean con <code className="bg-gray-100 px-1.5 py-0.5 rounded">prisma/seed-socios.ts</code>
                    </p>
                </div>
            )}

            {socios?.map((s) => (
                <div key={s.id} className="space-y-4">
                    {/* Cabecera del socio */}
                    <div className="flex items-center gap-3 pt-2">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {s.codigo}
                        </span>
                        <h3 className="text-base font-bold text-gray-800">{s.nombre}</h3>
                        {!s.activo && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                desactivado
                            </span>
                        )}
                        <Link
                            href="/admin/dashboard/reservas"
                            className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-[#D6A75D] hover:text-[#D6A75D] font-medium transition-colors"
                        >
                            Ver sus reservas →
                        </Link>
                    </div>

                    {s.reservas === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
                            Sin reservas en este período
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <Kpi label="Reservas" valor={String(s.reservas)} nota={`${s.vigentes} vigentes`} />
                                <Kpi label="Facturado a TMT" valor={cop(s.facturado)} nota="solo vigentes" />
                                <Kpi label="Pasajeros" valor={String(s.pasajeros)} />
                                <Kpi label="Ticket promedio" valor={cop(s.ticketPromedio)} />
                                <Kpi
                                    label="Nocturnas"
                                    valor={String(s.nocturnas)}
                                    nota={s.vigentes > 0 ? `${Math.round((s.nocturnas / s.vigentes) * 100)}% del total` : undefined}
                                />
                                <Kpi
                                    label="Canceladas"
                                    valor={String(s.canceladas)}
                                    nota={s.reservas > 0 ? `${Math.round((s.canceladas / s.reservas) * 100)}% del total` : undefined}
                                />
                            </div>

                            {/* Tendencia */}
                            <div className="bg-white rounded-xl border border-gray-100 p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                    Reservas recibidas por día
                                </h4>
                                <ResponsiveContainer width="100%" height={180}>
                                    <AreaChart data={s.porDia} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={`g-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#D6A75D" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#D6A75D" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="dia"
                                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                                            tickFormatter={(d: string) => d.slice(5)}
                                        />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                            formatter={(v: number) => [`${v} reserva${v === 1 ? '' : 's'}`, '']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cantidad"
                                            stroke="#D6A75D"
                                            strokeWidth={2}
                                            fill={`url(#g-${s.id})`}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Desgloses */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <Desgloses titulo="Por vehículo" datos={s.porVehiculo} />
                                <Desgloses titulo="Por aeropuerto" datos={s.porAeropuerto} />
                                <Desgloses titulo="Por sentido del traslado" datos={s.porSentido} />
                            </div>

                            {/* Últimas reservas */}
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-gray-100">
                                    <h4 className="text-sm font-semibold text-gray-700">Últimas reservas</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {['Código', 'Recibida', 'Servicio', 'Pax', 'Vehículo', 'Estado', 'Total'].map((h) => (
                                                    <th
                                                        key={h}
                                                        className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {s.ultimas.map((r) => (
                                                <tr key={r.codigo} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="px-5 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">
                                                        {r.codigo}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                                                        {new Date(r.creada).toLocaleDateString('es-CO', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                        })}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap text-xs">
                                                        {r.fecha} · {r.hora}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600">{r.pasajeros}</td>
                                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap text-xs">
                                                        {r.vehiculo ?? '—'}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span
                                                            className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                                                                ESTADO_COLOR[r.estado] ?? 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {r.estado.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                                        {cop(r.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
