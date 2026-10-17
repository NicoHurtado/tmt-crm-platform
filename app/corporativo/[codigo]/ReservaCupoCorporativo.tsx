'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { FiArrowRight, FiCheckCircle, FiClock, FiMapPin, FiUsers, FiLoader, FiCalendar } from 'react-icons/fi';
import {
    AEROPUERTOS,
    SENTIDOS,
    fechaReservable,
    hoyColombia,
    proximasFechas,
    type AeropuertoCorp,
    type ReglasDisponibilidad,
    type SentidoCorp,
} from '@/lib/corporativo-horarios';

interface HoraDisponible {
    horarioId: string;
    hora: string;
    capacidad: number;
    disponibles: number;
    yaPaso: boolean;
}

interface Props {
    codigo: string;
    activo: boolean;
    empresa: string;
    titulo: string;
    descripcion: string | null;
    origen: string;
    destino: string;
    aeropuertoNombre: AeropuertoCorp;
    aeropuertoTipo: SentidoCorp;
    reglas: ReglasDisponibilidad;
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaLarga = (f: string) =>
    mayus(new Date(`${f}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }));
const horaBonita = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return new Date(Date.UTC(2000, 0, 1, hh, mm)).toLocaleTimeString('es-CO', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true });
};

const EMPTY = { nombre: '', email: '', telefono: '', numeroVuelo: '' };

export default function ReservaCupoCorporativo(props: Props) {
    const [fecha, setFecha] = useState<string | null>(null);
    const [horas, setHoras] = useState<HoraDisponible[] | null>(null);
    const [cargandoHoras, setCargandoHoras] = useState(false);
    const [horarioId, setHorarioId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmado, setConfirmado] = useState<{ salida: string; nombre: string } | null>(null);
    const [hoy, setHoy] = useState('');

    useEffect(() => setHoy(hoyColombia()), []);
    const fechas = useMemo(() => (hoy ? proximasFechas(props.reglas, 14, hoy) : []), [hoy, props.reglas]);

    const cargarHoras = useCallback(
        async (f: string) => {
            setCargandoHoras(true);
            try {
                const res = await fetch(`/api/public/corporativo/${props.codigo}?fecha=${f}`, { cache: 'no-store' });
                const data = await res.json();
                setHoras(data.data?.horas ?? []);
            } catch {
                setHoras([]);
            } finally {
                setCargandoHoras(false);
            }
        },
        [props.codigo]
    );

    const elegirFecha = (f: string) => {
        if (!f) return;
        setFecha(f);
        setHorarioId(null);
        setError(null);
        if (!fechaReservable(f, props.reglas) || f < hoy) {
            setHoras([]);
            setError('Ese día no está disponible para reservar.');
            return;
        }
        cargarHoras(f);
    };

    const horaSel = horas?.find((h) => h.horarioId === horarioId) ?? null;

    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fecha || !horarioId) return setError('Escoge el día y la hora');
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/public/corporativo/${props.codigo}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, fecha, horarioId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No pudimos reservar tu cupo');
                cargarHoras(fecha);
                return;
            }
            setConfirmado({ salida: data.data.salida, nombre: form.nombre });
            setForm(EMPTY);
            setHorarioId(null);
            setFecha(null);
            setHoras(null);
        } catch {
            setError('Error de conexión, intenta de nuevo');
        } finally {
            setEnviando(false);
        }
    };

    const inputCls =
        'w-full rounded-lg bg-white/5 border border-white/15 px-3.5 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D6A75D] focus:ring-1 focus:ring-[#D6A75D] font-[family-name:var(--font-sans)]';
    const chip = (sel: boolean, off = false) =>
        [
            'rounded-xl border p-3 text-left transition-colors',
            sel ? 'border-[#D6A75D] bg-[#D6A75D]/15' : 'border-white/15 bg-white/[0.03] hover:border-white/40',
            off && 'opacity-40 cursor-not-allowed hover:border-white/15',
        ]
            .filter(Boolean)
            .join(' ');

    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
                <header className="flex items-center gap-3 mb-8">
                    <Image src="/logo.png" alt="Transportes Medellín Travel" width={44} height={44} className="h-11 w-11 object-contain" />
                    <div className="leading-tight">
                        <p className="text-sm text-[#D6A75D]">Transportes Medellín Travel</p>
                        <p className="text-xs text-white/50">Transporte corporativo · {props.empresa}</p>
                    </div>
                </header>

                <h1 className="text-3xl sm:text-4xl font-medium leading-tight">{props.titulo}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <FiMapPin className="text-[#D6A75D] shrink-0" />
                    <span>{props.origen}</span>
                    <FiArrowRight className="text-white/40" />
                    <span>{props.destino}</span>
                </div>
                {props.descripcion && (
                    <p className="mt-4 text-[15px] text-white/70 whitespace-pre-line font-[family-name:var(--font-sans)]">
                        {props.descripcion}
                    </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                    <p className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80">
                        {props.aeropuertoTipo === 'DESDE' ? 'Llegas en vuelo a' : 'Tomas tu vuelo en'} {AEROPUERTOS[props.aeropuertoNombre].nombre}
                    </p>
                    <p className="rounded-full border border-[#D6A75D]/40 bg-[#D6A75D]/10 px-3 py-1 text-xs text-[#F2C94C]">
                        Sin costo para ti · se factura a {props.empresa}
                    </p>
                </div>

                {confirmado && (
                    <div className="mt-8 rounded-2xl border border-[#D6A75D]/50 bg-[#D6A75D]/10 p-5" role="status">
                        <div className="flex items-start gap-3">
                            <FiCheckCircle className="mt-0.5 text-2xl text-[#F2C94C] shrink-0" />
                            <div>
                                <p className="text-lg">¡Listo, {confirmado.nombre}! Tu cupo está reservado.</p>
                                <p className="mt-1 text-sm text-white/70 font-[family-name:var(--font-sans)]">
                                    Salida: <strong className="text-white">{mayus(confirmado.salida)}</strong>. Te enviamos la
                                    confirmación a tu correo.
                                </p>
                                <button onClick={() => setConfirmado(null)} className="mt-3 text-sm text-[#D6A75D] underline underline-offset-4">
                                    Reservar otro cupo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!props.activo ? (
                    <p className="mt-10 rounded-xl border border-white/10 p-6 text-center text-white/60">
                        Las reservas para este servicio están cerradas.
                    </p>
                ) : !confirmado && (
                    <form onSubmit={enviar} className="mt-10 space-y-10">
                        {/* 1. Día */}
                        <section>
                            <h2 className="text-lg mb-1">1. ¿Qué día?</h2>
                            <p className="text-sm text-white/50 mb-4 font-[family-name:var(--font-sans)]">
                                El día de {props.aeropuertoTipo === 'DESDE' ? 'tu llegada' : 'tu vuelo'}.
                            </p>
                            {hoy && fechas.length === 0 ? (
                                <p className="text-white/50 text-sm">No hay fechas disponibles por ahora.</p>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {fechas.map((f) => {
                                        const d = new Date(`${f}T12:00:00Z`);
                                        const etiqueta = f === hoy ? 'Hoy' : f === fechas[1] && fechas[0] === hoy ? 'Mañana' : mayus(d.toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'short' }).replace('.', ''));
                                        return (
                                            <button type="button" key={f} onClick={() => elegirFecha(f)} aria-pressed={fecha === f} className={chip(fecha === f)}>
                                                <span className="block text-xs text-white/60">{etiqueta}</span>
                                                <span className="block text-lg leading-tight">
                                                    {d.getUTCDate()} {d.toLocaleDateString('es-CO', { timeZone: 'UTC', month: 'short' }).replace('.', '')}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <label className="mt-3 flex items-center gap-2 text-sm text-white/60 font-[family-name:var(--font-sans)]">
                                <FiCalendar className="text-[#D6A75D]" />
                                Otra fecha:
                                <input
                                    type="date"
                                    min={hoy || undefined}
                                    max={props.reglas.fechaHasta ?? undefined}
                                    value={fecha && !fechas.includes(fecha) ? fecha : ''}
                                    onChange={(e) => elegirFecha(e.target.value)}
                                    className="rounded-md bg-white/5 border border-white/15 px-2 py-1.5 text-white [color-scheme:dark]"
                                />
                            </label>
                        </section>

                        {/* 2. Hora */}
                        {fecha && (
                            <section>
                                <h2 className="text-lg mb-1">2. ¿A qué hora?</h2>
                                <p className="text-sm text-white/50 mb-4 font-[family-name:var(--font-sans)]">
                                    {fechaLarga(fecha)} · elige la que mejor se ajuste a {SENTIDOS[props.aeropuertoTipo].vuelo}.
                                </p>
                                {cargandoHoras ? (
                                    <p className="flex items-center gap-2 text-sm text-white/50"><FiLoader className="animate-spin" /> Buscando horarios…</p>
                                ) : horas && horas.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {horas.map((h) => {
                                            const lleno = h.disponibles === 0;
                                            const off = lleno || h.yaPaso;
                                            const sel = h.horarioId === horarioId;
                                            return (
                                                <button
                                                    type="button"
                                                    key={h.horarioId}
                                                    disabled={off}
                                                    onClick={() => setHorarioId(h.horarioId)}
                                                    aria-pressed={sel}
                                                    className={chip(sel, off)}
                                                >
                                                    <span className="flex items-center gap-1.5 text-lg">
                                                        <FiClock className={sel ? 'text-[#F2C94C]' : 'text-white/50'} />
                                                        {horaBonita(h.hora)}
                                                    </span>
                                                    <span className="mt-1 flex items-center gap-1 text-xs text-white/60 font-[family-name:var(--font-sans)]">
                                                        <FiUsers className="shrink-0" />
                                                        {h.yaPaso ? 'Ya pasó' : lleno ? 'Lleno' : `${h.disponibles} de ${h.capacidad} libres`}
                                                    </span>
                                                    <span className="mt-2 block h-1 rounded-full bg-white/10 overflow-hidden">
                                                        <span
                                                            className="block h-full bg-[#D6A75D]"
                                                            style={{ width: `${((h.capacidad - h.disponibles) / h.capacidad) * 100}%` }}
                                                        />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    !error && <p className="text-sm text-white/50">No hay horarios para ese día.</p>
                                )}
                            </section>
                        )}

                        {/* 3. Datos */}
                        {horaSel && (
                            <section>
                                <h2 className="text-lg mb-4">3. Tus datos</h2>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="sm:col-span-2 block">
                                        <span className="text-xs text-white/60">Nombre completo *</span>
                                        <input required value={form.nombre} onChange={set('nombre')} className={inputCls} autoComplete="name" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs text-white/60">Número de vuelo (opcional)</span>
                                        <input value={form.numeroVuelo} onChange={set('numeroVuelo')} placeholder="Ej. AV9301" className={`${inputCls} uppercase placeholder:normal-case`} />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs text-white/60">WhatsApp *</span>
                                        <input required type="tel" value={form.telefono} onChange={set('telefono')} placeholder="+57 300 000 0000" className={inputCls} autoComplete="tel" />
                                    </label>
                                    <label className="sm:col-span-2 block">
                                        <span className="text-xs text-white/60">Correo electrónico *</span>
                                        <input required type="email" value={form.email} onChange={set('email')} className={inputCls} autoComplete="email" />
                                        <span className="mt-1 block text-[11px] text-white/40 font-[family-name:var(--font-sans)]">Aquí te llega la confirmación de tu cupo.</span>
                                    </label>
                                </div>
                            </section>
                        )}

                        {error && (
                            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                                {error}
                            </p>
                        )}

                        {horaSel && fecha && (
                            <button
                                type="submit"
                                disabled={enviando}
                                className="w-full rounded-xl bg-[#D6A75D] py-4 text-base text-black transition-colors hover:bg-[#F2C94C] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {enviando && <FiLoader className="animate-spin" />}
                                Reservar · {fechaLarga(fecha)}, {horaBonita(horaSel.hora)}
                            </button>
                        )}
                    </form>
                )}

                <footer className="mt-16 text-center text-xs text-white/35 font-[family-name:var(--font-sans)]">
                    ¿Dudas o cambio de vuelo?{' '}
                    <a href="https://wa.me/573175177409" target="_blank" rel="noopener noreferrer" className="text-[#D6A75D]">
                        Escríbenos por WhatsApp
                    </a>
                </footer>
            </div>
        </main>
    );
}
