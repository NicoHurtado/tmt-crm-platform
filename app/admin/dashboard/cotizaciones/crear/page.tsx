'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiLoader, FiChevronDown, FiChevronUp, FiMapPin } from 'react-icons/fi';
import QuoteWizard from '@/components/admin/QuoteWizard';
import { getLocalizedText } from '@/types/multi-language';

export default function CreateQuotePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [municipalExpanded, setMunicipalExpanded] = useState(false);
    const [aliados, setAliados] = useState<Array<{ id: string; nombre: string }>>([]);
    const [aliadoId, setAliadoId] = useState<string | null>(null);
    const [clientePaga, setClientePaga] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/admin/login');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchServices();
            fetchAliados();
        }
    }, [status]);

    const fetchAliados = async () => {
        try {
            const res = await fetch('/api/aliados');
            if (res.ok) {
                const data = await res.json();
                setAliados(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching aliados:', error);
        }
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/servicios');
            if (res.ok) {
                const data = await res.json();
                setServices(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectService = (service: any) => {
        setSelectedService(service);
        setWizardOpen(true);
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

    // Separar servicios municipales de otros servicios
    const municipalServices = services.filter(s => s.esMunicipal);
    const otherServices = services.filter(s => !s.esMunicipal);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Crear Cotización</h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            Crea una cotización con precio personalizado y genera un link para compartir
                        </p>
                    </div>
                </div>
            </header>

            <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
                {/* Configuración de la cotización */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Aliado selector */}
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Aliado <span className="text-gray-400">(opcional)</span>
                            </label>
                            <select
                                value={aliadoId || ''}
                                onChange={(e) => setAliadoId(e.target.value || null)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            >
                                <option value="">Sin aliado (cotización directa)</option>
                                {aliados.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* clientePaga toggle */}
                        <div className="flex items-center gap-3 sm:pt-6">
                            <label className="text-sm font-medium text-gray-700">¿El cliente paga?</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={clientePaga}
                                    onChange={(e) => setClientePaga(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-neutral-200 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                            <span className={`text-xs font-semibold ${clientePaga ? 'text-green-600' : 'text-red-600'}`}>
                                {clientePaga ? 'COBRAR' : 'NO COBRAR'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Selecciona un Servicio
                    </h2>

                    <div className="space-y-4">
                        {/* Otros Servicios (Tours, Aeropuerto, etc.) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {otherServices.map((service) => (
                                <button
                                    key={service.id}
                                    onClick={() => handleSelectService(service)}
                                    className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-[#D6A75D] hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden group-hover:ring-2 group-hover:ring-[#D6A75D] transition-all">
                                            {service.imagen && (
                                                <Image
                                                    src={service.imagen}
                                                    alt={getLocalizedText(service.nombre, 'ES')}
                                                    fill
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-[#D6A75D] transition-colors truncate">
                                                {getLocalizedText(service.nombre, 'ES')}
                                            </h3>
                                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                                                {getLocalizedText(service.descripcion, 'ES')}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Servicios Municipales Agrupados */}
                        {municipalServices.length > 0 && (
                            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                {/* Header del grupo */}
                                <button
                                    onClick={() => setMunicipalExpanded(!municipalExpanded)}
                                    className="w-full p-4 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                                            <FiMapPin className="text-blue-700 text-2xl" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                                Transporte Municipal
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {municipalServices.length} municipios disponibles
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-gray-600 group-hover:text-blue-700 transition-colors">
                                        {municipalExpanded ? (
                                            <FiChevronUp size={24} />
                                        ) : (
                                            <FiChevronDown size={24} />
                                        )}
                                    </div>
                                </button>

                                {/* Lista de municipios (expandible) */}
                                {municipalExpanded && (
                                    <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {municipalServices.map((service) => (
                                                <button
                                                    key={service.id}
                                                    onClick={() => handleSelectService(service)}
                                                    className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                                                            {service.imagen && (
                                                                <Image
                                                                    src={service.imagen}
                                                                    alt={getLocalizedText(service.nombre, 'ES')}
                                                                    fill
                                                                    style={{ objectFit: 'cover' }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-sm truncate">
                                                                {getLocalizedText(service.nombre, 'ES')}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Quote Wizard Modal */}
            {selectedService && (
                <QuoteWizard
                    service={selectedService}
                    isOpen={wizardOpen}
                    onClose={() => {
                        setWizardOpen(false);
                        setSelectedService(null);
                    }}
                    aliadoId={aliadoId}
                    clientePaga={clientePaga}
                />
            )}
        </div>
    );
}
