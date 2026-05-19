'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiStar, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const DICTIONARY = {
    ES: {
        title: '¡Gracias por Elegirnos!',
        subtitle: 'Tu opinión es muy importante para nosotros',
        experiencia: '¿Cómo fue tu experiencia?',
        selectRating: 'Selecciona tu calificación',
        comentarioLabel: 'Cuéntanos más (opcional)',
        comentarioPlaceholder: 'Cuéntanos más sobre tu experiencia...',
        enviar: 'Enviar Calificación',
        enviando: 'Enviando...',
        gracias: '¡Gracias por tu calificación!',
        mensajeExito: 'Tu opinión nos ayuda a mejorar continuamente',
        volverInicio: 'Volver al inicio',
        reservaNoEncontrada: 'Reserva no encontrada',
        reservaNoCompletada: 'Esta reserva aún no ha sido completada',
        yaCalificada: 'Ya has calificado este servicio',
        errorGeneral: 'Ocurrió un error al cargar la información',
        cargando: 'Cargando...',
        servicio: 'Servicio',
        fecha: 'Fecha',
        codigo: 'Código de Reserva'
    },
    EN: {
        title: 'Thank You for Choosing Us!',
        subtitle: 'Your opinion is very important to us',
        experiencia: 'How was your experience?',
        selectRating: 'Select your rating',
        comentarioLabel: 'Tell us more (optional)',
        comentarioPlaceholder: 'Tell us more about your experience...',
        enviar: 'Submit Rating',
        enviando: 'Sending...',
        gracias: 'Thank you for your rating!',
        mensajeExito: 'Your feedback helps us continuously improve',
        volverInicio: 'Back to home',
        reservaNoEncontrada: 'Reservation not found',
        reservaNoCompletada: 'This reservation has not been completed yet',
        yaCalificada: 'You have already rated this service',
        errorGeneral: 'An error occurred while loading the information',
        cargando: 'Loading...',
        servicio: 'Service',
        fecha: 'Date',
        codigo: 'Reservation Code'
    }
};

export default function RatePage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [reserva, setReserva] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        async function fetchReserva() {
            try {
                const res = await fetch(`/api/reservas/by-id/${params.id}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError('NOT_FOUND');
                    } else {
                        setError('GENERAL');
                    }
                    return;
                }
                const data = await res.json();

                // Check if already rated
                if (data.calificacion) {
                    setError('ALREADY_RATED');
                    return;
                }

                // Check if completed
                if (data.estado !== 'COMPLETED') {
                    setError('NOT_COMPLETED');
                    return;
                }

                setReserva(data);
            } catch (err) {
                console.error('Error fetching reserva:', err);
                setError('GENERAL');
            } finally {
                setLoading(false);
            }
        }
        fetchReserva();
    }, [params.id]);

    const handleSubmit = async () => {
        if (rating === 0) {
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/calificaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservaId: reserva.id,
                    servicioId: reserva.servicioId,
                    estrellas: rating,
                    comentario: comment.trim() || null,
                    nombreCliente: reserva.nombreCliente,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al enviar calificación');
            }

            setSubmitted(true);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Determine language
    const lang = (reserva?.idioma === 'EN' ? 'EN' : 'ES') as keyof typeof DICTIONARY;
    const t = DICTIONARY[lang];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <FiLoader className="animate-spin text-4xl text-[#D6A75D] mx-auto mb-4" />
                    <p className="text-gray-600">{DICTIONARY.ES.cargando}</p>
                </div>
            </div>
        );
    }

    if (error) {
        const errorMessages = {
            NOT_FOUND: t.reservaNoEncontrada,
            NOT_COMPLETED: t.reservaNoCompletada,
            ALREADY_RATED: t.yaCalificada,
            GENERAL: t.errorGeneral
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 max-w-md">
                    <FiAlertCircle className="text-5xl text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-4">{errorMessages[error as keyof typeof errorMessages]}</h1>
                    <a href="/" className="text-[#D6A75D] hover:underline font-semibold">
                        {t.volverInicio}
                    </a>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 max-w-md">
                    <FiCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold mb-2">{t.gracias}</h1>
                    <p className="text-gray-600 mb-6">{t.mensajeExito}</p>
                    <a
                        href="/"
                        className="inline-block bg-[#D6A75D] hover:bg-[#C09650] text-white font-bold py-3 px-8 rounded-lg transition-all"
                    >
                        {t.volverInicio}
                    </a>
                </div>
            </div>
        );
    }

    // Get service name
    const serviceName = (() => {
        const nombre = reserva.servicio?.nombre;
        if (!nombre) return 'N/A';
        if (typeof nombre === 'string') return nombre;
        return nombre[lang.toLowerCase()] || nombre['es'] || nombre['en'] || 'Servicio';
    })();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-black text-white py-6 shadow-lg">
                <div className="container mx-auto px-4">
                    <h1 className="text-2xl md:text-3xl font-bold">Transportes Medellín Travel</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-12 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    {/* Title */}
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold mb-2">{t.title} ⭐</h2>
                        <p className="text-gray-600">{t.subtitle}</p>
                    </div>

                    {/* Reservation Info */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-gray-600">{t.codigo}</p>
                                <p className="font-semibold text-[#D6A75D]">{reserva.codigo}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">{t.servicio}</p>
                                <p className="font-semibold">{serviceName}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-gray-600">{t.fecha}</p>
                                <p className="font-semibold">
                                    {new Date(reserva.fecha).toLocaleDateString(lang === 'EN' ? 'en-US' : 'es-CO', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })} - {reserva.hora}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Rating Section */}
                    <div className="mb-6">
                        <h3 className="text-xl font-bold mb-4">{t.experiencia}</h3>
                        <p className="text-gray-600 mb-4">{t.selectRating}</p>

                        <div className="flex justify-center gap-3 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="transition-transform hover:scale-125 focus:outline-none"
                                >
                                    <FiStar
                                        size={48}
                                        className={`${star <= (hoverRating || rating)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                            } transition-colors`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comment Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2">
                            {t.comentarioLabel}
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={t.comentarioPlaceholder}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none resize-none"
                            rows={4}
                            maxLength={500}
                        />
                        <p className="text-xs text-gray-500 mt-1">{comment.length}/500</p>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || rating === 0}
                        className="w-full bg-[#D6A75D] hover:bg-[#C09650] text-white font-bold py-4 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <FiLoader className="animate-spin" /> {t.enviando}
                            </>
                        ) : (
                            t.enviar
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
