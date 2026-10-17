'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiCheckCircle, FiClock, FiMapPin, FiUsers, FiLoader } from 'react-icons/fi';

export interface TurnoPublico {
    id: string;
    fechaHora: string;
    capacidad: number;
    disponibles: number;
    vehiculo: string | null;
    yaSalio: boolean;
}

interface Props {
    codigo: string;
    activo: boolean;
    empresa: string;
    titulo: string;
    descripcion: string | null;
    origen: string;
    destino: string;
    turnos: TurnoPublico[];
}

const TZ = 'America/Bogota';
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDia = (iso: string) =>
    mayus(new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }));
const fmtHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });

const EMPTY = { nombre: '', email: '', telefono: '', numeroVuelo: '' };

export default function ReservaCupoCorporativo(props: Props) {
    const router = useRouter();
    const [turnoId, setTurnoId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmado, setConfirmado] = useState<{ salida: string; nombre: string } | null>(null);

    const porDia = useMemo(() => {
        const grupos: { dia: string; turnos: TurnoPublico[] }[] = [];
        for (const t of props.turnos) {
            const dia = fmtDia(t.fechaHora);
            const g = grupos.find((x) => x.dia === dia);
            g ? g.turnos.push(t) : grupos.push({ dia, turnos: [t] });
        }
        return grupos;
    }, [props.turnos]);

    const turnoSel = props.turnos.find((t) => t.id === turnoId) ?? null;

    const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!turnoId) return setError('Escoge un horario');
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/public/corporativo/${props.codigo}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, turnoId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No pudimos reservar tu cupo');
                router.refresh();
                return;
            }
            setConfirmado({ salida: data.data.salida, nombre: form.nombre });
            setForm(EMPTY);
            setTurnoId(null);
            router.refresh();
        } catch {
            setError('Error de conexión, intenta de nuevo');
        } finally {
            setEnviando(false);
        }
    };

    const inputCls =
        'w-full rounded-lg bg-white/5 border border-white/15 px-3.5 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D6A75D] focus:ring-1 focus:ring-[#D6A75D] font-[family-name:var(--font-sans)]';

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
                <p className="mt-4 inline-block rounded-full border border-[#D6A75D]/40 bg-[#D6A75D]/10 px-3 py-1 text-xs text-[#F2C94C]">
                    Sin costo para ti · se factura a {props.empresa}
                </p>

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
                                <button
                                    onClick={() => setConfirmado(null)}
                                    className="mt-3 text-sm text-[#D6A75D] underline underline-offset-4"
                                >
                                    Reservar otro cupo
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!props.activo ? (
                    <p className="mt-10 rounded-xl border border-white/10 p-6 text-center text-white/60">
                        Las reservas para este evento están cerradas.
                    </p>
                ) : !confirmado && (
                    <form onSubmit={enviar} className="mt-10 space-y-10">
                        <section>
                            <h2 className="text-lg mb-1">1. Escoge tu hora de salida</h2>
                            <p className="text-sm text-white/50 mb-4 font-[family-name:var(--font-sans)]">
                                Elige el turno que mejor se ajuste a la llegada de tu vuelo.
                            </p>
                            {porDia.length === 0 && (
                                <p className="text-white/50 text-sm">Aún no hay horarios publicados.</p>
                            )}
                            <div className="space-y-6">
                                {porDia.map((g) => (
                                    <div key={g.dia}>
                                        <p className="text-xs tracking-wide text-white/50 mb-2">{g.dia}</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            {g.turnos.map((t) => {
                                                const lleno = t.disponibles === 0;
                                                const off = lleno || t.yaSalio;
                                                const sel = t.id === turnoId;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={t.id}
                                                        disabled={off}
                                                        onClick={() => setTurnoId(t.id)}
                                                        aria-pressed={sel}
                                                        className={[
                                                            'rounded-xl border p-3 text-left transition-colors',
                                                            sel
                                                                ? 'border-[#D6A75D] bg-[#D6A75D]/15'
                                                                : 'border-white/15 bg-white/[0.03] hover:border-white/40',
                                                            off && 'opacity-40 cursor-not-allowed hover:border-white/15',
                                                        ].filter(Boolean).join(' ')}
                                                    >
                                                        <span className="flex items-center gap-1.5 text-lg">
                                                            <FiClock className={sel ? 'text-[#F2C94C]' : 'text-white/50'} />
                                                            {fmtHora(t.fechaHora)}
                                                        </span>
                                                        <span className="mt-1 flex items-center gap-1 text-xs text-white/60 font-[family-name:var(--font-sans)]">
                                                            <FiUsers className="shrink-0" />
                                                            {t.yaSalio ? 'Ya salió' : lleno ? 'Lleno' : `${t.disponibles} de ${t.capacidad} libres`}
                                                        </span>
                                                        <span className="mt-2 block h-1 rounded-full bg-white/10 overflow-hidden">
                                                            <span
                                                                className="block h-full bg-[#D6A75D]"
                                                                style={{ width: `${((t.capacidad - t.disponibles) / t.capacidad) * 100}%` }}
                                                            />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={turnoSel ? '' : 'opacity-50 pointer-events-none'}>
                            <h2 className="text-lg mb-4">2. Tus datos</h2>
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

                            {error && (
                                <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={!turnoSel || enviando}
                                className="mt-6 w-full rounded-xl bg-[#D6A75D] py-4 text-base text-black transition-colors hover:bg-[#F2C94C] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {enviando && <FiLoader className="animate-spin" />}
                                {turnoSel ? `Reservar cupo de las ${fmtHora(turnoSel.fechaHora)}` : 'Escoge un horario'}
                            </button>
                        </section>
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
