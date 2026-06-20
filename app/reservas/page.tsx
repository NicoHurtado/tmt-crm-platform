'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FiClock, FiUsers, FiMapPin, FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import ReservationWizard from '@/components/reservas/ReservationWizard';
import TransporteMunicipalModal from '@/components/reservas/TransporteMunicipalModal';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
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
    tipoTarifa?: 'POR_PERSONA' | null;
    preciosPorPersona?: { p1: number; p2: number; p3: number } | null;
}

interface HotelAliado {
    id: string;
    nombre: string;
    contacto: string;
    imagen: string | null;
}

// Fila horizontal por categoría (carrusel). Muestra título + flechas + scroll horizontal.
function CarouselRow({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const scroll = (dir: number) => scrollerRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
    return (
        <section>
            <div className="flex items-center gap-3 mb-4 mt-2">
                <h2 className="text-2xl font-bold text-gray-900 whitespace-nowrap">{title}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-[#D6A75D]/40 to-transparent" />
                <div className="hidden md:flex gap-2">
                    <button
                        onClick={() => scroll(-1)}
                        aria-label="Anterior"
                        className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-[#D6A75D] hover:text-[#D6A75D] flex items-center justify-center transition-colors"
                    >
                        <FiChevronLeft />
                    </button>
                    <button
                        onClick={() => scroll(1)}
                        aria-label="Siguiente"
                        className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-[#D6A75D] hover:text-[#D6A75D] flex items-center justify-center transition-colors"
                    >
                        <FiChevronRight />
                    </button>
                </div>
            </div>
            <div
                ref={scrollerRef}
                className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory no-scrollbar -mx-1 px-1"
            >
                {children}
            </div>
        </section>
    );
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

    // Separate municipal and regular services
    const serviciosMunicipales = services.filter(s => s.esMunicipal);
    const serviciosRegulares = services.filter(s => !s.esMunicipal);

    // Agrupación por categorías para una página ordenada y fácil de escanear.
    const serviciosAeropuerto = serviciosRegulares.filter(s => s.esAeropuerto);
    const serviciosTours = serviciosRegulares.filter(s => !s.esAeropuerto && s.tipoTarifa === 'POR_PERSONA');
    const serviciosCompartidos = serviciosRegulares.filter(s => !s.esAeropuerto && s.tipoTarifa !== 'POR_PERSONA' && s.esCompartido);
    const serviciosOtros = serviciosRegulares.filter(s => !s.esAeropuerto && s.tipoTarifa !== 'POR_PERSONA' && !s.esCompartido);

    // Card reutilizable de servicio (ancho fijo para el carrusel horizontal)
    const renderServiceCard = (service: Service) => (
        <div
            key={service.id}
            className="group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
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
                    {!aliado && (() => {
                        // Tours con precio por persona: mostrar "Desde $p1 por persona"
                        if (service.tipoTarifa === 'POR_PERSONA' && service.preciosPorPersona) {
                            const p1 = Number(service.preciosPorPersona.p1 ?? 0);
                            if (p1 <= 0) return <div />;
                            return (
                                <div>
                                    <p className="text-sm text-gray-500">{t('reservas.desde', language)}</p>
                                    <p className="text-2xl font-bold text-[#D6A75D]">
                                        ${p1.toLocaleString('es-CO')}
                                        <span className="text-sm font-medium text-gray-500"> / {language === 'es' ? 'persona' : 'person'}</span>
                                    </p>
                                </div>
                            );
                        }
                        const precios = (service.vehiculosPermitidos || [])
                            .map((sv: any) => Number(sv.precio ?? 0))
                            .filter((p: number) => p > 0);
                        if (precios.length === 0) return <div />;
                        return (
                            <div>
                                <p className="text-sm text-gray-500">{t('reservas.desde', language)}</p>
                                <p className="text-2xl font-bold text-[#D6A75D]">
                                    ${Math.min(...precios).toLocaleString('es-CO')}
                                </p>
                            </div>
                        );
                    })()}
                    <button className={`${aliado ? 'w-full' : ''} bg-gray-100 hover:bg-[#D6A75D] text-gray-800 hover:text-black font-bold py-2 px-4 rounded-lg transition-colors`}>
                        {t('header.reservar', language)}
                    </button>
                </div>
            </div>
        </div>
    );

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
                        <div className="space-y-10">
                            {/* 1. Transporte al aeropuerto (lo más usado) */}
                            {serviciosAeropuerto.length > 0 && (
                                <CarouselRow title={t('reservas.seccion_aeropuerto', language)}>
                                    {serviciosAeropuerto.map(renderServiceCard)}
                                </CarouselRow>
                            )}

                            {/* 2. Tours */}
                            {serviciosTours.length > 0 && (
                                <CarouselRow title={t('reservas.seccion_tours', language)}>
                                    {serviciosTours.map(renderServiceCard)}
                                </CarouselRow>
                            )}

                            {/* 3. Tours compartidos */}
                            {serviciosCompartidos.length > 0 && (
                                <CarouselRow title={t('reservas.seccion_compartidos', language)}>
                                    {serviciosCompartidos.map(renderServiceCard)}
                                </CarouselRow>
                            )}

                            {/* 4. Demás servicios (incluye tarjeta de Transporte Municipal) */}
                            {(serviciosOtros.length > 0 || serviciosMunicipales.length > 0) && (
                                <CarouselRow title={t('reservas.seccion_otros', language)}>
                                    {serviciosOtros.map(renderServiceCard)}

                                    {/* Tarjeta Transporte Municipal */}
                                    {serviciosMunicipales.length > 0 && (
                                        <div
                                            className="group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
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
                                </CarouselRow>
                            )}

                            {/* 5. Hoteles aliados (solo página pública) */}
                            {!aliado && hoteles.length > 0 && (
                                <CarouselRow title={t('reservas.seccion_hoteles', language)}>
                                    {hoteles.map((hotel) => {
                                            const numero = (hotel.contacto || '').replace(/\D/g, '');
                                            const mensaje = encodeURIComponent(t('reservas.hoteles_mensaje', language).replace('{hotel}', hotel.nombre));
                                            const waUrl = numero ? `https://wa.me/${numero}?text=${mensaje}` : null;
                                            return (
                                                <div
                                                    key={hotel.id}
                                                    className="group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
                                                >
                                                    <div className="relative h-56 overflow-hidden bg-gray-100">
                                                        <Image
                                                            src={hotel.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg'}
                                                            alt={hotel.nombre}
                                                            fill
                                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                        />
                                                    </div>
                                                    <div className="p-6 flex-1 flex flex-col">
                                                        <h3 className="text-xl font-bold mb-2 group-hover:text-[#D6A75D] transition-colors">
                                                            {hotel.nombre}
                                                        </h3>
                                                        <p className="text-gray-600 text-sm mb-4 flex-1">
                                                            {t('reservas.hoteles_descripcion', language)}
                                                        </p>
                                                        {waUrl ? (
                                                            <a
                                                                href={waUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
                                                            >
                                                                <FaWhatsapp className="text-lg" />
                                                                {t('reservas.hoteles_boton', language)}
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">
                                                                {language === 'es' ? 'Contacto no disponible' : 'Contact unavailable'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </CarouselRow>
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
