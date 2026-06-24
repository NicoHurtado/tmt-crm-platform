'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { FiClock, FiUsers, FiMapPin, FiChevronRight, FiChevronLeft, FiArrowRight } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import { getLocalizedText } from '@/types/multi-language';
import { categoriaDeServicio } from '@/lib/servicio-categoria';

/**
 * Catálogo de servicios unificado.
 *
 * Plantilla única usada en TODAS las vistas de reservas (pública independiente,
 * panel del aliado y página co-branded del aliado). Siempre presenta los servicios
 * agrupados en filas por categoría, en este orden fijo:
 *
 *   1. Transporte al aeropuerto
 *   2. Tours
 *   3. Tours compartidos
 *   4. Traslados
 *   5. Otros servicios (incluye la tarjeta de Transporte Municipal)
 *   6. Hoteles · Airbnbs · Agencias aliadas   (solo página pública)
 *
 * Cada fila solo se renderiza si tiene al menos un servicio habilitado. La diferencia
 * entre vistas es QUÉ servicios llegan en `services` (el aliado recibe solo los suyos),
 * no CÓMO se muestran. El orden de categorías es canónico — ya no depende de ningún
 * campo de posición por servicio.
 */

export interface CatalogService {
    id: string;
    nombre: any;
    descripcion: any;
    imagen: string;
    duracion: string | null;
    esAeropuerto: boolean;
    esPorHoras?: boolean;
    esCompartido: boolean;
    esMunicipal: boolean;
    esTraslado?: boolean;
    tipoTarifa?: 'POR_PERSONA' | null;
    preciosPorPersona?: { p1: number; p2: number; p3: number } | null;
    vehiculosPermitidos?: any[];
    [key: string]: any;
}

export interface CatalogPartner {
    id: string;
    nombre: string;
    contacto: string;
    imagen: string | null;
    tipo: 'HOTEL' | 'AIRBNB' | 'AGENCIA';
}

interface ServiceCatalogProps<T extends CatalogService> {
    services: T[];
    /** Muestra el precio "Desde $…" en la tarjeta (solo cliente final sin aliado). */
    showPrices?: boolean;
    /** Filas de aliados (solo página pública). Se omiten si no se pasan. */
    partnersHoteles?: CatalogPartner[];
    partnersAirbnbs?: CatalogPartner[];
    partnersAgencias?: CatalogPartner[];
    onSelectService: (service: T) => void;
    onSelectMunicipal: () => void;
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

export default function ServiceCatalog<T extends CatalogService>({
    services,
    showPrices = false,
    partnersHoteles = [],
    partnersAirbnbs = [],
    partnersAgencias = [],
    onSelectService,
    onSelectMunicipal,
}: ServiceCatalogProps<T>) {
    const { language } = useLanguage();

    // Separar municipales (flujo propio) de los regulares
    const serviciosMunicipales = services.filter(s => s.esMunicipal);
    const serviciosRegulares = services.filter(s => !s.esMunicipal);

    // Agrupación por categorías (lógica canónica compartida: lib/servicio-categoria).
    const serviciosAeropuerto = serviciosRegulares.filter(s => categoriaDeServicio(s) === 'AEROPUERTO');
    const serviciosTours = serviciosRegulares.filter(s => categoriaDeServicio(s) === 'TOUR_PERSONA');
    const serviciosCompartidos = serviciosRegulares.filter(s => categoriaDeServicio(s) === 'COMPARTIDO');
    const serviciosTraslados = serviciosRegulares.filter(s => categoriaDeServicio(s) === 'TRASLADO');
    const serviciosOtros = serviciosRegulares.filter(s => categoriaDeServicio(s) === 'OTRO');

    // Card sobria y minimalista de aliado: toda la card abre el WhatsApp del aliado.
    const renderPartnerCard = (partner: CatalogPartner) => {
        const numero = (partner.contacto || '').replace(/\D/g, '');
        const mensaje = encodeURIComponent(t('reservas.hoteles_mensaje', language).replace('{hotel}', partner.nombre));
        const waUrl = numero ? `https://wa.me/${numero}?text=${mensaje}` : null;

        const inner = (
            <>
                <div className="relative h-52 overflow-hidden bg-neutral-50">
                    <Image
                        src={partner.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg'}
                        alt={partner.nombre}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                        {partner.nombre}
                    </h3>
                    <p className="text-neutral-500 text-sm mb-4 flex-1">
                        {t('reservas.hoteles_descripcion', language)}
                    </p>
                    {waUrl ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 group-hover:text-[#D6A75D] transition-colors">
                            {t('reservas.partners_cta', language)}
                            <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                    ) : (
                        <span className="text-xs text-neutral-400">
                            {language === 'es' ? 'Contacto no disponible' : 'Contact unavailable'}
                        </span>
                    )}
                </div>
            </>
        );

        const cardClass = 'group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all duration-300 flex flex-col';

        return waUrl ? (
            <a
                key={partner.id}
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClass}
            >
                {inner}
            </a>
        ) : (
            <div key={partner.id} className={cardClass}>
                {inner}
            </div>
        );
    };

    // Card reutilizable de servicio (ancho fijo para el carrusel horizontal)
    const renderServiceCard = (service: T) => (
        <div
            key={service.id}
            className="group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => onSelectService(service)}
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
                    {showPrices && (() => {
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
                    <button className={`${showPrices ? '' : 'w-full'} bg-gray-100 hover:bg-[#D6A75D] text-gray-800 hover:text-black font-bold py-2 px-4 rounded-lg transition-colors`}>
                        {t('header.reservar', language)}
                    </button>
                </div>
            </div>
        </div>
    );

    // Tarjeta de Transporte Municipal (abre el modal de destinos)
    const renderMunicipalCard = () => (
        <div
            className="group w-[300px] shrink-0 snap-start bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={onSelectMunicipal}
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
    );

    return (
        <div className="space-y-10">
            {/* 1. Transporte al aeropuerto */}
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

            {/* 4. Traslados */}
            {serviciosTraslados.length > 0 && (
                <CarouselRow title={t('reservas.seccion_traslados', language)}>
                    {serviciosTraslados.map(renderServiceCard)}
                </CarouselRow>
            )}

            {/* 5. Otros servicios (incluye la tarjeta de Transporte Municipal) */}
            {(serviciosOtros.length > 0 || serviciosMunicipales.length > 0) && (
                <CarouselRow title={t('reservas.seccion_otros', language)}>
                    {serviciosOtros.map(renderServiceCard)}
                    {serviciosMunicipales.length > 0 && renderMunicipalCard()}
                </CarouselRow>
            )}

            {/* 6. Aliados (solo página pública: se pasan estas props únicamente ahí) */}
            {partnersHoteles.length > 0 && (
                <CarouselRow title={t('reservas.seccion_hoteles', language)}>
                    {partnersHoteles.map(renderPartnerCard)}
                </CarouselRow>
            )}

            {partnersAirbnbs.length > 0 && (
                <CarouselRow title={t('reservas.seccion_airbnbs', language)}>
                    {partnersAirbnbs.map(renderPartnerCard)}
                </CarouselRow>
            )}

            {partnersAgencias.length > 0 && (
                <CarouselRow title={t('reservas.seccion_agencias', language)}>
                    {partnersAgencias.map(renderPartnerCard)}
                </CarouselRow>
            )}
        </div>
    );
}
