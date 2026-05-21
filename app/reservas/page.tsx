'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FiClock, FiUsers, FiMapPin, FiChevronRight } from 'react-icons/fi';
import ReservationWizard from '@/components/reservas/ReservationWizard';
import TransporteMunicipalModal from '@/components/reservas/TransporteMunicipalModal';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { CartIcon } from '@/components/carrito/CartIcon';
import { CartModal } from '@/components/carrito/CartModal';
import { useLanguage, t } from '@/lib/i18n';
import { getLocalizedText, getLocalizedArray } from '@/types/multi-language';
import { sortServicesByPriority } from '@/lib/service-order';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import { useAliado } from '@/lib/hooks/useAliado';

interface Service {
    id: string;
    nombre: string;
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
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    adicionales: any[];
    vehiculosPermitidos?: any[];
}

export default function ReservasPage() {
    const { language } = useLanguage();
    const { aliado, ready } = useAliado();
    const router = useRouter();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [municipalModalOpen, setMunicipalModalOpen] = useState(false);

    // Custom pricing state
    const [preciosPersonalizados, setPreciosPersonalizados] = useState<any>(null);

    // Cart state
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [openedFromQuery, setOpenedFromQuery] = useState(false);
    const [wizardInitialStep, setWizardInitialStep] = useState(0);
    const [urlParams, setUrlParams] = useState<URLSearchParams | null>(null);

    // Redirect aliados to their staff panel — /reservas is public-only
    useEffect(() => {
        if (!ready) return;
        if (aliado?.codigo) {
            router.replace(`/panel/aliado/${aliado.codigo}`);
        }
    }, [aliado, ready, router]);

    // Track previous aliado to detect changes
    const prevAliadoIdRef = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (!ready) return;
        if (aliado) return; // Will be redirected by the effect above
        const currentId = null;
        if (prevAliadoIdRef.current === undefined) {
            prevAliadoIdRef.current = currentId;
            fetchServices();
            return;
        }
        if (prevAliadoIdRef.current === currentId) return;
        prevAliadoIdRef.current = currentId;
        setPreciosPersonalizados(null);
        setLoading(true);
        fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setUrlParams(new URLSearchParams(window.location.search));
    }, []);

    useEffect(() => {
        if (loading || openedFromQuery || services.length === 0) return;
        if (!urlParams) return;

        const serviceIdParam = urlParams.get('serviceId');
        const tipoParam = urlParams.get('tipo')?.toUpperCase();
        let servicioParamRaw = urlParams.get('servicio');
        const servicioParam = servicioParamRaw?.toLowerCase();

        // Compatibilidad con QR/lectores que convierten "?servicio=aeropuerto" en "?servicio:aeropuerto"
        if (!servicioParamRaw) {
            urlParams.forEach((value, key) => {
                if (key.toLowerCase().startsWith('servicio:')) {
                    servicioParamRaw = key.split(':').slice(1).join(':') || value;
                }
            });
        }
        const servicioParamSafe = servicioParamRaw?.toLowerCase();

        let targetService: Service | undefined;

        if (serviceIdParam) {
            targetService = services.find((s) => s.id === serviceIdParam);
        }

        if (!targetService && tipoParam) {
            // Backward compatibility with old tipo-based links — uses flags only
            if (tipoParam.includes('AEROPUERTO')) {
                targetService = services.find((s) => s.esAeropuerto);
            } else if (tipoParam.includes('TOUR_COMPARTIDO') || tipoParam.includes('COMPARTIDO')) {
                targetService = services.find((s) => s.esCompartido);
            } else if (tipoParam.includes('MUNICIPAL')) {
                targetService = services.find((s) => s.esMunicipal);
            } else if (tipoParam.includes('HORAS')) {
                targetService = services.find((s) => s.esPorHoras);
            }
        }

        if (!targetService && servicioParamRaw) {
            // Try exact service ID match first
            targetService = services.find((s) => s.id === servicioParamRaw);
        }

        if (!targetService && servicioParamSafe) {
            // Legacy slug compatibility — resolved by flags, never by name substring
            const slugAeropuerto = ['aeropuerto', 'transporte-aeropuerto', 'traslado-aeropuerto'].includes(servicioParamSafe);
            const slugCompartido = ['tour-compartido', 'compartido', 'guatape'].includes(servicioParamSafe);
            const slugMunicipal = ['municipal', 'transporte-municipal'].includes(servicioParamSafe);
            const slugHoras = ['horas', 'por-horas'].includes(servicioParamSafe);

            if (slugAeropuerto) {
                targetService = services.find((s) => s.esAeropuerto);
            } else if (slugCompartido) {
                targetService = services.find((s) => s.esCompartido);
            } else if (slugMunicipal) {
                targetService = services.find((s) => s.esMunicipal);
            } else if (slugHoras) {
                targetService = services.find((s) => s.esPorHoras);
            }
        }

        if (targetService) {
            const formParam = urlParams.get('form');
            const shouldOpenDirectForm = formParam === '1' || formParam === 'true';
            setWizardInitialStep(shouldOpenDirectForm ? 1 : 0);
            setSelectedService(targetService);
            setWizardOpen(true);
            setOpenedFromQuery(true);
        }
    }, [loading, openedFromQuery, services, urlParams]);

    const fetchServices = async (aliadoId?: string) => {
        try {
            let url = '/api/servicios';

            // If aliado is logged in, fetch only their active services
            if (aliadoId) {
                url = `/api/aliados/${aliadoId}/servicios`;
            }

            const res = await fetch(url);
            const data = await res.json();

            if (aliadoId) {
                // Filter only active services — new API returns flat structure (no sa.servicio nesting)
                const activeServices = (data.data || [])
                    .filter((sa: any) => sa.activo)
                    .map((sa: any) => {
                        const { servicioId, activo, tipoComision, comisionValor, vehiculos, ...serviceFields } = sa;
                        return serviceFields;
                    });

                // Sort services using custom priority order
                const sortedServices = sortServicesByPriority(activeServices) as Service[];
                setServices(sortedServices);
            } else {
                console.log('[Public] Services data:', data.data);
                if (data.data && data.data.length > 0) {
                    console.log('[Public] First service vehicles:', data.data[0].vehiculosPermitidos);
                }
                // Sort services using custom priority order
                const sortedServices = sortServicesByPriority(data.data || []) as Service[];
                setServices(sortedServices);
            }
        } catch (error) {
            console.error('Error loading services:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAliadoConfig = async (aliadoId: string) => {
        try {
            // Fetch custom pricing
            const resServicios = await fetch(`/api/aliados/${aliadoId}/servicios`);
            const dataServicios = await resServicios.json();

            // Build pricing map with vehicle prices and night surcharge config
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

    // Separate municipal and regular services
    const serviciosMunicipales = services.filter(s => s.esMunicipal);
    const serviciosRegulares = services.filter(s => !s.esMunicipal);

    return (
        <>
            <Header />
            <main className="min-h-screen pt-32 pb-16">
                <div className="container mx-auto px-4">
                    {/* Cart Icon - Floating */}
                    <div className="fixed top-24 right-6 z-30">
                        <CartIcon onClick={() => setIsCartOpen(true)} />
                    </div>

                    {/* Page Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            {t('reservas.titulo', language)}
                        </h1>
                        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                            {t('reservas.subtitulo', language)}
                        </p>
                    </div>


                    {/* Services Catalog */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-xl h-96 animate-pulse shadow-sm"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Servicios Prioritarios (Priority 1-8) */}
                            {serviciosRegulares
                                .map((service) => (
                                    <div
                                        key={service.id}
                                        className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                                        onClick={() => openWizard(service)}
                                    >
                                        <div className="relative h-56 overflow-hidden">
                                            <Image
                                                src={service.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg'}
                                                alt={getLocalizedText(service.nombre, language)}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>

                                        <div className="p-6">
                                            <h3 className="text-xl font-bold mb-3 group-hover:text-[#D6A75D] transition-colors">
                                                {getLocalizedText(service.nombre, language)}
                                            </h3>
                                            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                                {getLocalizedText(service.descripcion, language)}
                                            </p>

                                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                                {service.duracion && (
                                                    <div className="flex items-center gap-1">
                                                        <FiClock className="text-[#D6A75D]" />
                                                        <span>{service.duracion}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    <FiUsers className="text-[#D6A75D]" />
                                                    <span>{t('landing.privado', language)}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                {!aliado && (
                                                    <div>
                                                        <p className="text-sm text-gray-500">{t('reservas.desde', language)}</p>
                                                        <p className="text-2xl font-bold text-[#D6A75D]">
                                                            ${Number(service.precioBase).toLocaleString('es-CO')}
                                                        </p>
                                                    </div>
                                                )}
                                                <button className={`${aliado ? 'w-full' : ''} bg-gray-100 hover:bg-[#D6A75D] text-gray-800 hover:text-black font-bold py-2 px-4 rounded-lg transition-colors`}>
                                                    {t('header.reservar', language)}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                            {/* Tarjeta Transporte Municipal - DESPUÉS DE SERVICIOS PRIORITARIOS */}
                            {serviciosMunicipales.length > 0 && (
                                <div
                                    className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                                    onClick={() => setMunicipalModalOpen(true)}
                                >
                                    <div className="relative h-56 overflow-hidden">
                                        <Image
                                            src={serviciosMunicipales[0]?.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368600/tmt/servicios/epyidj9zt9icdjxwi3ed.jpg'}
                                            alt={language === 'es' ? 'Transporte Municipal Antioquia' : 'Antioquia Municipal Transport'}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                    </div>

                                    <div className="p-6">
                                        <h3 className="text-xl font-bold mb-3 group-hover:text-[#D6A75D] transition-colors">
                                            {language === 'es' ? 'Transporte Municipal' : 'Municipal Transport'}
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                            {language === 'es'
                                                ? `${serviciosMunicipales.length} destino${serviciosMunicipales.length !== 1 ? 's' : ''} disponible${serviciosMunicipales.length !== 1 ? 's' : ''}`
                                                : `${serviciosMunicipales.length} destination${serviciosMunicipales.length !== 1 ? 's' : ''} available`}
                                        </p>

                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                            <div className="flex items-center gap-1">
                                                <FiMapPin className="text-[#D6A75D]" />
                                                <span>{language === 'es' ? 'Múltiples destinos' : 'Multiple destinations'}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <FiUsers className="text-[#D6A75D]" />
                                                <span>{t('landing.privado', language)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <button className="bg-gray-100 hover:bg-[#D6A75D] text-gray-800 hover:text-black font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
                                                {language === 'es' ? 'Ver Destinos' : 'View Destinations'}
                                                <FiChevronRight />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Footer />

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
                    initialStep={wizardInitialStep}
                    onClose={() => {
                        setWizardOpen(false);
                        setSelectedService(null);
                    }}
                    aliadoId={aliado?.id || null}
                    aliadoTipo={aliado?.tipo || null}
                    aliadoNombre={aliado?.nombre || null}
                    preciosPersonalizados={preciosPersonalizados}
                />
            )}

            {/* Cart Modal */}
            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />

            {/* WhatsApp Floating Button */}
            <WhatsAppButton />
        </>
    );
}
