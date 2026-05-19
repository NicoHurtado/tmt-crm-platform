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

export default function ServicesGrid() {
    const { language } = useLanguage();
    const [servicios, setServicios] = useState<Servicio[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServicios = async () => {
            try {
                const res = await fetch('/api/servicios');
                const data = await res.json();
                if (data.data) {
                    // Filter only active services if needed, though API should handle it
                    setServicios(data.data.slice(0, 6)); // Limit to 6 for landing
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
            <section id="servicios" className="py-20 bg-gray-50">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            {t('landing.servicios_titulo', language)}
                        </h2>
                        <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl h-96 animate-pulse shadow-sm"></div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="servicios" className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t('landing.servicios_titulo', language)}
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        {t('landing.servicios_subtitulo', language)}
                    </p>
                    <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full mt-6"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {servicios.map((servicio) => (
                        <Link
                            key={servicio.id}
                            href={`/reservas?servicio=${servicio.id}`}
                            className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer block"
                        >
                            <div className="relative h-56 overflow-hidden">
                                <Image
                                    src={servicio.imagen || '/medellin.jpg'}
                                    alt={getLocalizedText(servicio.nombre, language)}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            </div>

                            <div className="p-6">
                                <h3 className="text-xl font-bold mb-3 group-hover:text-[#D6A75D] transition-colors">
                                    {getLocalizedText(servicio.nombre, language)}
                                </h3>
                                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                    {servicio.descripcionCorta ? getLocalizedText(servicio.descripcionCorta, language) :
                                        servicio.descripcion ? getLocalizedText(servicio.descripcion, language) :
                                            t('landing.experiencia_unica', language)}
                                </p>

                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
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

                                <div className="w-full text-center bg-gray-100 group-hover:bg-[#D6A75D] text-gray-800 group-hover:text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                                    {t('header.reservar', language)} <FiArrowRight />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
