'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    FiStar, FiPhone, FiMail, FiLoader, FiCheckCircle, FiGlobe,
    FiUser, FiMapPin, FiCalendar, FiUsers, FiTruck, FiShield,
    FiDollarSign, FiPlusCircle, FiClock, FiPackage
} from 'react-icons/fi';
import { TIMELINE_STATES, getStateOrder, canCancelReservation } from '@/lib/timeline-states';
import { EstadoReserva } from '@prisma/client';
import { BoldButton } from '@/components/bold/BoldButton';
import { formatReservationDate } from '@/lib/date-utils';
import { getDatos } from '@/types/reserva-datos';

const DICTIONARY = {
    ES: {
        progreso: 'Progreso',
        codigoReserva: 'Código de Reserva',
        estadoActual: 'Estado Actual',
        detallesServicio: 'Detalles del Servicio',
        servicio: 'Servicio',
        fechaHora: 'Fecha y Hora',
        pasajeros: 'Pasajeros',
        lugarRecogida: 'Lugar de recogida',
        destino: 'Destino',
        municipio: 'Municipio',
        vehiculo: 'Vehículo',
        duracion: 'Duración',
        informacionContacto: 'Información de Contacto',
        nombre: 'Nombre',
        email: 'Email',
        asistentes: 'Asistentes',
        tipoDoc: 'Tipo Doc',
        numeroDoc: 'Número Doc',
        asignacion: 'Asignación',
        conductor: 'Conductor',
        disponibleCoordinar: 'Disponible para coordinar',
        capacidad: 'Capacidad',
        serviciosAdicionales: 'Servicios Adicionales',
        cantidad: 'Cantidad',
        resumenPrecio: 'Resumen de Precio',
        precioBase: 'Precio Base',
        recargoNocturno: 'Recargo Nocturno',
        tarifaMunicipio: 'Tarifa Municipio',
        descuentoAliado: 'Descuento Aliado',
        total: 'TOTAL',
        cotizacionProceso: 'Cotización en Proceso',
        cotizacionMensaje: 'Estamos calculando el mejor precio para tu destino personalizado. Te enviaremos la cotización a tu WhatsApp e Email muy pronto.',
        pagoSeguro: 'Realizar Pago Seguro',
        pagoMensaje: 'Completa tu pago a través de Bold, una plataforma verificada y segura, en segundos.',
        experiencia: '¿Cómo fue tu experiencia?',
        opinionAyuda: 'Tu opinión nos ayuda a mejorar',
        placeholderComentario: 'Cuéntanos más sobre tu experiencia (opcional)',
        enviarCalificacion: 'Enviar Calificación',
        enviando: 'Enviando...',
        graciasCalificacion: '¡Gracias por tu calificación!',
        cancelarReserva: 'Cancelar Reserva',
        cancelando: 'Cancelando...',
        cancelarMensaje: 'Puedes cancelar hasta 24 horas antes del servicio',
        reservaNoEncontrada: 'Reserva no encontrada',
        volverInicio: 'Volver al inicio',
        cargando: 'Cargando...',
        origen: 'Origen',
        personas: 'persona(s)',
        noEspecificado: 'No especificado',
        tuHotel: 'Tu Hotel/Residencia',
        aeropuertoJMC: 'Aeropuerto JMC',
        aeropuertoOH: 'Aeropuerto Olaya Herrera',
        codigoPedido: 'Código de Pedido',
        pagoEfectivo: 'Pago en Efectivo',
        pendientePago: 'Pendiente de Pago',
        serviciosIncluidos: 'Servicios Incluidos',
        codigo: 'Código',
        metodoPagoLabel: 'Método de pago',
        efectivo: 'Efectivo',
        tarjetaBold: 'Tarjeta',
        cliente: 'Cliente',
        fecha: 'Fecha',
        hora: 'Hora',
        ocultarDetalles: '▼ Ocultar detalles',
        verMasDetalles: '▶ Ver más detalles',
        informacionCompleta: 'Información Completa',
        contacto: 'Contacto',
        ubicacion: 'Ubicación',
        especificacion: 'Especificación',
        vehiculoLabel: 'Vehículo',
        aeropuertoLabel: 'Aeropuerto',
        tipo: 'Tipo',
        vuelo: 'Vuelo',
        trasladoLabel: 'Traslado',
        extras: 'Extras',
        si: 'Sí',
        no: 'No',
        tourCompartidoInfo: 'Información del Tour Compartido',
        puntoEncuentro: 'Punto de Encuentro:',
        horaSalida: 'Hora de Salida:',
        notaTourCompartido: 'Nota: Debes llegar por tus propios medios. No hay servicio de recogida.',
        notas: 'Notas',
        desglosePrecio: 'Desglose de Precio',
        adicionales: 'Adicionales',
        descuento: 'Descuento',
        resumenPago: 'Resumen de Pago',
        subtotal: 'Subtotal',
        servicios: 'servicios',
        recargoTarjeta: '+ 6% Recargo por pago con tarjeta',
        pagoCajaPendiente: 'Pago en caja pendiente',
        pagarExacto: 'Debes pagar exactamente',
        alMomento: 'COP al momento del servicio.',
        completaPagoBold: 'Completa tu pago con tarjeta, una plataforma verificada y segura.',
        impuestosPago: '+ 6% Impuestos del pago:',
        pagoEfectivoServicio: 'Pago en Efectivo',
        pagarCajaExacto: 'Debes pagar en caja exactamente',
        copAlRecibir: 'COP al recibir el servicio.',
        seleccionaCalificacion: 'Por favor selecciona una calificación',
        confirmarCancelacion: '¿Estás seguro que deseas cancelar esta reserva?',
        canceladaExito: 'Reserva cancelada exitosamente',
        numeroVuelo: 'Número de Vuelo',
        stateLabels: {
            PENDING_PAYMENT: 'Pendiente de Pago',
            CONFIRMED_UNASSIGNED: 'Confirmada · Sin Asignar',
            CONFIRMED_ASSIGNED: 'Confirmada · Asignada',
            IN_PROGRESS: 'En Curso',
            COMPLETED: 'Completada',
            CANCELLED: 'Cancelada',
            PAYMENT_FAILED: 'Pago Fallido',
        } as Record<string, string>,
        stateDescriptions: {
            PENDING_PAYMENT: 'Reserva confirmada. Pendiente de pago',
            CONFIRMED_UNASSIGNED: 'Reserva confirmada. Asignando conductor',
            CONFIRMED_ASSIGNED: 'Conductor asignado. Listo para tu viaje',
            IN_PROGRESS: 'Servicio en ejecución',
            COMPLETED: 'Servicio completado exitosamente',
            CANCELLED: 'Reserva cancelada',
            PAYMENT_FAILED: 'El pago fue rechazado. Por favor intenta nuevamente',
        } as Record<string, string>,
    },
    EN: {
        progreso: 'Progress',
        codigoReserva: 'Reservation Code',
        estadoActual: 'Current Status',
        detallesServicio: 'Service Details',
        servicio: 'Service',
        fechaHora: 'Date and Time',
        pasajeros: 'Passengers',
        lugarRecogida: 'Pickup Location',
        destino: 'Destination',
        municipio: 'Municipality',
        vehiculo: 'Vehicle',
        duracion: 'Duration',
        informacionContacto: 'Contact Information',
        nombre: 'Name',
        email: 'Email',
        asistentes: 'Attendees',
        tipoDoc: 'Doc Type',
        numeroDoc: 'Doc Number',
        asignacion: 'Assignment',
        conductor: 'Driver',
        disponibleCoordinar: 'Available to coordinate',
        capacidad: 'Capacity',
        serviciosAdicionales: 'Additional Services',
        cantidad: 'Quantity',
        resumenPrecio: 'Price Summary',
        precioBase: 'Base Price',
        recargoNocturno: 'Night Surcharge',
        tarifaMunicipio: 'Municipality Fee',
        descuentoAliado: 'Ally Discount',
        total: 'TOTAL',
        cotizacionProceso: 'Quote in Process',
        cotizacionMensaje: 'We are calculating the best price for your custom destination. We will send the quote to your WhatsApp and Email very soon.',
        pagoSeguro: 'Make Secure Payment',
        pagoMensaje: 'Complete your payment through Bold, a verified and secure platform, in seconds.',
        experiencia: 'How was your experience?',
        opinionAyuda: 'Your opinion helps us improve',
        placeholderComentario: 'Tell us more about your experience (optional)',
        enviarCalificacion: 'Send Rating',
        enviando: 'Sending...',
        graciasCalificacion: 'Thank you for your rating!',
        cancelarReserva: 'Cancel Reservation',
        cancelando: 'Cancelling...',
        cancelarMensaje: 'You can cancel up to 24 hours before the service',
        reservaNoEncontrada: 'Reservation not found',
        volverInicio: 'Back to home',
        cargando: 'Loading...',
        origen: 'Origin',
        personas: 'person(s)',
        noEspecificado: 'Not specified',
        tuHotel: 'Your Hotel/Residence',
        aeropuertoJMC: 'JMC Airport',
        aeropuertoOH: 'Olaya Herrera Airport',
        codigoPedido: 'Order Code',
        pagoEfectivo: 'Cash Payment',
        pendientePago: 'Pending Payment',
        serviciosIncluidos: 'Included Services',
        codigo: 'Code',
        metodoPagoLabel: 'Payment method',
        efectivo: 'Cash',
        tarjetaBold: 'Card',
        cliente: 'Client',
        fecha: 'Date',
        hora: 'Time',
        ocultarDetalles: '▼ Hide details',
        verMasDetalles: '▶ View more details',
        informacionCompleta: 'Full Information',
        contacto: 'Contact',
        ubicacion: 'Location',
        especificacion: 'Specification',
        vehiculoLabel: 'Vehicle',
        aeropuertoLabel: 'Airport',
        tipo: 'Type',
        vuelo: 'Flight',
        trasladoLabel: 'Transfer',
        extras: 'Extras',
        si: 'Yes',
        no: 'No',
        tourCompartidoInfo: 'Shared Tour Information',
        puntoEncuentro: 'Meeting Point:',
        horaSalida: 'Departure Time:',
        notaTourCompartido: 'Note: You must arrive on your own. No pickup service available.',
        notas: 'Notes',
        desglosePrecio: 'Price Breakdown',
        adicionales: 'Add-ons',
        descuento: 'Discount',
        resumenPago: 'Payment Summary',
        subtotal: 'Subtotal',
        servicios: 'services',
        recargoTarjeta: '+ 6% Card payment surcharge',
        pagoCajaPendiente: 'Pending cash payment',
        pagarExacto: 'You must pay exactly',
        alMomento: 'COP at the time of service.',
        completaPagoBold: 'Complete your payment with card, a verified and secure platform.',
        impuestosPago: '+ 6% Payment taxes:',
        pagoEfectivoServicio: 'Cash Payment',
        pagarCajaExacto: 'You must pay exactly',
        copAlRecibir: 'COP in cash when receiving the service.',
        seleccionaCalificacion: 'Please select a rating',
        confirmarCancelacion: 'Are you sure you want to cancel this reservation?',
        canceladaExito: 'Reservation cancelled successfully',
        numeroVuelo: 'Flight Number',
        stateLabels: {
            PENDING_PAYMENT: 'Pending Payment',
            CONFIRMED_UNASSIGNED: 'Confirmed · Unassigned',
            CONFIRMED_ASSIGNED: 'Confirmed · Assigned',
            IN_PROGRESS: 'In Progress',
            COMPLETED: 'Completed',
            CANCELLED: 'Cancelled',
            PAYMENT_FAILED: 'Payment Failed',
        } as Record<string, string>,
        stateDescriptions: {
            PENDING_PAYMENT: 'Booking confirmed. Awaiting payment',
            CONFIRMED_UNASSIGNED: 'Booking confirmed. Assigning driver',
            CONFIRMED_ASSIGNED: 'Driver assigned. Ready for your trip',
            IN_PROGRESS: 'Service in progress',
            COMPLETED: 'Service completed successfully',
            CANCELLED: 'Booking cancelled',
            PAYMENT_FAILED: 'Payment was rejected. Please try again',
        } as Record<string, string>,
    }
};

// Reusable icon container matching the site's Features section pattern
function IconBox({ icon: Icon, className = '' }: { icon: React.ElementType; className?: string }) {
    return (
        <div className={`w-10 h-10 bg-[#D6A75D]/10 text-[#D6A75D] rounded-full flex items-center justify-center flex-shrink-0 ${className}`}>
            <Icon size={18} />
        </div>
    );
}

// Section header with icon
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <IconBox icon={Icon} />
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
    );
}

// Individual info field
function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="font-semibold text-gray-900">{value}</p>
        </div>
    );
}

export default function TrackingPage({ params }: { params: { codigo: string } }) {
    const searchParams = useSearchParams();
    const isHotelView = searchParams?.get('hotel') === 'true';

    const [reserva, setReserva] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [boldConfig, setBoldConfig] = useState<any>(null);
    const [userLang, setUserLang] = useState<'ES' | 'EN' | null>(null);

    const langParam = searchParams?.get('lang');

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);

    const [cancelling, setCancelling] = useState(false);

    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

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
        async function fetchData() {
            try {
                const isPedido = params.codigo.startsWith('PED');

                if (isPedido) {
                    const res = await fetch(`/api/pedido?codigo=${params.codigo}`);
                    if (res.ok) {
                        const data = await res.json();
                        const pedidoData = data.data;

                        if (pedidoData.estadoPago === 'PENDIENTE' && !pedidoData.hashPago) {
                            try {
                                const hashRes = await fetch('/api/bold/generate-hash', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pedidoId: pedidoData.id }),
                                });

                                if (hashRes.ok) {
                                    const hashData = await hashRes.json();
                                    pedidoData.hashPago = hashData.hash;
                                }
                            } catch (hashError) {
                                console.error('Error generating hash:', hashError);
                            }
                        }

                        setReserva(pedidoData);
                    }
                } else {
                    const res = await fetch(`/api/reservas/${params.codigo}`);
                    if (res.ok) {
                        const data = await res.json();

                        // hashPago is stripped from the public API response for security.
                        // Re-generate it client-side when the reservation is awaiting payment,
                        // mirroring the same pattern used in the pedido view.
                        if (data.estado === 'PENDING_PAYMENT' && !data.hashPago) {
                            try {
                                const hashRes = await fetch('/api/bold/generate-hash', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ reservaId: data.id }),
                                });
                                if (hashRes.ok) {
                                    const hashData = await hashRes.json();
                                    data.hashPago = hashData.hash;
                                }
                            } catch (hashError) {
                                console.error('Error generating hash:', hashError);
                            }
                        }

                        setReserva(data);
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [params.codigo]);

    const handleSubmitRating = async () => {
        if (rating === 0) {
            const currentLang = (userLang || (langParam?.toUpperCase() === 'EN' ? 'EN' : null) || (reserva?.idioma === 'EN' ? 'EN' : 'ES')) as keyof typeof DICTIONARY;
            alert(DICTIONARY[currentLang].seleccionaCalificacion);
            return;
        }

        setSubmittingRating(true);
        try {
            const res = await fetch('/api/calificaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservaId: reserva.id,
                    servicioId: reserva.servicioId,
                    estrellas: rating,
                    comentario: comment,
                    nombreCliente: reserva.nombreCliente,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al enviar calificación');
            }

            setRatingSubmitted(true);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setSubmittingRating(false);
        }
    };

    const handleCancelReservation = async () => {
        const currentLang = (userLang || (langParam?.toUpperCase() === 'EN' ? 'EN' : null) || (reserva?.idioma === 'EN' ? 'EN' : 'ES')) as keyof typeof DICTIONARY;
        if (!confirm(DICTIONARY[currentLang].confirmarCancelacion)) {
            return;
        }

        setCancelling(true);
        try {
            const res = await fetch(`/api/reservas/${params.codigo}/cancelar`, {
                method: 'POST',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al cancelar reserva');
            }

            const data = await res.json();
            setReserva(data.data);
            const cl = (userLang || (langParam?.toUpperCase() === 'EN' ? 'EN' : null) || (reserva?.idioma === 'EN' ? 'EN' : 'ES')) as keyof typeof DICTIONARY;
            alert(DICTIONARY[cl].canceladaExito);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setCancelling(false);
        }
    };

    const toggleExpanded = (reservaId: string) => {
        setExpandedServices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reservaId)) {
                newSet.delete(reservaId);
            } else {
                newSet.add(reservaId);
            }
            return newSet;
        });
    };

    if (loading) {
        const loadLang = (langParam?.toUpperCase() === 'EN' ? 'EN' : 'ES') as keyof typeof DICTIONARY;
        const loadT = DICTIONARY[loadLang];
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 bg-[#D6A75D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiLoader className="animate-spin text-2xl text-[#D6A75D]" />
                    </div>
                    <p className="text-gray-500 font-medium">{loadT.cargando}</p>
                </div>
            </div>
        );
    }

    if (!reserva) {
        const t = DICTIONARY.ES;
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiPackage className="text-red-400 text-3xl" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-gray-900">{t.reservaNoEncontrada}</h1>
                    <p className="text-gray-500 mb-6">El código <span className="font-mono font-bold text-gray-700">{params.codigo}</span> no existe</p>
                    <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#D6A75D] text-white rounded-xl font-semibold hover:bg-[#c49450] transition-colors">{t.volverInicio}</a>
                </div>
            </div>
        );
    }

    const isPedido = 'reservas' in reserva && Array.isArray(reserva.reservas);

    const effectiveLang = (
        userLang ||
        (langParam?.toUpperCase() === 'EN' ? 'EN' : null) ||
        (reserva.idioma === 'EN' ? 'EN' : 'ES')
    ) as keyof typeof DICTIONARY;

    const toggleLang = () => {
        setUserLang(prev => {
            const current = prev || effectiveLang;
            return current === 'ES' ? 'EN' : 'ES';
        });
    };

    const TrackingLanguageSwitcher = () => (
        <button
            onClick={toggleLang}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            aria-label="Switch Language"
        >
            <FiGlobe className="w-4 h-4" />
            <span className="text-sm font-medium">{effectiveLang === 'ES' ? 'ES' : 'EN'}</span>
        </button>
    );

    // ─── PEDIDO VIEW ───────────────────────────────────────────────────────────
    if (isPedido) {
        const pedido = reserva as any;
        const lang = effectiveLang;
        const t = DICTIONARY[lang];
        const pedidoMetodoPago = pedido.metodoPago === 'EFECTIVO' ? 'EFECTIVO' : 'TARJETA';
        const pedidoEsEfectivo = pedidoMetodoPago === 'EFECTIVO';

        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-black text-white py-5 shadow-lg border-b border-[#D6A75D]/30">
                    <div className="container mx-auto px-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Transportes Medellín Travel</h1>
                            <p className="text-[#D6A75D] text-xs mt-0.5 tracking-widest uppercase">Confirmación de Pedido</p>
                        </div>
                        <TrackingLanguageSwitcher />
                    </div>
                </header>

                <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

                    {/* Hero: Código del Pedido */}
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-8 text-center text-white ring-1 ring-white/10">
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t.codigoPedido}</p>
                        <p className="text-4xl font-bold text-[#D6A75D] tracking-wider mb-4 font-mono">{pedido.codigo}</p>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${pedidoEsEfectivo ? 'bg-green-500/20 text-green-300 ring-1 ring-green-500/30' : 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30'}`}>
                            <span className={`w-2 h-2 rounded-full ${pedidoEsEfectivo ? 'bg-green-400' : 'bg-yellow-400'}`} />
                            {pedidoEsEfectivo ? t.pagoEfectivo : (pedido.estadoPago === 'PENDIENTE' ? t.pendientePago : pedido.estadoPago)}
                        </div>
                    </div>

                    {/* Servicios en el Pedido */}
                    <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                        <SectionHeader icon={FiPackage} title={`${t.serviciosIncluidos} (${pedido.reservas.length})`} />
                        <div className="space-y-4">
                            {pedido.reservas.map((reserva: any, index: number) => {
                                const isExpanded = expandedServices.has(reserva.id);

                                return (
                                    <div key={reserva.id} className="rounded-xl ring-1 ring-black/10 bg-gray-50 overflow-hidden">
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">
                                                        {index + 1}. {typeof reserva.servicio?.nombre === 'string'
                                                            ? reserva.servicio.nombre
                                                            : reserva.servicio?.nombre?.[lang.toLowerCase()] || lang === 'ES' ? 'Servicio' : 'Service'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{t.codigo}: {reserva.codigo}</p>
                                                    <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${reserva.metodoPago === 'EFECTIVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {reserva.metodoPago === 'EFECTIVO' ? t.efectivo : t.tarjetaBold}
                                                    </span>
                                                </div>
                                                <span className="text-lg font-bold text-[#D6A75D] ml-4 flex-shrink-0">
                                                    ${Number(reserva.precioTotal).toLocaleString('es-CO')} COP
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t.cliente}</p>
                                                    <p className="font-medium text-gray-900">{reserva.nombreCliente}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t.fecha}</p>
                                                    <p className="font-medium text-gray-900">{new Date(reserva.fecha).toLocaleDateString(lang === 'EN' ? 'en-US' : 'es-CO')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t.hora}</p>
                                                    <p className="font-medium text-gray-900">{reserva.hora}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">{t.pasajeros}</p>
                                                    <p className="font-medium text-gray-900">{reserva.numeroPasajeros}</p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => toggleExpanded(reserva.id)}
                                                className="mt-3 text-[#D6A75D] hover:text-[#B8894A] font-medium text-sm flex items-center gap-1 transition-colors"
                                            >
                                                {isExpanded ? t.ocultarDetalles : t.verMasDetalles}
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-black/5 bg-white p-4 space-y-3">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.informacionCompleta}</p>

                                                <div className="grid grid-cols-1 gap-3 text-sm">
                                                    {/* Contacto */}
                                                    <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.contacto}</p>
                                                        <p className="text-gray-700"><span className="text-gray-500">WhatsApp:</span> {reserva.whatsappCliente}</p>
                                                        <p className="text-gray-700"><span className="text-gray-500">{t.email}:</span> {reserva.emailCliente}</p>
                                                    </div>

                                                    {/* Ubicación */}
                                                    {reserva.municipio && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.ubicacion}</p>
                                                            <p className="text-gray-700"><span className="text-gray-500">{t.municipio}:</span> {reserva.municipio}</p>
                                                            {reserva.otroMunicipio && (
                                                                <p className="text-gray-700"><span className="text-gray-500">{t.especificacion}:</span> {reserva.otroMunicipio}</p>
                                                            )}
                                                            {(getDatos((reserva as any).datos).lugarRecogida) && (
                                                                <p className="text-gray-700"><span className="text-gray-500">{t.lugarRecogida}:</span> {getDatos((reserva as any).datos).lugarRecogida as string}</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Vehículo */}
                                                    {reserva.vehiculo && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.vehiculoLabel}</p>
                                                            <p className="text-gray-900 font-medium">{reserva.vehiculo.nombre}</p>
                                                        </div>
                                                    )}

                                                    {/* Aeropuerto */}
                                                    {(() => { const rd = getDatos((reserva as any).datos); return rd.aeropuertoTipo && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.aeropuertoLabel}</p>
                                                            <p className="text-gray-700"><span className="text-gray-500">{t.tipo}:</span> {rd.aeropuertoTipo as string}</p>
                                                            {rd.aeropuertoNombre && (
                                                                <p className="text-gray-700"><span className="text-gray-500">{t.aeropuertoLabel}:</span> {rd.aeropuertoNombre as string}</p>
                                                            )}
                                                            {rd.numeroVuelo && (
                                                                <p className="text-gray-700"><span className="text-gray-500">{t.vuelo}:</span> {rd.numeroVuelo as string}</p>
                                                            )}
                                                        </div>
                                                    ); })()}

                                                    {/* Traslado */}
                                                    {(() => { const rd = getDatos((reserva as any).datos); return rd.trasladoTipo && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.trasladoLabel}</p>
                                                            <p className="text-gray-700"><span className="text-gray-500">{t.tipo}:</span> {rd.trasladoTipo as string}</p>
                                                            {rd.trasladoDestino && (
                                                                <p className="text-gray-700"><span className="text-gray-500">{t.destino}:</span> {rd.trasladoDestino as string}</p>
                                                            )}
                                                        </div>
                                                    ); })()}

                                                    {/* Extras dinámicos */}
                                                    {(() => { const rd = getDatos((reserva as any).datos); const entries = Object.entries(rd).filter(([, v]) => v !== null && v !== undefined && v !== ''); return entries.length > 0 && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.extras}</p>
                                                            {entries.map(([key, value]: [string, any]) => (
                                                                <p key={key} className="text-gray-700">
                                                                    <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span> {
                                                                        typeof value === 'boolean' ? (value ? t.si : t.no) : value
                                                                    }
                                                                </p>
                                                            ))}
                                                        </div>
                                                    ); })()}

                                                    {/* Shared Tour Information Box */}
                                                    {reserva.servicio?.esCompartido && (
                                                        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
                                                            <p className="font-bold text-amber-800 text-sm mb-2">{t.tourCompartidoInfo}</p>
                                                            <div className="text-sm text-amber-900 space-y-1">
                                                                <p><strong>{t.puntoEncuentro}</strong> Casa del Reloj<br />Carrera 35 con Calle 7 en Provenza.</p>
                                                                <p><strong>{t.horaSalida}</strong> 7:50 AM</p>
                                                                <p className="italic">{t.notaTourCompartido}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Notas */}
                                                    {reserva.notas && (
                                                        <div className="bg-gray-50 rounded-xl p-3 ring-1 ring-black/5">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.notas}</p>
                                                            <p className="text-gray-700">{reserva.notas}</p>
                                                        </div>
                                                    )}

                                                    {/* Desglose de precio */}
                                                    <div className="bg-[#D6A75D]/5 rounded-xl p-4 ring-1 ring-[#D6A75D]/20">
                                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">{t.desglosePrecio}</p>
                                                        <div className="space-y-2">
                                                            {reserva.precioAdicionales > 0 && (
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-gray-600">{t.adicionales}</span>
                                                                    <span className="font-medium">${Number(reserva.precioAdicionales).toLocaleString('es-CO')}</span>
                                                                </div>
                                                            )}
                                                            {reserva.recargoNocturno > 0 && (
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-gray-600">{t.recargoNocturno}</span>
                                                                    <span className="font-medium">${Number(reserva.recargoNocturno).toLocaleString('es-CO')}</span>
                                                                </div>
                                                            )}
                                                            {reserva.tarifaMunicipio > 0 && (
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-gray-600">{t.tarifaMunicipio}</span>
                                                                    <span className="font-medium">${Number(reserva.tarifaMunicipio).toLocaleString('es-CO')}</span>
                                                                </div>
                                                            )}
                                                            {reserva.descuentoAliado > 0 && (
                                                                <div className="flex justify-between text-sm text-green-600">
                                                                    <span>{t.descuento}</span>
                                                                    <span className="font-medium">-${Number(reserva.descuentoAliado).toLocaleString('es-CO')}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between font-bold pt-2 border-t border-[#D6A75D]/30">
                                                                <span className="text-gray-900">{t.total}</span>
                                                                <span className="text-[#D6A75D]">${Number(reserva.precioTotal).toLocaleString('es-CO')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resumen de Pago */}
                    <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                        <SectionHeader icon={FiDollarSign} title={t.resumenPago} />
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{t.subtotal} ({pedido.reservas.length} {t.servicios})</span>
                                <span className="font-semibold">${Number(pedido.subtotal).toLocaleString('es-CO')} COP</span>
                            </div>
                            {!pedidoEsEfectivo && (
                                <div className="flex justify-between text-sm text-orange-600">
                                    <span>{t.recargoTarjeta}</span>
                                    <span className="font-semibold">${Number(pedido.comisionBold).toLocaleString('es-CO')} COP</span>
                                </div>
                            )}
                            <div className="border-t-2 border-[#D6A75D]/20 pt-4 mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">{t.total}</span>
                                    <span className="text-2xl font-bold text-[#D6A75D]">${Number(pedido.precioTotal).toLocaleString('es-CO')} COP</span>
                                </div>
                            </div>
                        </div>

                        {/* Pago en efectivo */}
                        {pedidoEsEfectivo && (
                            <div className="mt-6 bg-green-50 rounded-xl p-5 ring-1 ring-green-200">
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <FiDollarSign className="text-green-600" size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-green-800 mb-1">{t.pagoCajaPendiente}</p>
                                        <p className="text-sm text-green-700">
                                            {t.pagarExacto} <span className="font-bold">${Number(pedido.precioTotal).toLocaleString('es-CO')} COP</span> {t.alMomento}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Botón de Pago con Tarjeta */}
                        {!pedidoEsEfectivo && pedido.estadoPago === 'PENDIENTE' && boldConfig && (
                            <div className="mt-6 bg-gray-900 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <FiShield className="text-[#D6A75D]" size={16} />
                                    <p className="text-gray-300 text-sm">{t.completaPagoBold}</p>
                                </div>
                                <BoldButton
                                    orderId={pedido.codigo}
                                    amount={Math.round(Number(pedido.precioTotal)).toString()}
                                    currency="COP"
                                    apiKey={boldConfig.publicKey}
                                    integritySignature={pedido.hashPago || ''}
                                    redirectionUrl={boldConfig.redirectUrl}
                                    description={`Pedido ${pedido.codigo} - ${pedido.reservas.length} servicios`}
                                    customerData={{
                                        email: pedido.emailCliente,
                                        fullName: pedido.nombreCliente,
                                        phone: pedido.whatsappCliente,
                                        dialCode: '+57'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // ─── RESERVA INDIVIDUAL VIEW ───────────────────────────────────────────────
    const lang = effectiveLang;
    const t = DICTIONARY[lang];

    const metodoPago = reserva.metodoPago || 'TARJETA';
    const isEfectivo = metodoPago === 'EFECTIVO';

    const isAgency = reserva.aliado?.tipo === 'AGENCIA';

    const d = getDatos((reserva as any).datos);

    let currentState = TIMELINE_STATES[reserva.estado as EstadoReserva];
    const currentOrder = getStateOrder(reserva.estado);
    const mostrarBotonPago = metodoPago === 'TARJETA' &&
        reserva.estado === 'PENDING_PAYMENT';
    const puedeCalificar = reserva.estado === 'COMPLETED' && !reserva.calificacion && !ratingSubmitted;
    const puedeCancelar = canCancelReservation(new Date(reserva.fecha), reserva.estado);

    const Icon = currentState.icon;

    const timelineSteps = isEfectivo ? [
        EstadoReserva.CONFIRMED_UNASSIGNED,
        EstadoReserva.CONFIRMED_ASSIGNED,
        EstadoReserva.IN_PROGRESS,
        EstadoReserva.COMPLETED,
    ] : [
        EstadoReserva.PENDING_PAYMENT,
        EstadoReserva.CONFIRMED_UNASSIGNED,
        EstadoReserva.CONFIRMED_ASSIGNED,
        EstadoReserva.IN_PROGRESS,
        EstadoReserva.COMPLETED,
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-black text-white py-5 shadow-lg border-b border-[#D6A75D]/30">
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Transportes Medellín Travel</h1>
                        <p className="text-[#D6A75D] text-xs mt-0.5 tracking-widest uppercase">Seguimiento de Reserva</p>
                    </div>
                    <TrackingLanguageSwitcher />
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* ── Timeline Sidebar ── */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6 sticky top-8">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">{t.progreso}</p>
                            <div className="relative">
                                {timelineSteps.map((estado, index) => {
                                    const stateConfig = TIMELINE_STATES[estado];
                                    const StateIcon = stateConfig.icon;
                                    const isActive = getStateOrder(estado) <= currentOrder;
                                    const isCurrent = estado === reserva.estado;
                                    const isLast = index === timelineSteps.length - 1;

                                    return (
                                        <div key={estado} className="flex items-start gap-3 relative">
                                            {/* Connector line */}
                                            {!isLast && (
                                                <div className="absolute left-4 top-8 w-0.5 h-8 -translate-x-1/2 z-0" style={{ background: isActive ? '#D6A75D' : '#E5E7EB' }} />
                                            )}
                                            {/* Icon */}
                                            <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                isCurrent
                                                    ? 'bg-[#D6A75D] shadow-md shadow-[#D6A75D]/30 ring-4 ring-[#D6A75D]/20'
                                                    : isActive
                                                        ? 'bg-[#D6A75D]/80'
                                                        : 'bg-gray-100'
                                            }`}>
                                                <StateIcon className={isActive ? 'text-white' : 'text-gray-400'} size={14} />
                                            </div>
                                            {/* Label */}
                                            <div className="flex-1 pb-8">
                                                <p className={`text-sm font-medium leading-tight ${isCurrent ? 'text-gray-900' : isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    {t.stateLabels[estado] ?? stateConfig.label}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Main Content ── */}
                    <div className="lg:col-span-3 space-y-5">

                        {/* Hero: Código y Estado */}
                        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-7 text-white ring-1 ring-white/10">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{t.codigoReserva}</p>
                                    <p className="text-3xl font-bold text-[#D6A75D] tracking-wider font-mono">{reserva.codigo}</p>
                                    {isEfectivo && !isAgency && (
                                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium ring-1 ring-green-500/30">
                                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            {lang === 'ES' ? 'Pago en Efectivo' : 'Cash Payment'}
                                        </div>
                                    )}
                                </div>
                                <div className="md:text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t.estadoActual}</p>
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${currentState.bgColor} ${currentState.color}`}>
                                        <Icon size={16} />
                                        <span>{t.stateLabels[reserva.estado] ?? currentState.label}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 max-w-[220px] md:ml-auto">{t.stateDescriptions[reserva.estado] ?? currentState.description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Detalles del Servicio */}
                        <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                            <SectionHeader icon={FiPackage} title={t.detallesServicio} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <InfoField
                                    label={t.servicio}
                                    value={(() => {
                                        const nombre = reserva.servicio?.nombre;
                                        if (!nombre) return 'N/A';
                                        if (typeof nombre === 'string') return nombre;
                                        return nombre[lang.toLowerCase()] || nombre['es'] || nombre['en'] || 'Servicio';
                                    })()}
                                />
                                <InfoField
                                    label={t.fechaHora}
                                    value={`${formatReservationDate(reserva.fecha, lang === 'EN' ? 'en-US' : 'es-CO', 'long')} — ${reserva.hora}`}
                                />
                                <InfoField
                                    label={t.pasajeros}
                                    value={`${reserva.numeroPasajeros} ${t.personas}`}
                                />
                                <InfoField
                                    label={d.aeropuertoTipo === 'DESDE' ? t.origen : t.lugarRecogida}
                                    value={
                                        d.aeropuertoTipo === 'DESDE'
                                            ? (d.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' ? t.aeropuertoJMC : t.aeropuertoOH)
                                            : ((d.lugarRecogida as string) || t.noEspecificado)
                                    }
                                />
                                <InfoField
                                    label={t.destino}
                                    value={
                                        d.aeropuertoTipo === 'HACIA'
                                            ? (d.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' ? t.aeropuertoJMC : t.aeropuertoOH)
                                            : d.aeropuertoTipo === 'DESDE'
                                                ? ((d.lugarRecogida as string) || t.tuHotel)
                                                : d.trasladoDestino
                                                    ? (d.trasladoDestino as string)
                                                    : (reserva.servicio?.destinoAutoFill ||
                                                        (typeof reserva.servicio?.nombre === 'string'
                                                            ? reserva.servicio?.nombre
                                                            : (reserva.servicio?.nombre?.[lang.toLowerCase()] || reserva.servicio?.nombre?.['es']))
                                                        || t.noEspecificado)
                                    }
                                />
                                {reserva.municipio && (
                                    <InfoField
                                        label={t.municipio}
                                        value={
                                            reserva.municipio === 'OTRO' && reserva.otroMunicipio
                                                ? reserva.otroMunicipio
                                                : reserva.municipio.replace(/_/g, ' ')
                                        }
                                    />
                                )}
                                {reserva.vehiculo && (
                                    <InfoField label={t.vehiculo} value={reserva.vehiculo.nombre} />
                                )}
                                {reserva.servicio?.duracion && (
                                    <InfoField label={t.duracion} value={reserva.servicio.duracion} />
                                )}

                                {/* Flight Number */}
                                {reserva.servicio?.esAeropuerto && (
                                    <InfoField
                                        label={t.numeroVuelo}
                                        value={(d.numeroVuelo as string) || t.noEspecificado}
                                    />
                                )}

                                {/* Shared Tour Info */}
                                {reserva.servicio?.esCompartido && (
                                    <div className="md:col-span-2 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
                                        <p className="font-bold text-amber-800 text-sm mb-2">
                                            {lang === 'ES' ? 'Información del Tour Compartido' : 'Shared Tour Information'}
                                        </p>
                                        <div className="text-sm text-amber-900 space-y-1">
                                            <p><strong>{lang === 'ES' ? 'Punto de Encuentro:' : 'Meeting Point:'}</strong> Esquina de la Carrera 35 con Calle 7 en Provenza.</p>
                                            <p><strong>{lang === 'ES' ? 'Hora de Salida:' : 'Departure Time:'}</strong> 7:50 AM</p>
                                            <p className="italic">{lang === 'ES' ? 'Nota: Debes llegar por tus propios medios. No hay servicio de recogida.' : 'Note: You must arrive on your own. No pickup service available.'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Información del Cliente */}
                        <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                            <SectionHeader icon={FiUser} title={t.informacionContacto} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <InfoField label={t.nombre} value={reserva.nombreCliente} />
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">WhatsApp</p>
                                    <a
                                        href={`https://wa.me/${reserva.whatsappCliente.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors ring-1 ring-green-200"
                                    >
                                        <FiPhone size={13} /> {reserva.whatsappCliente}
                                    </a>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t.email}</p>
                                    <a
                                        href={`mailto:${reserva.emailCliente}`}
                                        className="inline-flex items-center gap-2 text-[#D6A75D] hover:text-[#b8894a] font-semibold text-sm transition-colors"
                                    >
                                        <FiMail size={13} /> {reserva.emailCliente}
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Asistentes */}
                        {reserva.asistentes && reserva.asistentes.length > 0 && (
                            <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                                <SectionHeader icon={FiUsers} title={t.asistentes} />
                                <div className="overflow-x-auto rounded-xl ring-1 ring-black/5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[#D6A75D]/5 border-b border-[#D6A75D]/10">
                                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">{t.nombre}</th>
                                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">{t.tipoDoc}</th>
                                                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">{t.numeroDoc}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reserva.asistentes.map((asistente: any, index: number) => (
                                                <tr key={index} className="border-t border-black/5 even:bg-gray-50 hover:bg-[#D6A75D]/5 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{asistente.nombre}</td>
                                                    <td className="px-4 py-3 text-gray-600">{asistente.tipoDocumento}</td>
                                                    <td className="px-4 py-3 text-gray-600 font-mono">{asistente.numeroDocumento}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Conductor y Vehículo */}
                        {reserva.conductor && (
                            <div className="bg-[#D6A75D]/5 rounded-2xl ring-1 ring-[#D6A75D]/20 p-6">
                                <SectionHeader icon={FiTruck} title={t.asignacion} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="bg-white rounded-xl p-4 ring-1 ring-black/5">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{t.conductor}</p>
                                        <p className="font-bold text-lg text-gray-900">{reserva.conductor.nombre}</p>
                                        <p className="text-xs text-[#D6A75D] mt-1 font-medium">{t.disponibleCoordinar}</p>
                                    </div>
                                    {reserva.vehiculo && (
                                        <div className="bg-white rounded-xl p-4 ring-1 ring-black/5">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{t.vehiculo}</p>
                                            <p className="font-bold text-lg text-gray-900">{reserva.vehiculo.nombre}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {t.capacidad}: {reserva.vehiculo.capacidadMinima}–{reserva.vehiculo.capacidadMaxima} {t.pasajeros.toLowerCase()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Servicios Adicionales */}
                        {reserva.adicionalesSeleccionados && reserva.adicionalesSeleccionados.length > 0 && (
                            <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                                <SectionHeader icon={FiPlusCircle} title={t.serviciosAdicionales} />
                                <div className="space-y-2">
                                    {reserva.adicionalesSeleccionados.map((item: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl ring-1 ring-black/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 bg-[#D6A75D]/10 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <FiCheckCircle className="text-[#D6A75D]" size={13} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{item.adicional.nombre}</p>
                                                    {item.cantidad > 1 && (
                                                        <p className="text-xs text-gray-500">{t.cantidad}: {item.cantidad}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[#D6A75D] font-bold text-sm">
                                                ${Number(item.precioUnitario * item.cantidad).toLocaleString('es-CO')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Resumen de Precio */}
                        {reserva.estado !== 'PAYMENT_FAILED' ? (
                            <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                                <SectionHeader icon={FiDollarSign} title={t.resumenPrecio} />
                                <div className="space-y-3">
                                    {Number(reserva.precioAdicionales) > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">{t.serviciosAdicionales}</span>
                                            <span className="font-semibold">${Number(reserva.precioAdicionales).toLocaleString('es-CO')}</span>
                                        </div>
                                    )}
                                    {Number(reserva.recargoNocturno) > 0 && (
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>{t.recargoNocturno}</span>
                                            <span className="font-semibold">${Number(reserva.recargoNocturno).toLocaleString('es-CO')}</span>
                                        </div>
                                    )}
                                    {Number(reserva.tarifaMunicipio) > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">{t.tarifaMunicipio}</span>
                                            <span className="font-semibold">${Number(reserva.tarifaMunicipio).toLocaleString('es-CO')}</span>
                                        </div>
                                    )}
                                    {Number(reserva.descuentoAliado) > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span>{t.descuentoAliado}</span>
                                            <span className="font-semibold">-${Number(reserva.descuentoAliado).toLocaleString('es-CO')}</span>
                                        </div>
                                    )}
                                    {Number(reserva.comisionBold || 0) > 0 && (
                                        <div className="flex justify-between text-sm text-orange-600">
                                            <span>{t.impuestosPago}</span>
                                            <span className="font-semibold">${Number(reserva.comisionBold).toLocaleString('es-CO')}</span>
                                        </div>
                                    )}
                                    <div className="border-t-2 border-[#D6A75D]/20 pt-4 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-bold text-gray-900">{t.total}</span>
                                            <span className="text-2xl font-bold text-[#D6A75D]">${Number(reserva.precioTotal).toLocaleString('es-CO')} COP</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-50 rounded-2xl ring-1 ring-yellow-200 p-6 text-center">
                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <FiClock className="text-yellow-600" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-yellow-800 mb-2">{t.cotizacionProceso}</h3>
                                <p className="text-yellow-900 text-sm">{t.cotizacionMensaje}</p>
                            </div>
                        )}

                        {/* Pago en Efectivo */}
                        {isEfectivo && reserva.estado !== 'CANCELLED' && (
                            <div className="bg-green-50 rounded-2xl ring-1 ring-green-200 p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <FiDollarSign className="text-green-600" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-green-900 mb-1">
                                            {lang === 'ES' ? 'Pago en Efectivo' : 'Cash Payment'}
                                        </h3>
                                        <p className="text-green-800 text-sm">
                                            {lang === 'ES' ? 'Debes pagar en caja exactamente' : 'You must pay exactly'}
                                        </p>
                                        <p className="text-2xl font-bold text-green-900 mt-2">
                                            ${Number(reserva.precioTotal).toLocaleString('es-CO')} COP
                                        </p>
                                        <p className="text-xs text-green-700 mt-1">
                                            {lang === 'ES' ? 'al recibir el servicio.' : 'in cash when receiving the service.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Botón de Pago Bold */}
                        {mostrarBotonPago && boldConfig && reserva.hashPago && (
                            <div className="bg-gray-900 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <FiShield className="text-[#D6A75D]" size={16} />
                                    <h3 className="font-bold text-white text-sm">{t.pagoSeguro}</h3>
                                </div>
                                <p className="text-gray-400 text-xs mb-5">{t.pagoMensaje}</p>
                                <BoldButton
                                    orderId={reserva.codigo}
                                    amount={Math.round(Number(reserva.precioTotal)).toString()}
                                    currency="COP"
                                    apiKey={boldConfig.publicKey}
                                    integritySignature={reserva.hashPago}
                                    redirectionUrl={boldConfig.redirectUrl}
                                    description={`Reserva ${reserva.codigo}`}
                                    customerData={reserva.emailCliente ? {
                                        email: reserva.emailCliente,
                                        fullName: reserva.nombreCliente,
                                        phone: reserva.whatsappCliente,
                                        dialCode: '+57'
                                    } : undefined}
                                />
                            </div>
                        )}

                        {/* Calificación */}
                        {puedeCalificar && (
                            <div className="bg-white rounded-2xl ring-1 ring-black/10 p-6">
                                <SectionHeader icon={FiStar} title={t.experiencia} />
                                <p className="text-sm text-gray-500 mb-5 -mt-2">{t.opinionAyuda}</p>

                                <div className="flex gap-2 mb-5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            className="transition-transform hover:scale-110"
                                        >
                                            <FiStar
                                                size={36}
                                                className={`transition-colors ${star <= (hoverRating || rating)
                                                    ? 'fill-[#D6A75D] text-[#D6A75D]'
                                                    : 'text-gray-200'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={t.placeholderComentario}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none resize-none mb-4 text-sm transition-colors"
                                    rows={3}
                                    maxLength={500}
                                />

                                <button
                                    onClick={handleSubmitRating}
                                    disabled={submittingRating || rating === 0}
                                    className="w-full bg-[#D6A75D] hover:bg-[#c49450] text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {submittingRating ? (
                                        <><FiLoader className="animate-spin" /> {t.enviando}</>
                                    ) : (
                                        t.enviarCalificacion
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Rating Submitted */}
                        {ratingSubmitted && (
                            <div className="bg-white rounded-2xl ring-1 ring-black/10 p-8 text-center">
                                <div className="w-16 h-16 bg-[#D6A75D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FiCheckCircle className="text-[#D6A75D]" size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-1">{t.graciasCalificacion}</h3>
                                <p className="text-sm text-gray-500">{t.opinionAyuda}</p>
                            </div>
                        )}

                        {/* Botón Cancelar */}
                        {puedeCancelar && (
                            <div className="text-center pb-4">
                                <button
                                    onClick={handleCancelReservation}
                                    disabled={cancelling}
                                    className="px-6 py-2 text-red-500 hover:text-red-600 font-medium text-sm hover:underline disabled:opacity-50 transition-colors"
                                >
                                    {cancelling ? t.cancelando : t.cancelarReserva}
                                </button>
                                <p className="text-xs text-gray-400 mt-1">{t.cancelarMensaje}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
