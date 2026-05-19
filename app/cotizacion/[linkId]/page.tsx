'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiLoader, FiCheckCircle } from 'react-icons/fi';
import { BoldButton } from '@/components/bold/BoldButton';
import { formatReservationDate } from '@/lib/date-utils';
import { getDatos } from '@/types/reserva-datos';

const DICTIONARY = {
    ES: {
        tuCotizacion: 'Tu Cotización Personalizada',
        codigoCotizacion: 'Código de Cotización',
        detallesServicio: 'Detalles del Servicio',
        servicio: 'Servicio',
        fechaHora: 'Fecha y Hora',
        pasajeros: 'Pasajeros',
        lugarRecogida: 'Lugar de recogida',
        destino: 'Destino',
        municipio: 'Municipio',
        vehiculo: 'Vehículo',
        informacionContacto: 'Información de Contacto',
        nombre: 'Nombre',
        email: 'Email',
        precioTotal: 'Precio Total',
        pagarAhora: 'Pagar Ahora',
        pagoMensaje: 'Completa tu pago de forma segura con Bold. Una vez pagado, recibirás un código de tracking para seguir tu reserva.',
        cotizacionNoEncontrada: 'Cotización no encontrada',
        volverInicio: 'Volver al inicio',
        cargando: 'Cargando...',
        personas: 'persona(s)',
        noEspecificado: 'No especificado',
        tuHotel: 'Tu Hotel/Residencia',
        aeropuertoJMC: 'Aeropuerto JMC',
        aeropuertoOH: 'Aeropuerto Olaya Herrera',
        origen: 'Origen',
        yaPagada: 'Cotización Ya Pagada',
        yaPagadaMensaje: 'Esta cotización ya ha sido pagada. Usa el código de tracking para ver el estado de tu reserva.',
        verTracking: 'Ver Estado de Reserva',
        pagoEfectivo: 'Pago en Efectivo',
        pagoEfectivoMensaje: 'Esta cotización se debe pagar en efectivo. Al momento del servicio, realiza el pago directamente al conductor asignado.',
        estadoConfirmada: 'Reserva Confirmada',
    },
    EN: {
        tuCotizacion: 'Your Custom Quote',
        codigoCotizacion: 'Quote Code',
        detallesServicio: 'Service Details',
        servicio: 'Service',
        fechaHora: 'Date and Time',
        pasajeros: 'Passengers',
        lugarRecogida: 'Pickup Location',
        destino: 'Destination',
        municipio: 'Municipality',
        vehiculo: 'Vehicle',
        informacionContacto: 'Contact Information',
        nombre: 'Name',
        email: 'Email',
        precioTotal: 'Total Price',
        pagarAhora: 'Pay Now',
        pagoMensaje: 'Complete your payment securely with Bold. Once paid, you will receive a tracking code to follow your reservation.',
        cotizacionNoEncontrada: 'Quote not found',
        volverInicio: 'Back to home',
        cargando: 'Loading...',
        personas: 'person(s)',
        noEspecificado: 'Not specified',
        tuHotel: 'Your Hotel/Residence',
        aeropuertoJMC: 'JMC Airport',
        aeropuertoOH: 'Olaya Herrera Airport',
        origen: 'Origin',
        yaPagada: 'Quote Already Paid',
        yaPagadaMensaje: 'This quote has already been paid. Use the tracking code to see your reservation status.',
        verTracking: 'View Reservation Status',
        pagoEfectivo: 'Cash Payment',
        pagoEfectivoMensaje: 'This quote must be paid in cash. At the time of service, make the payment directly to the assigned driver.',
        estadoConfirmada: 'Reservation Confirmed',
    }
};

export default function QuotePage({ params }: { params: { linkId: string } }) {
    const router = useRouter();
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [boldConfig, setBoldConfig] = useState<any>(null);

    // Fetch Bold config
    useEffect(() => {
        async function fetchBoldConfig() {
            try {
                const res = await fetch('/api/bold/config');
                if (res.ok) {
                    const data = await res.json();
                    setBoldConfig(data);
                }
            } catch (error) {
                console.error('Error fetching Bold config:', error);
            }
        }
        fetchBoldConfig();
    }, []);

    useEffect(() => {
        async function fetchQuote() {
            try {
                const res = await fetch(`/api/cotizaciones/${params.linkId}`);
                if (res.ok) {
                    const data = await res.json();
                    setQuote(data.data);
                }
            } catch (error) {
                console.error('Error fetching quote:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchQuote();
    }, [params.linkId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <FiLoader className="animate-spin text-4xl text-[#D6A75D] mx-auto mb-4" />
                    <p className="text-gray-600">Cargando...</p>
                </div>
            </div>
        );
    }

    if (!quote) {
        const t = DICTIONARY.ES;
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <h1 className="text-3xl font-bold mb-4">{t.cotizacionNoEncontrada}</h1>
                    <p className="text-gray-600 mb-6">El link {params.linkId} no existe</p>
                    <a href="/" className="text-[#D6A75D] hover:underline">{t.volverInicio}</a>
                </div>
            </div>
        );
    }

    // Determine language
    const lang = (quote.idioma === 'EN' ? 'EN' : 'ES') as keyof typeof DICTIONARY;
    const t = DICTIONARY[lang];

    // Check if already paid
    const isPaid = quote.estado !== 'PENDING_PAYMENT' && quote.estado !== 'CONFIRMED_UNASSIGNED';
    const isEfectivo = quote.metodoPago === 'EFECTIVO';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-black text-white py-6 shadow-lg">
                <div className="container mx-auto px-4">
                    <h1 className="text-2xl md:text-3xl font-bold">Transportes Medellín Travel</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="space-y-6">
                    {/* Title */}
                    <div className="bg-white rounded-xl shadow-md p-6 text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{t.tuCotizacion}</h2>
                        <p className="text-sm text-gray-600 mb-4">{t.codigoCotizacion}</p>
                        <p className="text-2xl font-bold text-[#D6A75D] tracking-wider">{quote.codigo}</p>
                    </div>

                    {/* Already Paid Notice */}
                    {isPaid && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                            <FiCheckCircle className="text-green-600 text-5xl mx-auto mb-3" />
                            <h3 className="text-xl font-bold text-green-900 mb-2">{t.yaPagada}</h3>
                            <p className="text-green-700 mb-4">{t.yaPagadaMensaje}</p>
                            <button
                                onClick={() => router.push(`/tracking/${quote.codigo}`)}
                                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all"
                            >
                                {t.verTracking}
                            </button>
                        </div>
                    )}

                    {/* Service Details */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-2xl">🚐</span> {t.detallesServicio}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">{t.servicio}</p>
                                <p className="font-semibold">
                                    {(() => {
                                        const nombre = quote.servicio?.nombre;
                                        if (!nombre) return 'N/A';
                                        if (typeof nombre === 'string') return nombre;
                                        return nombre[lang.toLowerCase()] || nombre['es'] || nombre['en'] || 'Servicio';
                                    })()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{t.fechaHora}</p>
                                <p className="font-semibold">
                                    {formatReservationDate(quote.fecha, lang === 'EN' ? 'en-US' : 'es-CO', 'long')} - {quote.hora}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{t.pasajeros}</p>
                                <p className="font-semibold">{quote.numeroPasajeros} {t.personas}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{t.lugarRecogida}</p>
                                <p className="font-semibold">{(getDatos((quote as any).datos).lugarRecogida as string) || t.noEspecificado}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{t.municipio}</p>
                                <p className="font-semibold">
                                    {quote.municipio === 'OTRO' && quote.otroMunicipio
                                        ? quote.otroMunicipio
                                        : (quote.municipio ? String(quote.municipio).replace(/_/g, ' ') : t.noEspecificado)}
                                </p>
                            </div>
                            {quote.vehiculo && (
                                <div>
                                    <p className="text-sm text-gray-600">{t.vehiculo}</p>
                                    <p className="font-semibold">{quote.vehiculo.nombre}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-2xl">👤</span> {t.informacionContacto}
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">{t.nombre}</p>
                                <p className="font-semibold">{quote.nombreCliente}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">WhatsApp</p>
                                <p className="font-semibold">{quote.whatsappCliente}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{t.email}</p>
                                <p className="font-semibold">{quote.emailCliente}</p>
                            </div>
                        </div>
                    </div>

                    {/* Price */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="text-2xl">💰</span> {t.precioTotal}
                        </h3>
                        <div className="text-center py-4">
                            <p className="text-4xl font-bold text-[#D6A75D]">
                                ${Number(quote.precioTotal).toLocaleString('es-CO')} COP
                            </p>
                        </div>
                    </div>

                    {/* Payment Button - Bold */}
                    {!isPaid && !isEfectivo && boldConfig && quote.hashPago && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-xl font-bold mb-2">💳 {t.pagarAhora}</h3>
                            <p className="text-gray-700 mb-6">{t.pagoMensaje}</p>
                            <BoldButton
                                orderId={quote.codigo}
                                amount={Math.round(Number(quote.precioTotal)).toString()}
                                currency="COP"
                                apiKey={boldConfig.publicKey}
                                integritySignature={quote.hashPago}
                                redirectionUrl={boldConfig.redirectUrl}
                                description={`Cotización ${quote.codigo}`}
                                customerData={quote.emailCliente ? {
                                    email: quote.emailCliente,
                                    fullName: quote.nombreCliente,
                                    phone: quote.whatsappCliente,
                                    dialCode: '+57'
                                } : undefined}
                            />
                        </div>
                    )}

                    {/* Cash Payment Notice */}
                    {!isPaid && isEfectivo && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                            <div className="text-5xl mb-3">💵</div>
                            <h3 className="text-xl font-bold text-green-900 mb-2">{t.pagoEfectivo}</h3>
                            <p className="text-green-700 mb-4">{t.pagoEfectivoMensaje}</p>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-200 text-green-800 rounded-full font-semibold">
                                <FiCheckCircle size={18} />
                                {t.estadoConfirmada}
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={() => router.push(`/tracking/${quote.codigo}`)}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all"
                                >
                                    {t.verTracking}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
