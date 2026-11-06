'use client';

import { useState } from 'react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ReservaData {
    codigo: string;
    nombreCliente: string;
    servicio: string;
    fecha: string;
    hora: string;
    numeroPasajeros: number;
    precioConTarjeta: number;
    precioEfectivo: number;
    estado: string;
    idioma: 'ES' | 'EN';
    vehiculo: string | null;
    /** Sin opción de efectivo (aliado "solo tarjeta" o cotización del agente de WhatsApp). */
    soloPagoTarjeta?: boolean;
}

/** Datos completos de la cotización (formulario ya lleno). */
export interface DetalleCotizacion {
    aeropuertoTipo: 'DESDE' | 'HACIA' | null;
    aeropuerto: string | null;
    numeroVuelo: string | null;
    lugarRecogida: string | null;
    trasladoDestino: string | null;
    municipio: string | null;
    cantidadHoras: number | null;
    adicionales: string[];
    notas: string | null;
    email: string;
    whatsapp: string;
    precioBase: number;
    precioAdicionales: number;
    recargoNocturno: number;
    tarifaMunicipio: number;
    comisionBold: number;
    /** YYYY-MM-DD */
    vigencia: string;
}

interface BoldData {
    publicKey: string;
    orderId: string;
    amount: number;
    currency: string;
    integrity: string;
    redirectionUrl: string;
}

function formatCOP(amount: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount);
}

/** YYYY-MM-DD → "12 de diciembre de 2026" / "December 12, 2026" (sin desfase de zona horaria). */
function formatFecha(iso: string, isES: boolean) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const d = new Date(iso + 'T12:00:00Z');
    return new Intl.DateTimeFormat(isES ? 'es-CO' : 'en-US', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(d);
}

/** "23:00" → "11:00 p. m." / "11:00 PM" */
function formatHora(hhmm: string, isES: boolean) {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
    if (!m) return hhmm;
    const h = Number(m[1]);
    const suf = isES ? (h < 12 ? 'a. m.' : 'p. m.') : (h < 12 ? 'AM' : 'PM');
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m[2]} ${suf}`;
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'bold-button': React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement> & {
                    'data-bold-button'?: boolean;
                    'data-order-id'?: string;
                    'data-currency'?: string;
                    'data-amount'?: string;
                    'data-api-key'?: string;
                    'data-integrity-signature'?: string;
                    'data-redirection-url'?: string;
                },
                HTMLElement
            >;
        }
    }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-gray-500 shrink-0">{label}</span>
            <span className="font-medium text-right break-words min-w-0">{value}</span>
        </div>
    );
}

export function ConfirmarReservaClient({
    reserva,
    boldData,
    detalle,
}: {
    reserva: ReservaData;
    boldData: BoldData | null;
    detalle?: DetalleCotizacion;
}) {
    const [loading, setLoading] = useState(false);
    // Fix 4: any non-PENDING_PAYMENT state shows already-processed screen
    const [confirmed, setConfirmed] = useState(reserva.estado !== 'PENDING_PAYMENT');
    const [error, setError] = useState<string | null>(null);

    const isES = reserva.idioma !== 'EN';
    const t = {
        kicker: isES ? 'Cotización' : 'Quote',
        title: isES ? 'Revisa tu reserva' : 'Review your booking',
        subtitle: isES
            ? 'Tu reserva ya está llena. Revisa los datos y confirma con el pago.'
            : 'Your booking is already filled in. Review the details and confirm with payment.',
        trip: isES ? 'Tu servicio' : 'Your service',
        contact: isES ? 'Tus datos' : 'Your details',
        price: isES ? 'Valor' : 'Price',
        service: isES ? 'Servicio' : 'Service',
        type: isES ? 'Tipo' : 'Type',
        arrival: isES ? 'Llegada (te recogemos en el aeropuerto)' : 'Arrival (pickup at the airport)',
        departure: isES ? 'Salida (te llevamos al aeropuerto)' : 'Departure (drop-off at the airport)',
        airport: isES ? 'Aeropuerto' : 'Airport',
        flight: isES ? 'Número de vuelo' : 'Flight number',
        date: isES ? 'Fecha' : 'Date',
        time: isES ? 'Hora' : 'Time',
        pickup: isES ? 'Recogida' : 'Pickup',
        destination: isES ? 'Destino' : 'Destination',
        zone: isES ? 'Municipio' : 'Area',
        hours: isES ? 'Horas' : 'Hours',
        passengers: isES ? 'Pasajeros' : 'Passengers',
        vehicle: isES ? 'Vehículo' : 'Vehicle',
        extras: isES ? 'Adicionales' : 'Extras',
        notes: isES ? 'Notas' : 'Notes',
        name: isES ? 'Nombre' : 'Name',
        email: isES ? 'Correo' : 'Email',
        whatsapp: 'WhatsApp',
        base: isES ? 'Valor del servicio' : 'Service price',
        extrasPrice: isES ? 'Adicionales' : 'Extras',
        night: isES ? 'Recargo nocturno' : 'Night surcharge',
        zoneFee: isES ? 'Recargo de municipio' : 'Area surcharge',
        cardFee: isES ? 'Comisión pago con tarjeta' : 'Card payment fee',
        total: 'Total',
        payCash: isES ? '💵 Pagaré en efectivo' : '💵 Pay in cash',
        payHint: isES
            ? 'Presiona el botón para confirmar y pagar con Bold de forma segura.'
            : 'Press the button to confirm and pay securely with Bold.',
        cardNote: isES
            ? `Total con tarjeta: ${formatCOP(reserva.precioConTarjeta)} (incluye comisión)`
            : `Total with card: ${formatCOP(reserva.precioConTarjeta)} (includes fee)`,
        cashNote: isES
            ? `Total en efectivo: ${formatCOP(reserva.precioEfectivo)}`
            : `Total in cash: ${formatCOP(reserva.precioEfectivo)}`,
        validity: (fecha: string) => isES
            ? `Cotización válida hasta el ${formatFecha(fecha, true)}, sujeta a disponibilidad al momento del pago.`
            : `Quote valid until ${formatFecha(fecha, false)}, subject to availability at the time of payment.`,
        changes: isES
            ? '¿Algo no está bien? Escríbenos por WhatsApp y lo corregimos.'
            : 'Something not right? Message us on WhatsApp and we will fix it.',
        noPayment: isES
            ? 'El pago en línea no está disponible en este momento. Escríbenos por WhatsApp para confirmar tu reserva.'
            : 'Online payment is not available right now. Message us on WhatsApp to confirm your booking.',
        confirmedTitle: isES ? '¡Reserva confirmada! 🎉' : 'Booking confirmed! 🎉',
        confirmedText: isES
            ? `Tu código de reserva es ${reserva.codigo}. Nuestro equipo te contactará pronto para coordinar el pago.`
            : `Your booking code is ${reserva.codigo}. Our team will contact you soon to coordinate payment.`,
        tryAgain: isES ? 'Hubo un error. Intenta de nuevo.' : 'An error occurred. Please try again.',
    };

    async function handleEfectivo() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/reservas/confirmar-metodo-pago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigoReserva: reserva.codigo, metodoPago: 'EFECTIVO' }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Error');
            setConfirmed(true);
        } catch {
            setError(t.tryAgain);
        } finally {
            setLoading(false);
        }
    }

    // Fix 4: state-aware confirmed screen content
    function getConfirmedContent() {
        if (reserva.estado === 'CANCELLED') {
            return {
                icon: '❌',
                title: isES ? 'Reserva cancelada' : 'Reservation cancelled',
                text: isES
                    ? 'Esta reserva fue cancelada. Escríbenos si necesitas ayuda.'
                    : 'This reservation was cancelled. Contact us if you need help.',
            };
        }
        if (reserva.estado === 'PAYMENT_FAILED') {
            return {
                icon: '⚠️',
                title: isES ? 'El pago no se completó' : 'Payment was not completed',
                text: isES
                    ? 'Escríbenos por WhatsApp y te ayudamos a terminar tu reserva.'
                    : 'Message us on WhatsApp and we will help you finish your booking.',
            };
        }
        return {
            icon: '✅',
            title: t.confirmedTitle,
            text: t.confirmedText,
        };
    }

    if (confirmed) {
        const content = getConfirmedContent();
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-white text-center p-8">
                    <div className="text-5xl mb-4">{content.icon}</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">{content.title}</h1>
                    <p className="text-gray-600 mb-4">{content.text}</p>
                    <Badge className="bg-[#D6A75D] text-black text-lg px-4 py-2 font-mono tracking-widest">
                        {reserva.codigo}
                    </Badge>
                </Card>
            </div>
        );
    }

    const d = detalle;
    const mostrarEfectivo = !reserva.soloPagoTarjeta;

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-start sm:items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                    <p className="text-[#D6A75D] font-semibold text-sm uppercase tracking-widest mb-1">
                        TMT Travel · {t.kicker}
                    </p>
                    <h1 className="text-2xl font-bold text-white">{t.title}</h1>
                    {d && <p className="text-sm text-gray-400 mt-2">{t.subtitle}</p>}
                </div>

                <Card className="bg-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-gray-700 flex items-center justify-between gap-2">
                            <span>{d ? t.trip : reserva.nombreCliente}</span>
                            <Badge variant="outline" className="text-xs font-mono">
                                {reserva.codigo}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <Row label={t.service} value={reserva.servicio} />
                        {d?.aeropuertoTipo && (
                            <Row label={t.type} value={d.aeropuertoTipo === 'DESDE' ? t.arrival : t.departure} />
                        )}
                        {d?.aeropuerto && <Row label={t.airport} value={d.aeropuerto} />}
                        {d?.numeroVuelo && <Row label={t.flight} value={d.numeroVuelo} />}
                        <Row label={t.date} value={formatFecha(reserva.fecha, isES)} />
                        <Row label={t.time} value={formatHora(reserva.hora, isES)} />
                        {d?.lugarRecogida && <Row label={t.pickup} value={d.lugarRecogida} />}
                        {d?.trasladoDestino && <Row label={t.destination} value={d.trasladoDestino} />}
                        {d?.municipio && <Row label={t.zone} value={d.municipio} />}
                        {d?.cantidadHoras ? <Row label={t.hours} value={d.cantidadHoras} /> : null}
                        <Row label={t.passengers} value={reserva.numeroPasajeros} />
                        {reserva.vehiculo && <Row label={t.vehicle} value={reserva.vehiculo} />}
                        {d && d.adicionales.length > 0 && <Row label={t.extras} value={d.adicionales.join(', ')} />}
                        {d?.notas && <Row label={t.notes} value={d.notas} />}
                    </CardContent>
                </Card>

                {d && (
                    <Card className="bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-gray-700">{t.contact}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <Row label={t.name} value={reserva.nombreCliente} />
                            <Row label={t.email} value={d.email} />
                            <Row label={t.whatsapp} value={d.whatsapp} />
                        </CardContent>
                    </Card>
                )}

                {d && (
                    <Card className="bg-white">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-gray-700">{t.price}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <Row label={t.base} value={formatCOP(d.precioBase)} />
                            {d.precioAdicionales > 0 && <Row label={t.extrasPrice} value={formatCOP(d.precioAdicionales)} />}
                            {d.recargoNocturno > 0 && <Row label={t.night} value={formatCOP(d.recargoNocturno)} />}
                            {d.tarifaMunicipio > 0 && <Row label={t.zoneFee} value={formatCOP(d.tarifaMunicipio)} />}
                            {boldData && d.comisionBold > 0 && <Row label={t.cardFee} value={formatCOP(d.comisionBold)} />}
                            <Separator />
                            <div className="flex justify-between text-base font-bold text-gray-900">
                                <span>{t.total}</span>
                                <span>{formatCOP(boldData ? reserva.precioConTarjeta : reserva.precioEfectivo)} COP</span>
                            </div>
                            <p className="text-xs text-gray-500 pt-1">{t.validity(d.vigencia)}</p>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {boldData && (
                        <div>
                            {d && <p className="text-xs text-gray-300 text-center mb-2">{t.payHint}</p>}
                            <bold-button
                                data-bold-button
                                data-order-id={boldData.orderId}
                                data-currency={boldData.currency}
                                data-amount={String(boldData.amount)}
                                data-api-key={boldData.publicKey}
                                data-integrity-signature={boldData.integrity}
                                data-redirection-url={boldData.redirectionUrl}
                                style={{ width: '100%' }}
                            />
                            {/* IM-03: Next.js Script avoids re-appending on re-render */}
                            <Script
                                src="https://checkout.bold.co/library/boldPaymentButton.js"
                                strategy="lazyOnload"
                            />
                            <p className="text-xs text-gray-400 text-center mt-1">{t.cardNote}</p>
                        </div>
                    )}

                    {!boldData && !mostrarEfectivo && (
                        <p className="text-sm text-[#F2C94C] text-center">{t.noPayment}</p>
                    )}

                    {boldData && mostrarEfectivo && (
                        <div className="flex items-center gap-2">
                            <Separator className="flex-1" />
                            <span className="text-xs text-gray-400">{isES ? 'o' : 'or'}</span>
                            <Separator className="flex-1" />
                        </div>
                    )}

                    {mostrarEfectivo && (
                    <div>
                        <Button
                            onClick={handleEfectivo}
                            disabled={loading}
                            variant="outline"
                            className="w-full border-[#D6A75D] text-[#D6A75D] hover:bg-[#D6A75D] hover:text-black"
                        >
                            {loading ? '...' : t.payCash}
                        </Button>
                        <p className="text-xs text-gray-400 text-center mt-1">{t.cashNote}</p>
                    </div>
                    )}
                </div>

                {d && <p className="text-xs text-gray-500 text-center">{t.changes}</p>}
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            </div>
        </div>
    );
}
