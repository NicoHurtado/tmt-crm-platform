'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FiLoader, FiMapPin } from 'react-icons/fi';
import TourCompartidoView from '@/components/admin/TourCompartidoView';

export default function AdminTourCompartidoPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [allReservas, setAllReservas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/admin/login');
        }
    }, [status, router]);

    useEffect(() => {
        async function fetchReservas() {
            setLoading(true);
            try {
                const res = await fetch('/api/reservas');
                if (res.ok) {
                    const data = await res.json();
                    setAllReservas(data.data || []);
                }
            } catch (error) {
                console.error('Error fetching reservas de tour compartido:', error);
            } finally {
                setLoading(false);
            }
        }

        if (status === 'authenticated') {
            fetchReservas();
        }
    }, [status]);

    const tourCompartidoReservas = useMemo(
        () => allReservas.filter((r) => r.servicio?.esCompartido),
        [allReservas]
    );

    const handleReservationDeleted = (reservationId: string) => {
        setAllReservas((prev) => prev.filter((r) => r.id !== reservationId));
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <FiLoader className="animate-spin text-4xl text-[#D6A75D]" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FiMapPin className="text-[#D6A75D]" />
                                Tour Compartido
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                Vista agrupada por fecha
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <TourCompartidoView
                    reservas={tourCompartidoReservas as any}
                    onReservationDeleted={handleReservationDeleted}
                />
            </main>
        </div>
    );
}
