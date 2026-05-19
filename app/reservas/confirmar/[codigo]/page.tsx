import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { generateBoldHash, boldConfig } from '@/lib/bold';
import { ConfirmarReservaClient } from './ConfirmarReservaClient';
import type { Metadata } from 'next';

interface Props {
    params: { codigo: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return { title: `Confirmar Reserva ${params.codigo} | TMT Travel` };
}

export default async function ConfirmarReservaPage({ params }: Props) {
    const reserva = await prisma.reserva.findUnique({
        where: { codigo: params.codigo },
        include: { servicio: true, vehiculo: true },
    });

    if (!reserva) notFound();

    // CR-01: State guard — non-PENDING_PAYMENT reservations skip Bold entirely
    if (reserva.estado !== 'PENDING_PAYMENT') {
        return (
            <ConfirmarReservaClient
                reserva={{
                    codigo: reserva.codigo,
                    nombreCliente: reserva.nombreCliente,
                    servicio: '',
                    fecha: '',
                    hora: '',
                    numeroPasajeros: 0,
                    precioConTarjeta: 0,
                    precioEfectivo: 0,
                    estado: reserva.estado,
                    idioma: (reserva.idioma as 'ES' | 'EN') ?? 'ES',
                    vehiculo: null,
                }}
                boldData={null}
            />
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';

    // CR-02: Bold public key validation — degrade gracefully if key is missing
    const boldPublicKey = boldConfig.publicKeyClient;
    const boldHash = boldPublicKey
        ? generateBoldHash(reserva.codigo, Number(reserva.precioTotal), 'COP')
        : '';

    const nombreServicio =
        (reserva.servicio?.nombre as { es: string; en: string } | null)?.[
            reserva.idioma === 'EN' ? 'en' : 'es'
        ] ?? '';

    const precioSinBold = Number(reserva.precioTotal) - Number(reserva.comisionBold ?? 0);

    const boldDataProp = boldPublicKey
        ? {
              publicKey: boldPublicKey,
              orderId: reserva.codigo,
              amount: Number(reserva.precioTotal),
              currency: 'COP',
              integrity: boldHash,
              redirectionUrl: `${appUrl}/reservas/confirmar/${reserva.codigo}/gracias`,
          }
        : null;

    return (
        <ConfirmarReservaClient
            reserva={{
                codigo: reserva.codigo,
                nombreCliente: reserva.nombreCliente,
                servicio: nombreServicio,
                fecha: reserva.fecha.toISOString().split('T')[0],
                hora: reserva.hora,
                numeroPasajeros: reserva.numeroPasajeros,
                precioConTarjeta: Number(reserva.precioTotal),
                precioEfectivo: precioSinBold,
                estado: reserva.estado,
                idioma: (reserva.idioma as 'ES' | 'EN') ?? 'ES',
                vehiculo: reserva.vehiculo?.nombre ?? null,
            }}
            boldData={boldDataProp}
        />
    );
}
