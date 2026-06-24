'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReservationWizard from '@/components/reservas/ReservationWizard';
import TransporteMunicipalModal from '@/components/reservas/TransporteMunicipalModal';
import ServiceCatalog from '@/components/reservas/ServiceCatalog';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { CartModal } from '@/components/carrito/CartModal';
import { useLanguage, t } from '@/lib/i18n';
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
    esTraslado: boolean;
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    adicionales: any[];
    vehiculosPermitidos?: any[];
    tipoTarifa?: 'POR_PERSONA' | null;
    preciosPorPersona?: { p1: number; p2: number; p3: number } | null;
}

interface HotelAliado {
    id: string;
    nombre: string;
    contacto: string;
    imagen: string | null;
    tipo: 'HOTEL' | 'AIRBNB';
}

export default function ReservasPage() {
    const { language } = useLanguage();
    const { aliado, ready } = useAliado();
    const router = useRouter();
    const [services, setServices] = useState<Service[]>([]);
    const [hoteles, setHoteles] = useState<HotelAliado[]>([]);
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
            fetchHoteles();
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

                setServices(activeServices as Service[]);
            } else {
                setServices((data.data || []) as Service[]);
            }
        } catch (error) {
            console.error('Error loading services:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHoteles = async () => {
        try {
            const res = await fetch('/api/aliados/hoteles');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setHoteles(data.data as HotelAliado[]);
            }
        } catch (error) {
            console.error('Error loading hoteles:', error);
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

    // Separate municipal services (handled by the municipal modal)
    const serviciosMunicipales = services.filter(s => s.esMunicipal);

    // Aliados públicos separados por tipo (solo activos — los filtra la API)
    const hotelesAliados = hoteles.filter(h => h.tipo === 'HOTEL');
    const airbnbsAliados = hoteles.filter(h => h.tipo === 'AIRBNB');

    return (
        <>
            <Header showCart onCartClick={() => setIsCartOpen(true)} />
            <main className="min-h-screen pt-32 pb-16">
                <div className="container mx-auto px-4">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            {t('reservas.titulo', language)}
                        </h1>
                        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                            {t('reservas.subtitulo', language)}
                        </p>
                    </div>

                    {/* Services Catalog — filas por categoría (carrusel horizontal) */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-xl h-96 animate-pulse shadow-sm"></div>
                            ))}
                        </div>
                    ) : (
                        <ServiceCatalog
                            services={services}
                            showPrices={!aliado}
                            partnersHoteles={!aliado ? hotelesAliados : []}
                            partnersAirbnbs={!aliado ? airbnbsAliados : []}
                            onSelectService={openWizard}
                            onSelectMunicipal={() => setMunicipalModalOpen(true)}
                        />
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
