'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getLocalizedText } from '@/types/multi-language';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
import ReservaDetailSheet, { type ReservaDetail } from '@/components/admin/ReservaDetailSheet';
import { getDatos } from '@/types/reserva-datos';
import type { CalendarEvent } from './CalendarioView';

const CalendarioView = dynamic(() => import('./CalendarioView'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-96 border border-neutral-200 rounded-xl bg-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
                <p className="mt-3 text-sm text-neutral-500">Cargando calendario...</p>
            </div>
        </div>
    ),
});

const estadoColors: Record<string, { bg: string; border: string; text: string }> = {
    'PENDING_PAYMENT': { bg: '#EAB308', border: '#CA8A04', text: '#ffffff' },
    'CONFIRMED_UNASSIGNED': { bg: '#3B82F6', border: '#2563EB', text: '#ffffff' },
    'CONFIRMED_ASSIGNED': { bg: '#7C3AED', border: '#6D28D9', text: '#ffffff' },
    'IN_PROGRESS': { bg: '#F97316', border: '#EA580C', text: '#ffffff' },
    'COMPLETED': { bg: '#009E73', border: '#0072B2', text: '#ffffff' },
    'CANCELLED': { bg: '#333333', border: '#000000', text: '#ffffff' },
    'PAYMENT_FAILED': { bg: '#DC2626', border: '#B91C1C', text: '#ffffff' }
};

export default function CalendarioPage() {
    const router = useRouter();
    const [rawReservas, setRawReservas] = useState<any[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [reservasForSheet, setReservasForSheet] = useState<ReservaDetail[]>([]);
    const [currentMonth, setCurrentMonth] = useState<{ start: Date; end: Date; label: string }>({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        label: new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    });

    useEffect(() => {
        fetchReservas();
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchReservas();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') fetchReservas();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchReservas = async () => {
        try {
            const res = await fetch('/api/reservas');
            const data = await res.json();
            const reservas = data.data || [];
            setRawReservas(reservas);

            // Build sheet-compatible list
            const sheetReservas: ReservaDetail[] = reservas.map((r: any) => ({
                id: r.id,
                codigo: r.codigo,
                nombreCliente: r.nombreCliente,
                emailCliente: r.emailCliente,
                whatsappCliente: r.whatsappCliente,
                fecha: r.fecha,
                hora: r.hora,
                estado: r.estado,
                metodoPago: r.metodoPago,
                precioTotal: r.precioTotal,
                esCotizacion: r.esCotizacion,
                servicio: r.servicio,
                aliado: r.aliado,
                esReservaAliado: r.esReservaAliado,
                clientePaga: r.clientePaga,
                conductor: r.conductor,
                vehiculo: r.vehiculo,
                numeroPasajeros: r.numeroPasajeros,
                notas: r.notas,
                datos: r.datos,
            }));
            setReservasForSheet(sheetReservas);

            const calendarEvents: CalendarEvent[] = reservas.map((reserva: any) => {
                const colors = estadoColors[reserva.estado] || { bg: '#e5e7eb', border: '#d1d5db', text: '#374151' };

                const d = getDatos(reserva.datos);
                let lugarRecogida = d.lugarRecogida || 'No especificado';
                let lugarDestino = 'No especificado';

                if (reserva.servicio?.esAeropuerto) {
                    const airport = d.aeropuertoNombre === 'JOSE_MARIA_CORDOVA'
                        ? 'Aeropuerto JMC' : 'Aeropuerto Olaya Herrera';
                    if (d.aeropuertoTipo === 'DESDE') {
                        lugarRecogida = airport;
                        lugarDestino = d.lugarRecogida || 'No especificado';
                    } else {
                        lugarRecogida = d.lugarRecogida || 'No especificado';
                        lugarDestino = airport;
                    }
                } else if (d.trasladoTipo) {
                    if (d.trasladoTipo === 'DESDE_UBICACION') {
                        lugarRecogida = d.lugarRecogida || 'No especificado';
                        lugarDestino = d.trasladoDestino || reserva.municipio || 'No especificado';
                    } else {
                        lugarRecogida = reserva.municipio || 'No especificado';
                        lugarDestino = d.trasladoDestino || 'No especificado';
                    }
                } else {
                    lugarDestino = reserva.servicio?.destinoAutoFill
                        ? (typeof reserva.servicio.destinoAutoFill === 'string'
                            ? reserva.servicio.destinoAutoFill
                            : getLocalizedText(reserva.servicio.destinoAutoFill, 'ES'))
                        : 'No especificado';
                }

                const hora = reserva.hora || '00:00';
                const dateStr = reserva.fecha.split('T')[0];
                const serviceName = reserva.servicio?.nombre
                    ? getLocalizedText(reserva.servicio.nombre, 'ES')
                    : 'Servicio';

                // Cap end within the same day so late-night events (e.g. 23:45) don't bleed into the next day
                const [hh, mm] = hora.split(':').map(Number);
                const endTotalMin = hh * 60 + mm + 60;
                const endStr = endTotalMin >= 24 * 60
                    ? `${dateStr}T23:59`
                    : `${dateStr}T${String(Math.floor(endTotalMin / 60)).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`;

                return {
                    id: reserva.id,
                    title: `${hora} · ${reserva.nombreCliente}`,
                    start: `${dateStr}T${hora}`,
                    end: endStr,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    textColor: colors.text,
                    extendedProps: {
                        codigo: reserva.codigo,
                        cliente: reserva.nombreCliente,
                        estado: reserva.estado,
                        hora,
                        servicio: serviceName,
                        whatsappCliente: reserva.whatsappCliente || 'No especificado',
                        lugarRecogida,
                        lugarDestino,
                        estadoPago: reserva.estadoPago || 'PENDIENTE',
                        asistentes: reserva.asistentes || [],
                        esReservaAliado: reserva.esReservaAliado ?? false,
                        aliado: reserva.aliado?.nombre ?? null,
                    }
                };
            });

            setEvents(calendarEvents);
        } catch (error) {
            console.error('Error fetching reservas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEventClick = (info: any) => {
        setSelectedId(info.event.id);
    };

    const handleDatesSet = (dateInfo: any) => {
        setCurrentMonth({
            start: dateInfo.start,
            end: dateInfo.end,
            label: new Date(dateInfo.start.getTime() + 7 * 24 * 60 * 60 * 1000)
                .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        });
    };

    const handleExportExcel = () => {
        if (!rawReservas.length) return;
        const monthReservas = rawReservas.filter((r: any) => {
            const fecha = new Date(r.fecha);
            return fecha >= currentMonth.start && fecha < currentMonth.end;
        }).sort((a: any, b: any) => {
            const dc = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
            return dc !== 0 ? dc : (a.hora || '').localeCompare(b.hora || '');
        });

        if (!monthReservas.length) {
            alert('No hay reservas en este mes para exportar');
            return;
        }

        const estadoLabels: Record<string, string> = {
            'PENDING_PAYMENT': 'Pendiente de Pago',
            'CONFIRMED_UNASSIGNED': 'Confirmada · Sin Asignar',
            'CONFIRMED_ASSIGNED': 'Confirmada · Asignada',
            'IN_PROGRESS': 'En Curso',
            'COMPLETED': 'Completada',
            'CANCELLED': 'Cancelada',
            'PAYMENT_FAILED': 'Pago Fallido',
        };

        const excelData = monthReservas.map((r: any) => {
            const rd = getDatos(r.datos);
            let recogida = rd.lugarRecogida || 'No especificado';
            let destino = 'No especificado';
            if (r.servicio?.esAeropuerto) {
                const ap = rd.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' ? 'Aeropuerto JMC' : 'Aeropuerto Olaya Herrera';
                if (rd.aeropuertoTipo === 'DESDE') { recogida = ap; destino = rd.lugarRecogida || 'No especificado'; }
                else { recogida = rd.lugarRecogida || 'No especificado'; destino = ap; }
            } else if (rd.trasladoTipo) {
                if (rd.trasladoTipo === 'DESDE_UBICACION') { recogida = rd.lugarRecogida || 'No especificado'; destino = rd.trasladoDestino || r.municipio || 'No especificado'; }
                else { recogida = r.municipio || 'No especificado'; destino = rd.trasladoDestino || 'No especificado'; }
            } else {
                destino = r.servicio?.destinoAutoFill
                    ? (typeof r.servicio.destinoAutoFill === 'string' ? r.servicio.destinoAutoFill : getLocalizedText(r.servicio.destinoAutoFill, 'ES'))
                    : 'No especificado';
            }
            return {
                'FECHA': new Date(r.fecha).toLocaleDateString('es-CO'),
                'HORA': r.hora || '',
                'CÓDIGO': r.codigo,
                'SERVICIO': r.servicio?.nombre ? getLocalizedText(r.servicio.nombre, 'ES') : '-',
                'CLIENTE': r.nombreCliente,
                'WHATSAPP': r.whatsappCliente || '',
                'RECOGIDA': recogida,
                'DESTINO': destino,
                'PASAJEROS': r.numeroPasajeros || 1,
                'Nº VUELO': (rd.numeroVuelo as string) || '',
                'ESTADO': estadoLabels[r.estado] || r.estado,
                'CONDUCTOR': r.conductor?.nombre || 'Sin asignar',
                'TOTAL': Number(r.precioTotal) || 0,
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 25 },
            { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
            { wch: 22 }, { wch: 20 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Calendario');
        XLSX.writeFile(wb, `Calendario_${currentMonth.label.replace(/\s+/g, '_')}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
                    <p className="mt-3 text-sm text-neutral-500">Cargando calendario...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-6 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-neutral-900">Calendario</h1>
                    <p className="text-sm text-neutral-500 mt-0.5">Vista de reservas</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="gap-1.5 text-sm border-neutral-200"
                >
                    <Download size={14} />
                    Exportar Excel
                </Button>
            </div>

            {/* Status legend */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'PENDING_PAYMENT',    label: 'Pendiente de pago'    },
                { key: 'CONFIRMED_UNASSIGNED', label: 'Confirmada · Sin asignar' },
                { key: 'CONFIRMED_ASSIGNED',  label: 'Confirmada · Asignada' },
                { key: 'IN_PROGRESS',         label: 'En curso'             },
                { key: 'COMPLETED',           label: 'Completada'           },
                { key: 'CANCELLED',           label: 'Cancelada'            },
                { key: 'PAYMENT_FAILED',      label: 'Pago fallido'         },
              ].map(({ key, label }) => {
                const c = estadoColors[key];
                return (
                  <span
                    key={key}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                    style={{ backgroundColor: c.bg + '18', borderColor: c.bg + '55', color: '#374151' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.bg }}
                    />
                    {label}
                  </span>
                );
              })}
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: '#f59e0b18', borderColor: '#f59e0b55', color: '#374151' }}
              >
                <span className="text-[10px] leading-none">★</span>
                Vía aliado
              </span>
            </div>

            {/* Full-width calendar — lazy loaded */}
            <CalendarioView
                events={events}
                onEventClick={handleEventClick}
                onDatesSet={handleDatesSet}
            />

            {/* Side panel — same as Reservas */}
            <ReservaDetailSheet
                reservaId={selectedId}
                reservas={reservasForSheet}
                onClose={() => setSelectedId(null)}
            />
        </div>
    );
}
