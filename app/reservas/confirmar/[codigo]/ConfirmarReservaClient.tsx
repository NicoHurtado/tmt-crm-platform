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

export function ConfirmarReservaClient({
    reserva,
    boldData,
}: {
    reserva: ReservaData;
    boldData: BoldData | null;
}) {
    const [loading, setLoading] = useState(false);
    // Fix 4: any non-PENDING_PAYMENT state shows already-processed screen
    const [confirmed, setConfirmed] = useState(reserva.estado !== 'PENDING_PAYMENT');
    const [error, setError] = useState<string | null>(null);

    const isES = reserva.idioma !== 'EN';
    const t = {
        title: isES ? 'Confirma tu reserva' : 'Confirm your booking',
        service: isES ? 'Servicio' : 'Service',
        date: isES ? 'Fecha' : 'Date',
        time: isES ? 'Hora' : 'Time',
        passengers: isES ? 'Pasajeros' : 'Passengers',
        vehicle: isES ? 'Vehículo' : 'Vehicle',
        payCash: isES ? '💵 Pagaré en efectivo' : '💵 Pay in cash',
        cardNote: isES
            ? `Total con tarjeta: ${formatCOP(reserva.precioConTarjeta)} (incluye comisión)`
            : `Total with card: ${formatCOP(reserva.precioConTarjeta)} (includes fee)`,
        cashNote: isES
            ? `Total en efectivo: ${formatCOP(reserva.precioEfectivo)}`
            : `Total in cash: ${formatCOP(reserva.precioEfectivo)}`,
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

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                    <p className="text-[#D6A75D] font-semibold text-sm uppercase tracking-widest mb-1">
                        TMT Travel
                    </p>
                    <h1 className="text-2xl font-bold text-white">{t.title}</h1>
                </div>

                <Card className="bg-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-gray-700 flex items-center justify-between">
                            <span>{reserva.nombreCliente}</span>
                            <Badge variant="outline" className="text-xs font-mono">
                                {reserva.codigo}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t.service}</span>
                            <span className="font-medium">{reserva.servicio}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t.date}</span>
                            <span className="font-medium">{reserva.fecha}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t.time}</span>
                            <span className="font-medium">{reserva.hora}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t.passengers}</span>
                            <span className="font-medium">{reserva.numeroPasajeros}</span>
                        </div>
                        {reserva.vehiculo && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t.vehicle}</span>
                                <span className="font-medium">{reserva.vehiculo}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {boldData && (
                        <div>
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

                    {boldData && (
                        <div className="flex items-center gap-2">
                            <Separator className="flex-1" />
                            <span className="text-xs text-gray-400">{isES ? 'o' : 'or'}</span>
                            <Separator className="flex-1" />
                        </div>
                    )}

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
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            </div>
        </div>
    );
}
