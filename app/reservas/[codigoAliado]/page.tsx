'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiAlertCircle } from 'react-icons/fi';
import ReservationWizard from '@/components/reservas/ReservationWizard';
import TransporteMunicipalModal from '@/components/reservas/TransporteMunicipalModal';
import ServiceCatalog from '@/components/reservas/ServiceCatalog';
import AllyHeader from '@/components/landing/AllyHeader';
import AllyFooter from '@/components/landing/AllyFooter';
import { CartIcon } from '@/components/carrito/CartIcon';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { CartModal } from '@/components/carrito/CartModal';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { useLanguage, t } from '@/lib/i18n';

interface Service {
    id: string;
    nombre: string;
    tipo: string;
    descripcion: string;
    imagen: string;
    duracion: string | null;
    incluye: string[];
    precioBase: number;
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esAeropuerto: boolean;
    esPorHoras: boolean;
    esCompartido: boolean;
    esMunicipal: boolean;
    esTraslado?: boolean;
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    adicionales: any[];
    vehiculosPermitidos?: any[];
}

interface Aliado {
    id: string;
    nombre: string;
    codigo: string;
    tipo: string;
}

export default function ReservaAliadoPage() {
    const { codigoAliado } = useParams();
    const router = useRouter();
    const { language } = useLanguage();

    const [aliado, setAliado] = useState<Aliado | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [municipalModalOpen, setMunicipalModalOpen] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Custom pricing state
    const [preciosPersonalizados, setPreciosPersonalizados] = useState<any>(null);

    const validateAliado = useCallback(async (codigo: string) => {
        try {
            // 1. Validate Ally
            const res = await fetch('/api/public/aliados/validar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Código de aliado inválido');
            }

            const aliadoData = data.data;
            setAliado(aliadoData);

            // 2. Load Configuration & Services
            await Promise.all([
                fetchAliadoConfig(aliadoData.id),
                fetchServices(aliadoData.id)
            ]);

        } catch (err: any) {
            console.error('Error validating aliado:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (codigoAliado) {
            validateAliado(codigoAliado as string);
        }
    }, [codigoAliado, validateAliado]);

    const fetchAliadoConfig = async (aliadoId: string) => {
        try {
            // Fetch custom pricing
            const resServicios = await fetch(`/api/aliados/${aliadoId}/servicios`, { cache: 'no-store' });
            const dataServicios = await resServicios.json();

            // Build pricing map using new architecture: vehiculos[].precioBase
            const pricingMap: any = {};
            (dataServicios.data || []).forEach((sa: any) => {
                pricingMap[sa.servicioId] = {
                    vehiculos: sa.vehiculos || [],
                    // Night surcharge override configuration
                    sobrescribirRecargoNocturno: sa.sobrescribirRecargoNocturno,
                    aplicaRecargoNocturno: sa.aplicaRecargoNocturno,
                    recargoNocturnoInicio: sa.recargoNocturnoInicio,
                    recargoNocturnoFin: sa.recargoNocturnoFin,
                    montoRecargoNocturno: sa.montoRecargoNocturno
                };
            });
            setPreciosPersonalizados(pricingMap);

        } catch (error) {
            console.error('Error loading aliado config:', error);
        }
    };

    const fetchServices = async (aliadoId: string) => {
        try {
            const res = await fetch(`/api/aliados/${aliadoId}/servicios`, { cache: 'no-store' });
            const data = await res.json();
            console.log('API Response:', data);

            if (!data.success) {
                console.error('API Error:', data.error);
                return;
            }

            // Filter only active services — new API returns flat structure (no sa.servicio nesting)
            const activeServices = (data.data || [])
                .filter((sa: any) => sa.activo)
                .map((sa: any) => {
                    // Destructure aliado-specific fields, spread remaining service fields
                    const { servicioId, activo, tipoComision, comisionValor, vehiculos, ...serviceFields } = sa;
                    return serviceFields;
                });

            setServices(activeServices as Service[]);
        } catch (error) {
            console.error('Error loading services:', error);
        }
    };

    const openWizard = (service: Service) => {
        setSelectedService(service);
        setWizardOpen(true);
    };

    const handleSelectMunicipalService = async (serviceId: string) => {
        try {
            const res = await fetch(`/api/servicios/${serviceId}`);
            const data = await res.json();

            if (data.success) {
                openWizard(data.data);
            }
        } catch (error) {
            console.error('Error loading service:', error);
        }
    };

    // Municipal services (handled by the municipal modal)
    const serviciosMunicipales = services.filter(s => s.esMunicipal);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiAlertCircle size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {language === 'en' ? 'Invalid Link' : 'Enlace no válido'}
                    </h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-[#D6A75D] text-black font-bold py-3 px-6 rounded-lg hover:bg-[#C5964A] transition-colors w-full"
                    >
                        {language === 'en' ? 'Go to Home' : 'Ir al inicio'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <AllyHeader allyName={aliado?.nombre || ''} allyType={aliado?.tipo}>
                <LanguageSwitcher />
                <CartIcon onClick={() => setIsCartOpen(true)} />
            </AllyHeader>
            <main className="min-h-screen pt-24 pb-16 bg-gray-50">
                <div className="container mx-auto px-4">
                    {/* Partner Header */}
                    <div className="text-center mb-10">
                        <p className="text-xs font-semibold text-[#D6A75D] uppercase tracking-widest mb-3">{t('header.portal_exclusivo', language)}</p>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                            {aliado?.nombre}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {t('hotel.servicios_exclusivos', language)}
                        </p>
                    </div>

                    {/* Services Catalog — plantilla unificada por categorías */}
                    {services.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">{t('hotel.no_servicios', language)}</p>
                        </div>
                    ) : (
                        <ServiceCatalog
                            services={services}
                            onSelectService={openWizard}
                            onSelectMunicipal={() => setMunicipalModalOpen(true)}
                        />
                    )}
                </div>
            </main>
            <AllyFooter />
            <WhatsAppButton />

            {/* Cart Modal */}
            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />

            {/* Modal Transporte Municipal */}
            <TransporteMunicipalModal
                isOpen={municipalModalOpen}
                onClose={() => setMunicipalModalOpen(false)}
                onSelectService={handleSelectMunicipalService}
                serviciosMunicipales={serviciosMunicipales}
            />

            {/* Reservation Wizard Modal */}
            {selectedService && (
                <ReservationWizard
                    service={selectedService}
                    isOpen={wizardOpen}
                    onClose={() => {
                        setWizardOpen(false);
                        setSelectedService(null);
                    }}
                    aliadoId={aliado?.id || null}
                    aliadoTipo={aliado?.tipo || null}
                    aliadoNombre={aliado?.nombre || null}
                    preciosPersonalizados={preciosPersonalizados}
                    isStaffFlow={false}
                />
            )}
        </>
    );
}
