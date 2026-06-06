'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import {
    FiX, FiSearch, FiCalendar, FiDollarSign, FiList,
    FiArrowLeft, FiBarChart2, FiUser, FiMapPin, FiPhone,
    FiMail, FiClock, FiCheckCircle, FiChevronRight,
    FiAlertTriangle, FiHash, FiTruck, FiInfo, FiFileText,
} from 'react-icons/fi';
import { getStateBg } from '@/lib/state-transitions';
import { getDatos } from '@/types/reserva-datos';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { DateInput } from '@/components/ui';
import { useAliado } from '@/lib/hooks/useAliado';
import Link from 'next/link';

/* ─────────────────────────────── Types ─────────────────────────────── */

interface Reserva {
    id: string;
    codigo: string;
    createdAt: string;
    fecha: string;
    hora: string;
    nombreCliente: string;
    emailCliente: string;
    whatsappCliente: string;
    estado: string;
    precioBase: number;
    precioAdicionales: number;
    recargoNocturno: number;
    tarifaMunicipio: number;
    descuentoAliado: number;
    precioTotal: number;
    comisionAliado: number;
    comisionBold?: number;
    numeroPasajeros: number;
    municipio: string;
    otroMunicipio?: string;
    notas?: string;
    idioma?: string;
    metodoPago?: string;
    origen?: string;
    datos?: Record<string, any>;
    servicio: { nombre: string | { es?: string; en?: string } };
    vehiculo?: { nombre: string };
    conductor?: { nombre: string };
    asistentes?: { nombre: string; tipoDocumento: string; numeroDocumento: string; email?: string; telefono?: string }[];
    adicionalesSeleccionados?: {
        id: string;
        cantidad: number;
        precioUnitario: number;
        precioTotal: number;
        adicional: { nombre: string };
    }[];
}

/* ─────────────────────────── Helpers ───────────────────────────────── */

const ESTADO_LABELS: Record<string, string> = {
    PENDING_PAYMENT: 'Pendiente de Pago',
    CONFIRMED_UNASSIGNED: 'Confirmada · Sin Asignar',
    CONFIRMED_ASSIGNED: 'Confirmada · Asignada',
    IN_PROGRESS: 'En Curso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    PAYMENT_FAILED: 'Pago Fallido',
};

const DYNAMIC_LABELS: Record<string, string> = {
    vueltabote: 'Vuelta en Bote',
    bote1a6: 'Vuelta en Bote (1-6 pers.)',
    guiacertificado: 'Guía Certificado',
    guiaingles: 'Guía en Inglés',
    guiaespanol: 'Guía en Español',
    almuerzoscarta: 'Almuerzos a la Carta',
    cantidadalmuerzos: 'Cantidad Almuerzos',
    cantidadmotos: 'Cantidad Motos',
    cantidadparticipantes: 'Participantes',
    cantidadhoras: 'Duración (h)',
    numerovuelo: 'N° de Vuelo',
    aeropuertotipo: 'Tipo Aeropuerto',
    aeropuertonombre: 'Aeropuerto',
    trasladotipo: 'Tipo Traslado',
    trasladodestino: 'Destino Traslado',
};

function dynLabel(key: string): string {
    const norm = key.toLowerCase().replace(/[_\s]/g, '');
    if (DYNAMIC_LABELS[norm]) return DYNAMIC_LABELS[norm];
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

function getServiceName(s: Reserva['servicio']): string {
    if (typeof s.nombre === 'string') return s.nombre;
    return s.nombre?.es || s.nombre?.en || 'Servicio';
}

function formatCOP(n: number): string {
    return '$' + Number(n).toLocaleString('es-CO');
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    }) + ' ' + new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function monthKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function isCompleted(r: Reserva) {
    return r.estado === 'COMPLETED' || r.estado === 'COMPLETADA';
}

function isCancelled(r: Reserva) {
    return r.estado === 'CANCELLED' || r.estado === 'CANCELADA';
}

/* ═══════════════════════════════════════════════════════════════════════
   Detail slide-over
══════════════════════════════════════════════════════════════════════ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border-t border-gray-100 pt-5 mt-5 first:border-0 first:pt-0 first:mt-0">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-[#D6A75D]">{icon}</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );
}

function BoolBadge({ value, label }: { value: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium ${value ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
            {value ? <FiCheckCircle size={13} /> : <FiX size={13} />}
            {label}
        </div>
    );
}

function ReservaSlideOver({
    reserva,
    onClose,
    onCancelRequest,
}: {
    reserva: Reserva;
    onClose: () => void;
    onCancelRequest: () => void;
}) {
    const d = getDatos(reserva.datos);

    const aeropuertoLabel = d.aeropuertoTipo === 'HACIA'
        ? 'Llegada → Aeropuerto a Hotel'
        : d.aeropuertoTipo === 'DESDE'
            ? 'Salida → Hotel a Aeropuerto'
            : d.aeropuertoTipo;

    // Dynamic data entries with value != null/false/0/""
    const dynEntries = reserva.datos
        ? Object.entries(reserva.datos).filter(([, v]) => v !== null && v !== undefined && v !== '')
        : [];

    const boolDyn = dynEntries.filter(([, v]) => typeof v === 'boolean');
    const nonBoolDyn = dynEntries.filter(([, v]) => typeof v !== 'boolean');

    const canCancel = !isCancelled(reserva) && !isCompleted(reserva);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[680px] flex flex-col bg-white shadow-2xl">

                {/* ── Header ── */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <span className="font-mono text-xl font-bold text-[#D6A75D] tracking-wider">
                                {reserva.codigo}
                            </span>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStateBg(reserva.estado)}`}>
                                {ESTADO_LABELS[reserva.estado] || reserva.estado}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500">
                            {getServiceName(reserva.servicio)}
                            <span className="mx-1.5 text-gray-300">·</span>
                            Creada {formatDateTime(reserva.createdAt)}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700">
                        <FiX size={20} />
                    </button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-0">

                    {/* Servicio */}
                    <Section title="Servicio" icon={<FiTruck size={15} />}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <Field label="Servicio" value={getServiceName(reserva.servicio)} />
                            <Field label="Fecha y Hora" value={`${formatDate(reserva.fecha)} · ${reserva.hora}`} />
                            <Field label="Pasajeros" value={reserva.numeroPasajeros} />
                            <Field label="Municipio" value={
                                reserva.municipio === 'OTRO' && reserva.otroMunicipio
                                    ? reserva.otroMunicipio
                                    : reserva.municipio
                            } />
                            {d.lugarRecogida && (
                                <div className="col-span-2">
                                    <Field label="Lugar de Recogida" value={d.lugarRecogida as string} />
                                </div>
                            )}
                            <Field label="Idioma" value={reserva.idioma} />
                            <Field label="Método de Pago" value={reserva.metodoPago} />
                            <Field label="Origen" value={reserva.origen} />
                            {d.cantidadHoras ? <Field label="Duración" value={`${d.cantidadHoras} h`} /> : null}
                            {reserva.vehiculo && <Field label="Vehículo" value={reserva.vehiculo.nombre} />}
                            {reserva.conductor && <Field label="Conductor" value={reserva.conductor.nombre} />}
                        </div>
                    </Section>

                    {/* Información de vuelo */}
                    {(d.aeropuertoTipo || d.numeroVuelo || d.aeropuertoNombre) && (
                        <Section title="Vuelo / Aeropuerto" icon={<FiMapPin size={15} />}>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <Field label="Tipo de Traslado" value={aeropuertoLabel} />
                                <Field label="Aeropuerto" value={d.aeropuertoNombre as string} />
                                <Field label="N° de Vuelo" value={d.numeroVuelo as string} mono />
                            </div>
                        </Section>
                    )}

                    {/* Traslado */}
                    {(d.trasladoTipo || d.trasladoDestino) && (
                        <Section title="Traslado" icon={<FiMapPin size={15} />}>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <Field label="Tipo" value={d.trasladoTipo as string} />
                                <Field label="Destino" value={d.trasladoDestino as string} />
                            </div>
                        </Section>
                    )}

                    {/* Extras booleanos del modelo principal */}
                    {(d.guiaCertificado || d.vueltaBote ||
                        ((d.cantidadAlmuerzos as number) > 0) ||
                        ((d.cantidadMotos as number) > 0) ||
                        ((d.cantidadParticipantes as number) > 0) ||
                        boolDyn.length > 0) && (
                            <Section title="Extras y Opciones" icon={<FiCheckCircle size={15} />}>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {d.guiaCertificado !== undefined && (
                                        <BoolBadge value={!!d.guiaCertificado} label="Guía Certificado" />
                                    )}
                                    {d.vueltaBote !== undefined && (
                                        <BoolBadge value={!!d.vueltaBote} label="Vuelta en Bote" />
                                    )}
                                    {boolDyn.map(([k, v]) => (
                                        <BoolBadge key={k} value={!!v} label={dynLabel(k)} />
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                                    {((d.cantidadAlmuerzos as number) ?? 0) > 0 && (
                                        <Field label="Almuerzos" value={d.cantidadAlmuerzos} />
                                    )}
                                    {((d.cantidadMotos as number) ?? 0) > 0 && (
                                        <Field label="Motos" value={d.cantidadMotos} />
                                    )}
                                    {((d.cantidadParticipantes as number) ?? 0) > 0 && (
                                        <Field label="Participantes" value={d.cantidadParticipantes} />
                                    )}
                                    {nonBoolDyn.map(([k, v]) => (
                                        <Field key={k} label={dynLabel(k)} value={String(v)} />
                                    ))}
                                </div>
                            </Section>
                        )}

                    {/* Cliente */}
                    <Section title="Cliente" icon={<FiUser size={15} />}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <Field label="Nombre" value={reserva.nombreCliente} />
                            <Field label="WhatsApp" value={reserva.whatsappCliente} />
                            <div className="col-span-2">
                                <Field label="Email" value={reserva.emailCliente} />
                            </div>
                        </div>
                    </Section>

                    {/* Asistentes */}
                    {reserva.asistentes && reserva.asistentes.length > 0 && (
                        <Section title={`Pasajeros / Asistentes (${reserva.asistentes.length})`} icon={<FiUser size={15} />}>
                            <div className="space-y-2">
                                {reserva.asistentes.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-7 h-7 rounded-full bg-[#D6A75D]/20 text-[#D6A75D] font-bold text-xs flex items-center justify-center">
                                                {i + 1}
                                            </span>
                                            <span className="font-medium text-sm text-gray-900">{a.nombre}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {a.tipoDocumento}: {a.numeroDocumento}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Adicionales */}
                    {reserva.adicionalesSeleccionados && reserva.adicionalesSeleccionados.length > 0 && (
                        <Section title="Adicionales" icon={<FiList size={15} />}>
                            <div className="space-y-1.5">
                                {reserva.adicionalesSeleccionados.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">
                                            {a.adicional.nombre}
                                            {a.cantidad > 1 && <span className="text-gray-400 ml-1.5">×{a.cantidad}</span>}
                                        </span>
                                        <span className="font-medium text-gray-900">{formatCOP(a.precioTotal)}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Precios */}
                    <Section title="Desglose de Precios" icon={<FiDollarSign size={15} />}>
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Precio Base</span>
                                <span className="font-medium">{formatCOP(reserva.precioBase)}</span>
                            </div>
                            {Number(reserva.precioAdicionales) > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Adicionales</span>
                                    <span className="font-medium">+{formatCOP(reserva.precioAdicionales)}</span>
                                </div>
                            )}
                            {Number(reserva.recargoNocturno) > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Recargo Nocturno</span>
                                    <span className="font-medium">+{formatCOP(reserva.recargoNocturno)}</span>
                                </div>
                            )}
                            {Number(reserva.tarifaMunicipio) > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Tarifa Municipio</span>
                                    <span className="font-medium">+{formatCOP(reserva.tarifaMunicipio)}</span>
                                </div>
                            )}
                            {Number(reserva.descuentoAliado) > 0 && (
                                <div className="flex justify-between text-orange-600">
                                    <span>Descuento Aliado</span>
                                    <span className="font-medium">-{formatCOP(reserva.descuentoAliado)}</span>
                                </div>
                            )}
                            {Number(reserva.comisionBold) > 0 && (
                                <div className="flex justify-between text-gray-400">
                                    <span>Comisión pasarela (6%)</span>
                                    <span>+{formatCOP(reserva.comisionBold ?? 0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                <span className="font-semibold text-gray-900">Total Reserva</span>
                                <span className="font-bold text-base text-gray-900">{formatCOP(reserva.precioTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-green-50 rounded-lg px-3 py-2.5 mt-2">
                                <span className="font-semibold text-green-700">Tu Comisión</span>
                                <span className="font-bold text-lg text-green-700">{formatCOP(reserva.comisionAliado)}</span>
                            </div>
                        </div>
                    </Section>

                    {/* Notas */}
                    {reserva.notas && (
                        <Section title="Notas del Cliente" icon={<FiFileText size={15} />}>
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
                                {reserva.notas}
                            </div>
                        </Section>
                    )}

                </div>

                {/* ── Footer actions ── */}
                <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-2">
                    {canCancel && (
                        <button
                            onClick={onCancelRequest}
                            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
                        >
                            Cancelar Reserva
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════════
   Stats Tab
══════════════════════════════════════════════════════════════════════ */

function StatRow({ label, value, sub, valueClass }: { label: string; value: React.ReactNode; sub?: string; valueClass?: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
            <div>
                <span className="text-sm text-gray-600">{label}</span>
                {sub && <span className="text-xs text-gray-400 ml-2">{sub}</span>}
            </div>
            <span className={`text-sm font-semibold tabular-nums ${valueClass ?? 'text-gray-900'}`}>{value}</span>
        </div>
    );
}

function StatsTab({ reservas }: { reservas: Reserva[] }) {
    const availableMonths = useMemo(() => {
        const set = new Set<string>();
        reservas.forEach(r => set.add(monthKey(r.createdAt)));
        return Array.from(set).sort().reverse();
    }, [reservas]);

    const currentMonthKey = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState<string>(
        availableMonths.includes(currentMonthKey) ? currentMonthKey : (availableMonths[0] ?? currentMonthKey)
    );

    const monthlyReservas = useMemo(
        () => reservas.filter(r => monthKey(r.createdAt) === selectedMonth),
        [reservas, selectedMonth]
    );

    // All-time stats
    const totalComision = reservas.reduce((s, r) => s + Number(r.comisionAliado || 0), 0);
    const totalIngresos = reservas.reduce((s, r) => s + Number(r.precioTotal || 0), 0);
    const totalCompletadas = reservas.filter(isCompleted).length;
    const totalCanceladas = reservas.filter(isCancelled).length;

    // Monthly stats
    const mTotal = monthlyReservas.length;
    const mCompletadas = monthlyReservas.filter(isCompleted).length;
    const mCanceladas = monthlyReservas.filter(isCancelled).length;
    const mPendientes = monthlyReservas.filter(r => !isCompleted(r) && !isCancelled(r)).length;
    const mComision = monthlyReservas.reduce((s, r) => s + Number(r.comisionAliado || 0), 0);
    const mIngresos = monthlyReservas.reduce((s, r) => s + Number(r.precioTotal || 0), 0);

    // Per-service breakdown for selected month
    const byService = useMemo(() => {
        const map: Record<string, { count: number; comision: number; ingresos: number; completadas: number; canceladas: number }> = {};
        monthlyReservas.forEach(r => {
            const name = getServiceName(r.servicio);
            if (!map[name]) map[name] = { count: 0, comision: 0, ingresos: 0, completadas: 0, canceladas: 0 };
            map[name].count++;
            map[name].comision += Number(r.comisionAliado || 0);
            map[name].ingresos += Number(r.precioTotal || 0);
            if (isCompleted(r)) map[name].completadas++;
            if (isCancelled(r)) map[name].canceladas++;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [monthlyReservas]);

    const pct = (a: number, b: number) => b > 0 ? `${Math.round((a / b) * 100)}%` : '—';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column: month selector + monthly stats */}
            <div className="lg:col-span-2 space-y-5">

                {/* Month selector */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">Período</label>
                    <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded bg-white text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#D6A75D]"
                    >
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{monthLabel(m)}</option>
                        ))}
                    </select>
                    <span className="text-xs text-gray-400">Afecta todas las métricas del mes</span>
                </div>

                {/* Monthly metrics table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            Métricas — {monthLabel(selectedMonth)}
                        </span>
                    </div>
                    <div className="px-4 py-1">
                        <StatRow label="Total reservas" value={mTotal} />
                        <StatRow label="Completadas" value={mCompletadas} sub={pct(mCompletadas, mTotal)} />
                        <StatRow label="Canceladas" value={mCanceladas} sub={pct(mCanceladas, mTotal)} />
                        <StatRow label="En curso / pendientes" value={mPendientes} />
                        <StatRow label="Comisión generada" value={formatCOP(mComision)} valueClass="font-bold" />
                        <StatRow label="Ingresos totales del mes" value={formatCOP(mIngresos)} />
                    </div>
                </div>

                {/* Per-service breakdown */}
                {byService.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                Desglose por Servicio — {monthLabel(selectedMonth)}
                            </span>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Servicio</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Reservas</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Completas</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Cancel.</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Ingresos</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Comisión</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {byService.map(([name, s]) => (
                                    <tr key={name} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5 text-gray-800 font-medium">{name}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{s.count}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            <span className="text-gray-900">{s.completadas}</span>
                                            <span className="text-gray-400 text-xs ml-1">{pct(s.completadas, s.count)}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{s.canceladas || '—'}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatCOP(s.ingresos)}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{formatCOP(s.comision)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Right column: all-time totals */}
            <div className="space-y-5">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Totales Históricos</span>
                    </div>
                    <div className="px-4 py-1">
                        <StatRow label="Total reservas" value={reservas.length} />
                        <StatRow label="Completadas" value={totalCompletadas} sub={pct(totalCompletadas, reservas.length)} />
                        <StatRow label="Canceladas" value={totalCanceladas} sub={pct(totalCanceladas, reservas.length)} />
                        <StatRow label="Ingresos totales" value={formatCOP(totalIngresos)} />
                        <div className="py-3 border-t border-gray-100 mt-1">
                            <p className="text-xs text-gray-400 mb-0.5">Comisión Total Acumulada</p>
                            <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCOP(totalComision)}</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main content
══════════════════════════════════════════════════════════════════════ */

function MisReservasContent() {
    const { aliado, ready } = useAliado();
    const aliadoId = aliado?.id ?? null;

    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'reservas' | 'estadisticas'>('reservas');

    // Filters
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [filterNombre, setFilterNombre] = useState('');
    const [filterServicio, setFilterServicio] = useState('');
    const [filterCodigo, setFilterCodigo] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const fetchReservas = useCallback(async () => {
        if (!aliadoId) return;
        try {
            const qs = aliado?.codigo ? `?codigo=${encodeURIComponent(aliado.codigo)}` : '';
            const res = await fetch(`/api/aliados/${aliadoId}/reservas${qs}`);
            const data = await res.json();
            setReservas(data.data || []);
        } catch (e) {
            console.error('Error loading reservations:', e);
        } finally {
            setLoading(false);
        }
    }, [aliadoId, aliado?.codigo]);

    useEffect(() => {
        if (ready && aliadoId) fetchReservas();
        else if (ready && !aliadoId) setLoading(false);
    }, [aliadoId, ready, fetchReservas]);

    const serviciosUnicos = useMemo(
        () => Array.from(new Set(reservas.map(r => getServiceName(r.servicio)))).filter(Boolean).sort(),
        [reservas]
    );

    const filteredReservas = useMemo(() => reservas.filter(r => {
        const created = new Date(r.createdAt);
        if (fechaDesde) { const d = new Date(fechaDesde); d.setHours(0, 0, 0, 0); if (created < d) return false; }
        if (fechaHasta) { const d = new Date(fechaHasta); d.setHours(23, 59, 59, 999); if (created > d) return false; }
        if (filterNombre && !r.nombreCliente.toLowerCase().includes(filterNombre.toLowerCase())) return false;
        if (filterServicio && getServiceName(r.servicio) !== filterServicio) return false;
        if (filterCodigo && !r.codigo.toLowerCase().includes(filterCodigo.toLowerCase())) return false;
        if (filterEstado && r.estado !== filterEstado) return false;
        return true;
    }), [reservas, fechaDesde, fechaHasta, filterNombre, filterServicio, filterCodigo, filterEstado]);

    useEffect(() => { setCurrentPage(1); }, [fechaDesde, fechaHasta, filterNombre, filterServicio, filterCodigo, filterEstado]);

    const totalPages = Math.ceil(filteredReservas.length / ITEMS_PER_PAGE);
    const paginatedReservas = filteredReservas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const hasActiveFilters = !!(fechaDesde || fechaHasta || filterNombre || filterServicio || filterCodigo || filterEstado);

    const clearFilters = () => {
        setFechaDesde(''); setFechaHasta('');
        setFilterNombre(''); setFilterServicio('');
        setFilterCodigo(''); setFilterEstado('');
    };

    const handleCancelConfirm = async () => {
        if (!selectedReserva || !aliadoId) return;
        setCanceling(true);
        setCancelError(null);
        try {
            const res = await fetch(`/api/reservas/by-id/${selectedReserva.id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aliadoId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al cancelar');
            setReservas(prev => prev.map(r => r.id === selectedReserva.id ? { ...r, estado: 'CANCELLED' } : r));
            setSelectedReserva(prev => prev ? { ...prev, estado: 'CANCELLED' } : null);
            setShowCancelModal(false);
        } catch (e) {
            setCancelError(e instanceof Error ? e.message : 'Error al cancelar la reserva');
            setShowCancelModal(false);
        } finally {
            setCanceling(false);
        }
    };

    // Page numbers
    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 4) {
            for (let i = 1; i <= 5; i++) pages.push(i);
            pages.push('...');
            pages.push(totalPages);
        } else if (currentPage >= totalPages - 3) {
            pages.push(1); pages.push('...');
            for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1); pages.push('...');
            pages.push(currentPage - 1, currentPage, currentPage + 1);
            pages.push('...'); pages.push(totalPages);
        }
        return pages;
    };

    /* ── Loading / no aliado ── */

    if (!ready) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D6A75D]" />
            </div>
        );
    }

    if (!aliadoId || !aliado) {
        return (
            <>
                <Header />
                <main className="min-h-screen pt-28 pb-16 bg-gray-50 flex items-center justify-center">
                    <div className="text-center max-w-md mx-auto px-4">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <FiCalendar size={28} className="text-gray-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Requerido</h2>
                        <p className="text-gray-500 mb-6">Ingresa con tu perfil de aliado para ver tus reservas.</p>
                        <Link href="/reservas" className="inline-flex items-center gap-2 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-lg transition-colors">
                            <FiArrowLeft size={16} /> Ir a Reservas
                        </Link>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    /* ── Main render ── */

    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-16 bg-gray-50">

                {/* ── Profile strip ── */}
                <div className="bg-white border-b border-gray-100 shadow-sm">
                    <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-[#D6A75D] flex items-center justify-center text-black font-bold text-lg shrink-0">
                                {aliado.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none mb-0.5">Perfil Aliado</p>
                                <p className="font-bold text-gray-900 leading-none">{aliado.nombre}</p>
                                <p className="text-xs font-mono text-gray-400 mt-0.5">{aliado.codigo}</p>
                            </div>
                        </div>
                        <Link href="/reservas" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                            <FiArrowLeft size={14} /> Volver a Reservas
                        </Link>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="bg-white border-b border-gray-100">
                    <div className="max-w-[1400px] mx-auto px-6">
                        <div className="flex gap-0">
                            {(['reservas', 'estadisticas'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab
                                        ? 'border-[#D6A75D] text-gray-900'
                                        : 'border-transparent text-gray-400 hover:text-gray-700'
                                        }`}
                                >
                                    {tab === 'reservas' ? <><FiList size={15} /> Mis Reservas</> : <><FiBarChart2 size={15} /> Estadísticas</>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Tab content ── */}
                <div className="max-w-[1400px] mx-auto px-6 py-8">

                    {activeTab === 'estadisticas' ? (
                        <StatsTab reservas={reservas} />
                    ) : (
                        <>
                            {/* Filters */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                                    {/* Nombre */}
                                    <div className="lg:col-span-1">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Buscar por Nombre</label>
                                        <div className="relative">
                                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="text" value={filterNombre}
                                                onChange={e => setFilterNombre(e.target.value)}
                                                placeholder="Nombre del cliente..."
                                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                                            />
                                        </div>
                                    </div>
                                    {/* Código */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Código</label>
                                        <div className="relative">
                                            <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="text" value={filterCodigo}
                                                onChange={e => setFilterCodigo(e.target.value)}
                                                placeholder="Código..."
                                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                                            />
                                        </div>
                                    </div>
                                    {/* Servicio */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Servicio</label>
                                        <select value={filterServicio} onChange={e => setFilterServicio(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none">
                                            <option value="">Todos</option>
                                            {serviciosUnicos.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    {/* Estado */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado</label>
                                        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none">
                                            <option value="">Todos</option>
                                            {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </div>
                                    {/* Fecha desde */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fecha Inicio</label>
                                        <DateInput value={fechaDesde} onChange={setFechaDesde}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none" />
                                    </div>
                                    {/* Fecha hasta */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fecha Fin</label>
                                        <DateInput value={fechaHasta} onChange={setFechaHasta}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400">
                                        {hasActiveFilters
                                            ? `${filteredReservas.length} de ${reservas.length} reservas`
                                            : `${reservas.length} reservas en total`}
                                    </p>
                                    {hasActiveFilters && (
                                        <button onClick={clearFilters}
                                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200">
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                {loading ? (
                                    <div className="text-center py-16">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D6A75D] mx-auto" />
                                    </div>
                                ) : filteredReservas.length === 0 ? (
                                    <div className="text-center py-16 text-gray-400">
                                        <FiList size={32} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">No hay reservas</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Creada</th>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha Servicio</th>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Servicio</th>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comisión</th>
                                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                                        <th className="px-5 py-3" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {paginatedReservas.map(r => (
                                                        <tr
                                                            key={r.id}
                                                            onClick={() => { setSelectedReserva(r); setCancelError(null); }}
                                                            className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                                        >
                                                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                                                                {new Date(r.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                <br />
                                                                <span className="text-xs text-gray-400">
                                                                    {new Date(r.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 whitespace-nowrap">
                                                                <span className="font-mono font-semibold text-[#D6A75D] tracking-wide">{r.codigo}</span>
                                                            </td>
                                                            <td className="px-5 py-4 whitespace-nowrap text-gray-900">
                                                                {new Date(r.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                                <br />
                                                                <span className="text-xs text-gray-400">{r.hora}</span>
                                                            </td>
                                                            <td className="px-5 py-4 text-gray-800 max-w-[200px] truncate">{getServiceName(r.servicio)}</td>
                                                            <td className="px-5 py-4 text-gray-800">{r.nombreCliente}</td>
                                                            <td className="px-5 py-4 whitespace-nowrap">
                                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStateBg(r.estado)}`}>
                                                                    {ESTADO_LABELS[r.estado] || r.estado}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                                                                {formatCOP(r.comisionAliado)}
                                                            </td>
                                                            <td className="px-5 py-4 text-right font-bold text-gray-900 whitespace-nowrap">
                                                                {formatCOP(r.precioTotal)}
                                                            </td>
                                                            <td className="px-5 py-4 text-right">
                                                                <FiChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors ml-auto" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        {filteredReservas.length > ITEMS_PER_PAGE && (
                                            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                                                <p className="text-xs text-gray-400">
                                                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredReservas.length)} de {filteredReservas.length}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                                        Anterior
                                                    </button>
                                                    {getPageNumbers().map((p, i) => (
                                                        p === '...' ? (
                                                            <span key={`e${i}`} className="px-2 text-gray-400 text-xs">…</span>
                                                        ) : (
                                                            <button key={p} onClick={() => setCurrentPage(p as number)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentPage === p ? 'bg-[#D6A75D] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                                                {p}
                                                            </button>
                                                        )
                                                    ))}
                                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                                        Siguiente
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
            <Footer />

            {/* ── Detail slide-over ── */}
            {selectedReserva && (
                <ReservaSlideOver
                    reserva={selectedReserva}
                    onClose={() => setSelectedReserva(null)}
                    onCancelRequest={() => setShowCancelModal(true)}
                />
            )}

            {/* ── Cancel confirmation modal ── */}
            {showCancelModal && selectedReserva && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <FiAlertTriangle size={22} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">¿Cancelar reserva?</h3>
                            <p className="text-sm text-gray-500 mb-2">
                                Estás a punto de cancelar
                            </p>
                            <p className="text-lg font-mono font-bold text-[#D6A75D] mb-4">{selectedReserva.codigo}</p>
                            <p className="text-xs text-gray-400 mb-6">Esta acción no se puede deshacer. El cliente recibirá un correo de notificación.</p>
                            {cancelError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
                                    {cancelError}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCancelModal(false)} disabled={canceling}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 text-sm">
                                No, volver
                            </button>
                            <button onClick={handleCancelConfirm} disabled={canceling}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm">
                                {canceling ? 'Cancelando…' : 'Sí, cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function MisReservasPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]" />
            </div>
        }>
            <MisReservasContent />
        </Suspense>
    );
}
