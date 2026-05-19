'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Step0SelectDestination from '@/components/reservas/wizard/Step0SelectDestination';
import ReservationWizard from '@/components/reservas/ReservationWizard';
import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

export default function TransporteMunicipalReservaPage() {
    const { language } = useLanguage();
    const router = useRouter();
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleSelectDestination = async (serviceId: string) => {
        setLoading(true);
        try {
            // Fetch full service details
            const res = await fetch(`/api/servicios/${serviceId}`);
            const data = await res.json();

            if (data.success) {
                setSelectedService(data.data);
                setSelectedServiceId(serviceId);
            } else {
                alert(language === 'es' ? 'Error al cargar el servicio' : 'Error loading service');
            }
        } catch (error) {
            console.error('Error fetching service:', error);
            alert(language === 'es' ? 'Error al cargar el servicio' : 'Error loading service');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseWizard = () => {
        setSelectedServiceId(null);
        setSelectedService(null);
    };

    const handleBackToSelection = () => {
        setSelectedServiceId(null);
        setSelectedService(null);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <FiArrowLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                                {language === 'es' ? 'Transporte Municipal' : 'Municipal Transport'}
                            </h1>
                            <p className="text-gray-600">
                                {language === 'es' 
                                    ? 'Viaja cómodamente a tu destino favorito' 
                                    : 'Travel comfortably to your favorite destination'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!selectedServiceId ? (
                    // Step 0: Select Destination
                    <Step0SelectDestination onSelectDestination={handleSelectDestination} />
                ) : loading ? (
                    // Loading state
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]"></div>
                    </div>
                ) : selectedService ? (
                    // Reservation Wizard
                    <div>
                        <button
                            onClick={handleBackToSelection}
                            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <FiArrowLeft />
                            {language === 'es' ? 'Cambiar destino' : 'Change destination'}
                        </button>
                        <ReservationWizard
                            service={selectedService}
                            isOpen={true}
                            onClose={handleCloseWizard}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}







