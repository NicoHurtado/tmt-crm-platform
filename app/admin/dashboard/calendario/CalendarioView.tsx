'use client';

import { useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

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

export default function CalendarioView({ events, onEventClick, onDatesSet }: Props) {
    const calendarRef = useRef<any>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);

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
        <div ref={calendarContainerRef} className="border border-neutral-200 rounded-xl overflow-hidden bg-white w-full">
            <style>{`
                .fc { font-family: inherit; }
                .fc .fc-toolbar { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
                .fc .fc-toolbar-title { font-size: 15px; font-weight: 600; color: #111827; }
                .fc .fc-button { background: white; border: 1px solid #d1d5db; color: #374151; font-size: 13px; font-weight: 500; padding: 5px 12px; border-radius: 6px; }
                .fc .fc-button:hover { background: #f3f4f6; }
                .fc .fc-button-active, .fc .fc-button-primary:not(:disabled):active { background: #f59e0b !important; border-color: #f59e0b !important; color: white !important; box-shadow: none !important; }
                .fc .fc-button-primary:disabled { opacity: 0.5; }
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
                datesSet={onDatesSet}
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
    );
}
