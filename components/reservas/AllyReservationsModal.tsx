'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiX, FiCalendar, FiSearch, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLocalizedText } from '@/types/multi-language';
import { useLanguage, t } from '@/lib/i18n';
import { DateInput } from '@/components/ui';

interface Reservation {
    id: string;
    codigo: string;
    fecha: string;
    hora: string;
    nombreCliente: string;
    servicio: {
        nombre: any;
    };
    estado: string;
    precioTotal: number;
    comisionAliado: number | null;
}

interface AllyReservationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    aliadoId: string;
}

export default function AllyReservationsModal({ isOpen, onClose, aliadoId }: AllyReservationsModalProps) {
    const { language } = useLanguage();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchReservations = useCallback(async () => {
        setLoading(true);
        try {
            let url = `/api/aliados/${aliadoId}/reservas`;
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                setReservations(data.data);
            }
        } catch (error) {
            console.error('Error fetching reservations:', error);
        } finally {
            setLoading(false);
        }
    }, [aliadoId, startDate, endDate]);

    useEffect(() => {
        if (isOpen && aliadoId) {
            fetchReservations();
        }
    }, [isOpen, aliadoId, fetchReservations]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReservations();
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
            CONFIRMED_UNASSIGNED: 'bg-blue-100 text-blue-800',
            CONFIRMED_ASSIGNED: 'bg-violet-100 text-violet-800',
            IN_PROGRESS: 'bg-orange-100 text-orange-800',
            COMPLETED: 'bg-gray-100 text-gray-800',
            CANCELLED: 'bg-red-100 text-red-800',
            PAYMENT_FAILED: 'bg-red-200 text-red-900',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {t(`estados.${status}`, language) || status}
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold">{t('reservas.mis_reservas_titulo', language)}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 rounded-full p-2"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-6 bg-gray-50 border-b">
                    <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha Inicio
                            </label>
                            <DateInput
                                value={startDate}
                                onChange={(value) => setStartDate(value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('reservas.hasta', language)}
                            </label>
                            <DateInput
                                value={endDate}
                                onChange={(value) => setEndDate(value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <FiSearch />
                            {t('comunes.filtrar', language)}
                        </button>
                    </form>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]"></div>
                        </div>
                    ) : reservations.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <FiCalendar size={48} className="mx-auto mb-4 opacity-50" />
                            <p>{t('comunes.sin_resultados', language)}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b text-sm text-gray-500">
                                        <th className="py-3 px-4">{t('tracking.codigo', language)}</th>
                                        <th className="py-3 px-4">{t('tracking.fecha', language)}</th>
                                        <th className="py-3 px-4">{t('tracking.servicio', language)}</th>
                                        <th className="py-3 px-4">{t('tracking.nombre', language)}</th>
                                        <th className="py-3 px-4">{t('tracking.estado', language)}</th>
                                        <th className="py-3 px-4 text-right">Comisión</th>
                                        <th className="py-3 px-4 text-right">{t('tracking.total', language)}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {reservations.map((res) => (
                                        <tr key={res.id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-4 font-mono font-bold text-[#D6A75D]">
                                                {res.codigo}
                                            </td>
                                            <td className="py-3 px-4">
                                                {format(new Date(res.fecha), 'dd MMM yyyy', { locale: es })}
                                                <br />
                                                <span className="text-xs text-gray-500">{res.hora}</span>
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {getLocalizedText(res.servicio.nombre, language)}
                                            </td>
                                            <td className="py-3 px-4">
                                                {res.nombreCliente}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStatusBadge(res.estado)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium text-green-600">
                                                {res.comisionAliado ? `$${Number(res.comisionAliado).toLocaleString('es-CO')}` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold">
                                                ${Number(res.precioTotal).toLocaleString('es-CO')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
