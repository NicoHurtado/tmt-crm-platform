'use client';

import { useLanguage, t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { FiStar } from 'react-icons/fi';

export default function Testimonials() {
    const { language } = useLanguage();
    const [testimonials, setTestimonials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTestimonials() {
            try {
                const res = await fetch('/api/calificaciones/destacadas');
                if (res.ok) {
                    const data = await res.json();
                    setTestimonials(data.data || []);
                }
            } catch (error) {
                console.error('Error fetching testimonials:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchTestimonials();
    }, []);

    const renderStars = (estrellas: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <FiStar
                key={i}
                className={`inline ${i < estrellas ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                size={20}
            />
        ));
    };

    const getServiceName = (servicio: any) => {
        if (!servicio?.nombre) return '';
        if (typeof servicio.nombre === 'string') return servicio.nombre;
        return servicio.nombre[language.toLowerCase()] || servicio.nombre['es'] || servicio.nombre['en'] || '';
    };

    return (
        <section id="testimonios" className="py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t('landing.testimonios_titulo', language)}
                    </h2>
                    <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full"></div>
                </div>

                {loading ? (
                    <div className="text-center text-gray-500">
                        <p className="text-lg">{language === 'es' ? 'Cargando testimonios...' : 'Loading testimonials...'}</p>
                    </div>
                ) : testimonials.length === 0 ? (
                    <div className="text-center text-gray-500">
                        <p className="text-lg font-medium">
                            {t('landing.testimonios_proximamente', language)}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {testimonials.map((testimonial) => (
                            <div
                                key={testimonial.id}
                                className="bg-gray-50 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-[#D6A75D]"
                            >
                                {/* Stars */}
                                <div className="flex gap-1 mb-4">
                                    {renderStars(testimonial.estrellas)}
                                </div>

                                {/* Comment */}
                                <p className="text-gray-700 mb-4 italic line-clamp-4">
                                    &quot;{testimonial.comentario || (language === 'es' ? 'Excelente servicio' : 'Excellent service')}&quot;
                                </p>

                                {/* Customer Info */}
                                <div className="border-t pt-4">
                                    <p className="font-bold text-gray-900">{testimonial.nombreCliente}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
