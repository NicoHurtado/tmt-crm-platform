'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiClock, FiUsers, FiArrowRight } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import { getLocalizedText } from '@/types/multi-language';

interface Servicio {
    id: string;
    nombre: string;
    descripcionCorta: string | null;
    descripcion: string | null;
    imagen: string | null;
    duracion: string | null;
    precioBase: number;
}

export default function ServicesCarousel() {
    const { language } = useLanguage();
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServicios = async () => {
            try {
                const res = await fetch('/api/servicios');
                const data = await res.json();
                if (data.data) {
                    setServicios(data.data);
                }
            } catch (error) {
                console.error('Error loading services:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchServicios();
    }, []);

    if (loading) {
        return (
            <section id="servicios" className="py-20 bg-gray-50 overflow-hidden">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            {t('landing.servicios_titulo', language)} (Carousel)
                        </h2>
                        <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full"></div>
                    </div>
                    <div className="flex gap-8 overflow-hidden">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="min-w-[350px] bg-white rounded-xl h-96 animate-pulse shadow-sm"></div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="servicios" className="py-20 bg-gray-50 overflow-hidden">
            <div className="container mx-auto px-4 mb-12">
                <div className="text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t('landing.servicios_titulo', language)} (Carousel)
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        {t('landing.servicios_subtitulo', language)}
                    </p>
                    <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full mt-6"></div>
                </div>
            </div>

            <div className="relative w-full">
                {/* Gradient masks for smooth fade effect */}
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50 to-transparent z-10"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50 to-transparent z-10"></div>

                {/* Marquee Container */}
                <div className="flex w-full overflow-hidden group">
                    {/* First set of items */}
                    <div className="flex animate-marquee group-hover:[animation-play-state:paused] py-4">
                        {servicios.slice(0, 15).map((servicio) => (
                            <ServiceCard key={`a-${servicio.id}`} servicio={servicio} language={language} />
                        ))}
                        <MoreServicesCard language={language} totalServices={servicios.length} />
                    </div>
                    {/* Second set of items for seamless loop */}
                    <div className="flex animate-marquee group-hover:[animation-play-state:paused] py-4" aria-hidden="true">
                        {servicios.slice(0, 15).map((servicio) => (
                            <ServiceCard key={`b-${servicio.id}`} servicio={servicio} language={language} />
                        ))}
                        <MoreServicesCard language={language} totalServices={servicios.length} />
                    </div>
                </div>
            </div>
        </section>
    );
}

function ServiceCard({ servicio, language }: { servicio: Servicio; language: 'es' | 'en' }) {
    return (
        <div className="w-[350px] mx-4 flex-shrink-0">
            <Link
                href={`/reservas?servicio=${servicio.id}`}
                className="group/card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer block h-full flex flex-col"
            >
                <div className="relative h-56 overflow-hidden flex-shrink-0">
                    <Image
                        src={servicio.imagen || '/medellin.jpg'}
                        alt={getLocalizedText(servicio.nombre, language)}
                        fill
                        className="object-cover transition-transform duration-500 group-hover/card:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
                </div>

                <div className="p-6 flex flex-col flex-grow">
                    <h3 className="text-xl font-bold mb-3 group-hover/card:text-[#D6A75D] transition-colors line-clamp-1">
                        {getLocalizedText(servicio.nombre, language)}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">
                        {servicio.descripcionCorta ? getLocalizedText(servicio.descripcionCorta, language) :
                            servicio.descripcion ? getLocalizedText(servicio.descripcion, language) :
                                t('landing.experiencia_unica', language)}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-6 mt-auto">
                        {servicio.duracion && (
                            <div className="flex items-center gap-1">
                                <FiClock className="text-[#D6A75D]" />
                                <span>{servicio.duracion}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <FiUsers className="text-[#D6A75D]" />
                            <span>{t('landing.privado', language)}</span>
                        </div>
                    </div>

                    <div className="w-full text-center bg-gray-100 group-hover/card:bg-[#D6A75D] text-gray-800 group-hover/card:text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                        {t('header.reservar', language)} <FiArrowRight />
                    </div>
                </div>
            </Link>
        </div>
    );
}

function MoreServicesCard({ language, totalServices }: { language: 'es' | 'en'; totalServices: number }) {
    return (
        <div className="w-[350px] mx-4 flex-shrink-0">
            <Link
                href="/reservas"
                className="group/card bg-gradient-to-br from-[#D6A75D] to-[#B8894A] rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer block h-full flex flex-col"
            >
                <div className="relative h-56 overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#D6A75D]/20 to-[#B8894A]/20 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl font-bold text-white mb-2">+{totalServices - 15}</div>
                        <div className="text-xl text-white/90 font-semibold">
                            {language === 'es' ? 'Destinos' : 'Destinations'}
                        </div>
                    </div>
                </div>

                <div className="p-6 flex flex-col flex-grow justify-center items-center text-center">
                    <h3 className="text-2xl font-bold mb-3 text-white">
                        {language === 'es' ? '¡Muchos Más!' : 'Many More!'}
                    </h3>
                    <p className="text-white/90 text-sm mb-6 flex-grow">
                        {language === 'es'
                            ? 'Descubre todos nuestros destinos y experiencias increíbles en Antioquia'
                            : 'Discover all our destinations and incredible experiences in Antioquia'}
                    </p>

                    <div className="w-full text-center bg-white text-[#D6A75D] font-bold py-3 rounded-lg transition-all group-hover/card:bg-white/90 flex items-center justify-center gap-2">
                        {language === 'es' ? 'Ver Todos' : 'View All'} <FiArrowRight />
                    </div>
                </div>
            </Link>
        </div>
    );
}
