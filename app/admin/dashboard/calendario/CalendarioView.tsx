'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';

export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    extendedProps: {
        codigo: string;
        cliente: string;
        estado: string;
        hora: string;
        servicio: string;
        whatsappCliente: string;
        lugarRecogida: string;
        lugarDestino: string;
        estadoPago: string;
        asistentes: any[];
        esReservaAliado: boolean;
        aliado: string | null;
    };
}

interface Props {
    events: CalendarEvent[];
    onEventClick: (info: any) => void;
    onDatesSet: (dateInfo: any) => void;
}

/** Clave YYYY-MM-DD en hora **local**. Con `toISOString()` la clave sale en UTC
 *  y en Colombia (UTC-5) toda reserva desde las 19:00 se agrupaba en el día
 *  siguiente. */
function claveDia(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
    ).padStart(2, '0')}`;
}

/** Agrupa por día y ordena, para la agenda de móvil. */
function agruparPorDia(events: CalendarEvent[], desde: Date | null, hasta: Date | null) {
    const dentroDelRango = (e: CalendarEvent) => {
        if (!desde || !hasta) return true;
        const t = new Date(e.start).getTime();
        return t >= desde.getTime() && t < hasta.getTime();
    };

    const porDia = new Map<string, CalendarEvent[]>();
    events
        .filter(dentroDelRango)
        .sort((a, b) => {
            const d = new Date(a.start).getTime() - new Date(b.start).getTime();
            return d !== 0 ? d : (a.extendedProps.hora || '').localeCompare(b.extendedProps.hora || '');
        })
        .forEach((e) => {
            const dia = claveDia(new Date(e.start));
            if (!porDia.has(dia)) porDia.set(dia, []);
            porDia.get(dia)!.push(e);
        });

    return Array.from(porDia.entries());
}

type Dia = [string, CalendarEvent[]];

export default function CalendarioView({ events, onEventClick, onDatesSet }: Props) {
    const calendarRef = useRef<any>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    /** Rango que está mostrando el calendario. Lo dicta FullCalendar (que sigue
     *  siendo la única fuente de verdad del mes visible) y la agenda de móvil lo
     *  usa para filtrar; así los dos siempre muestran lo mismo. */
    const [rango, setRango] = useState<{ start: Date; end: Date } | null>(null);

    const manejarDatesSet = (info: any) => {
        setRango({ start: info.start, end: info.end });
        onDatesSet(info);
    };

    const api = () => calendarRef.current?.getApi();

    /** El rango que reporta FullCalendar es el de la **rejilla**, con relleno de
     *  los meses vecinos: para agosto de 2026 arranca el domingo 26 de julio. En
     *  la rejilla ese relleno se ve gris y se entiende; en una lista parecía que
     *  el mes empezaba en julio. La agenda usa el mes real. */
    const mes = useMemo(() => {
        if (!rango) return null;
        const dentro = new Date(rango.start.getTime() + 7 * 24 * 60 * 60 * 1000);
        return {
            start: new Date(dentro.getFullYear(), dentro.getMonth(), 1),
            end: new Date(dentro.getFullYear(), dentro.getMonth() + 1, 1),
        };
    }, [rango]);

    const etiquetaMes = mes
        ? mes.start.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        : '';

    const dias = useMemo(
        () => agruparPorDia(events, mes?.start ?? null, mes?.end ?? null),
        [events, mes],
    );

    /** Hoy arriba y el futuro debajo: en una lista de un mes entero, los días ya
     *  pasados empujaban la reserva de hoy fuera de la primera pantalla. Se
     *  separan y los pasados quedan plegados al final — siguen a un toque, pero
     *  no estorban. Las claves son YYYY-MM-DD, así que comparar strings ordena
     *  igual que comparar fechas. */
    const hoyClave = claveDia(new Date());
    const pasados: Dia[] = dias.filter(([d]) => d < hoyClave);
    const proximos: Dia[] = dias.filter(([d]) => d >= hoyClave);

    const renderDia = ([dia, delDia]: Dia) => {
        const fecha = new Date(dia + 'T12:00:00');
        const esHoy = dia === hoyClave;
        return (
            <div key={dia}>
                {/* Cabecera de día pegajosa: al scrollear una lista larga
                    es lo único que dice en qué día vas parado. */}
                <div
                    className={`sticky top-14 z-10 -mx-4 px-4 py-1.5 backdrop-blur-sm ${
                        esHoy ? 'bg-amber-50/95' : 'bg-neutral-50/95'
                    }`}
                >
                    <span
                        className={`text-xs font-semibold inline-block first-letter:uppercase ${
                            esHoy ? 'text-amber-700' : 'text-neutral-600'
                        }`}
                    >
                        {fecha.toLocaleDateString('es-CO', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                        })}
                        {esHoy && ' · hoy'}
                    </span>
                    <span className="text-[11px] text-neutral-400 ml-1.5">({delDia.length})</span>
                </div>

                <div className="flex flex-col gap-1.5 mt-1.5">
                    {delDia.map((e) => (
                        <button
                            key={e.id}
                            onClick={() =>
                                onEventClick({
                                    event: { id: e.id, extendedProps: e.extendedProps },
                                })
                            }
                            className="w-full text-left rounded-xl border border-neutral-200 bg-white p-3 pl-3.5 active:bg-neutral-50 transition-colors"
                            style={{ borderLeftWidth: 4, borderLeftColor: e.backgroundColor }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-neutral-900 truncate">
                                        {e.extendedProps.hora || '—'}
                                        <span className="font-normal text-neutral-500">
                                            {' · '}
                                            {e.extendedProps.codigo}
                                        </span>
                                    </p>
                                    <p className="text-[13px] text-neutral-800 mt-0.5 truncate">
                                        {e.extendedProps.cliente}
                                    </p>
                                    <p className="text-xs text-neutral-500 mt-0.5 truncate">
                                        {e.extendedProps.servicio}
                                    </p>
                                </div>
                                {e.extendedProps.esReservaAliado && (
                                    <span
                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 flex-shrink-0"
                                        title={e.extendedProps.aliado ?? 'Vía aliado'}
                                    >
                                        ★
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    useEffect(() => {
        const container = calendarContainerRef.current;
        if (!container) return;
        let rafId: number;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                calendarRef.current?.getApi()?.updateSize();
            });
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <>
        {/* ── MÓVIL: agenda ──────────────────────────────────────────────
            Una rejilla de mes en 375px da celdas de ~50px: no cabe ni el título
            de una reserva, así que todo termina en "+3 más" y el calendario deja
            de servir para lo único que importa aquí, que es ver qué hay y a qué
            hora. Las apps de calendario resuelven esto en teléfono con vista de
            agenda: los días en una lista vertical y, dentro de cada día, sus
            eventos con hora. Eso es lo que se muestra abajo.

            El FullCalendar de escritorio se queda montado (oculto) porque sigue
            siendo quien manda el rango visible: los botones de aquí le hablan por
            su API, y él avisa del cambio por datesSet. Así no hay dos
            calendarios que puedan desincronizarse. */}
        <div className="lg:hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => api()?.prev()}
                    aria-label="Mes anterior"
                    className="w-11 h-11 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 active:bg-neutral-100"
                >
                    <ChevronLeft size={18} />
                </button>
                <div className="flex-1 min-w-0 text-center">
                    {/* `first-letter` y no `capitalize`: toLocaleDateString devuelve
                        "agosto de 2026" y capitalize lo dejaría en "Agosto De 2026". */}
                    <p className="text-sm font-semibold text-neutral-900 first-letter:uppercase truncate">
                        {etiquetaMes || '—'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                        {dias.reduce((n, [, evs]) => n + evs.length, 0)} reserva
                        {dias.reduce((n, [, evs]) => n + evs.length, 0) === 1 ? '' : 's'}
                    </p>
                </div>
                <button
                    onClick={() => api()?.next()}
                    aria-label="Mes siguiente"
                    className="w-11 h-11 flex-shrink-0 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 active:bg-neutral-100"
                >
                    <ChevronRight size={18} />
                </button>
                <button
                    onClick={() => api()?.today()}
                    className="h-11 px-3 flex-shrink-0 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-700 active:bg-neutral-100"
                >
                    Hoy
                </button>
            </div>

            {dias.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-12 text-center">
                    <CalendarDays size={22} className="mx-auto text-neutral-300" />
                    <p className="mt-2 text-sm text-neutral-400">
                        Sin reservas en {etiquetaMes || 'este mes'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {/* Si el mes entero ya pasó (navegando hacia atrás) no hay nada
                        que plegar: se listan los días tal cual. */}
                    {proximos.length === 0
                        ? pasados.map(renderDia)
                        : proximos.map(renderDia)}

                    {proximos.length > 0 && pasados.length > 0 && (
                        <details className="group">
                            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 h-11 text-xs font-medium text-neutral-500">
                                <ChevronDown
                                    size={14}
                                    className="transition-transform group-open:rotate-180"
                                />
                                Días anteriores de{' '}
                                <span className="first-letter:uppercase">{etiquetaMes}</span> (
                                {pasados.reduce((n, [, evs]) => n + evs.length, 0)})
                            </summary>
                            <div className="flex flex-col gap-3 mt-1">{pasados.map(renderDia)}</div>
                        </details>
                    )}
                </div>
            )}
        </div>

        {/* ── ESCRITORIO: la rejilla de mes de siempre ── */}
        <div ref={calendarContainerRef} className="hidden lg:block border border-neutral-200 rounded-xl overflow-hidden bg-white w-full">
            <style>{`
                .fc { font-family: inherit; }
                .fc .fc-toolbar { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
                .fc .fc-toolbar-title { font-size: 15px; font-weight: 600; color: #111827; }
                .fc .fc-button { background: white; border: 1px solid #d1d5db; color: #374151; font-size: 13px; font-weight: 500; padding: 5px 12px; border-radius: 6px; }
                .fc .fc-button:hover { background: #f3f4f6; }
                .fc .fc-button-active, .fc .fc-button-primary:not(:disabled):active { background: #f59e0b !important; border-color: #f59e0b !important; color: white !important; box-shadow: none !important; }
                .fc .fc-button-primary:disabled { opacity: 0.5; }
                /* En pantallas táctiles los botones de la barra (anterior, siguiente, Hoy,
                   Mes, Semana, Día) suben de 32 a 44px de alto, el mínimo recomendado por
                   Apple y Google. Se limita a (pointer: coarse) para que con ratón sigan
                   exactamente igual. El ancho ya superaba los 44px en todos. */
                @media (pointer: coarse) {
                    .fc .fc-button { min-height: 44px; }
                }
                /* La barra de FullCalendar reparte sus tres bloques en una fila y no envuelve:
                   en un teléfono el botón "Hoy" se montaba sobre el título, el título se
                   partía en tres líneas y los botones de vista lo pisaban. En pantalla
                   pequeña se apilan y se centran. Desde 640px queda la fila original. */
                @media (max-width: 640px) {
                    .fc .fc-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
                    .fc .fc-toolbar-chunk { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 8px; }
                    .fc .fc-toolbar-title { text-align: center; }
                }
                .fc .fc-col-header-cell { background: #f9fafb; padding: 8px 0; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #d1d5db; border-right: 1px solid #d1d5db; }
                .fc .fc-scrollgrid { border-color: #d1d5db !important; }
                .fc .fc-scrollgrid-section > td { border-color: #d1d5db !important; }
                .fc td, .fc th { border-color: #d1d5db !important; }
                .fc .fc-daygrid-day { background: white; }
                .fc .fc-daygrid-day-number { font-size: 12px; color: #9ca3af; padding: 6px 8px; }
                .fc .fc-day-other { background: #fafafa; }
                .fc .fc-day-other .fc-daygrid-day-number { color: #d1d5db; }
                .fc .fc-day-today { background: #fffbeb !important; }
                .fc .fc-day-today .fc-daygrid-day-number { color: #d97706; font-weight: 700; }
                .fc .fc-event { border-radius: 3px; font-size: 11px; font-weight: 500; padding: 2px 5px; cursor: pointer; border-left-width: 2px !important; border-top: none !important; border-right: none !important; border-bottom: none !important; }
                .fc .fc-event:hover { filter: brightness(0.95); }
                .fc .fc-more-link { font-size: 11px; color: #6b7280; font-weight: 500; padding: 1px 4px; }
                .fc .fc-daygrid-more-link:hover { background: #f3f4f6; border-radius: 3px; }
                .fc .fc-daygrid-day-events { padding: 2px 3px 3px; gap: 1px; }
                .fc .fc-daygrid-event-harness { margin-bottom: 1px; }
            `}</style>
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="es"
                events={events}
                eventOrder="start"
                eventClick={onEventClick}
                datesSet={manejarDatesSet}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,dayGridWeek,dayGridDay'
                }}
                buttonText={{
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día'
                }}
                height="auto"
                windowResizeDelay={0}
                eventDisplay="block"
                displayEventTime={false}
                dayMaxEvents={4}
                eventClassNames="cursor-pointer"
                eventContent={(arg) => {
                    const isAliado = arg.event.extendedProps.esReservaAliado;
                    return (
                        <div className="overflow-hidden truncate px-1 text-[11px] font-medium flex items-center gap-0.5 w-full">
                            {isAliado && <span className="text-[9px] flex-shrink-0 opacity-90">★</span>}
                            <span className="truncate">{arg.event.title}</span>
                        </div>
                    );
                }}
            />
        </div>
        </>
    );
}
