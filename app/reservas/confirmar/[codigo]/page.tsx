import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { generateBoldHash, boldConfig } from '@/lib/bold';
import { getConfiguracion } from '@/types/servicio-config';
import { validateDynamicFieldsSafe } from '@/types/dynamic-fields';
import { getDatos } from '@/types/reserva-datos';
import { ConfirmarReservaClient, type DetalleCotizacion } from './ConfirmarReservaClient';
import type { Metadata } from 'next';

interface Props {
    params: { codigo: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    return { title: `Cotización ${params.codigo} | TMT Travel`, robots: { index: false, follow: false } };
}

const NOMBRE_AEROPUERTO: Record<string, string> = {
    JOSE_MARIA_CORDOVA: 'José María Córdova (Rionegro)',
    OLAYA_HERRERA: 'Olaya Herrera (Medellín)',
};

const NOMBRE_MUNICIPIO: Record<string, string> = {
    MEDELLIN: 'Medellín',
    POBLADO: 'El Poblado',
    LAURELES: 'Laureles',
    SABANETA: 'Sabaneta',
    BELLO: 'Bello',
    ITAGUI: 'Itagüí',
    ENVIGADO: 'Envigado',
};

/** Adicionales elegidos (etiquetas legibles) a partir de los datos guardados y la config del servicio. */
function adicionalesElegidos(configuracion: unknown, datos: Record<string, unknown>, en: boolean): string[] {
    const campos = validateDynamicFieldsSafe(getConfiguracion(configuracion).camposCustom);
    const out: string[] = [];
    for (const campo of campos) {
        const valor = datos[campo.clave];
        if (valor === undefined || valor === null || valor === false || valor === '' || valor === 0) continue;
        const etiqueta = (en ? campo.etiqueta.en : campo.etiqueta.es) || campo.etiqueta.es;
        if (campo.tipo === 'SWITCH') out.push(etiqueta);
        else if (campo.tipo === 'COUNTER') out.push(`${etiqueta} × ${Number(valor)}`);
        else out.push(`${etiqueta}: ${String(valor)}`);
    }
    return out;
}

export default async function ConfirmarReservaPage({ params }: Props) {
    const reserva = await prisma.reserva.findUnique({
        where: { codigo: params.codigo },
        include: { servicio: true, vehiculo: true, aliado: { select: { soloPagoTarjeta: true, soloPagoEfectivo: true } } },
    });

    if (!reserva) notFound();

    const idioma = (reserva.idioma as 'ES' | 'EN') ?? 'ES';
    const en = idioma === 'EN';

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
                    idioma,
                    vehiculo: null,
                }}
                boldData={null}
            />
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';

    // CR-02: Bold public key validation — degrade gracefully if key is missing
    const boldPublicKey = boldConfig.publicKey || boldConfig.publicKeyClient;
    const boldHash = boldPublicKey
        ? generateBoldHash(reserva.codigo, Math.round(Number(reserva.precioTotal)), 'COP')
        : '';

    const nombreServicio =
        (reserva.servicio?.nombre as { es: string; en: string } | null)?.[en ? 'en' : 'es'] ?? '';

    const precioSinBold = Number(reserva.precioTotal) - Number(reserva.comisionBold ?? 0);

    // Las cotizaciones del agente de WhatsApp se aseguran con pago en Bold (no se ofrece efectivo).
    const esWhatsApp = reserva.origen === 'whatsapp_bot';

    // Aliado "solo efectivo": no se ofrece Bold.
    const boldDataProp = boldPublicKey && !reserva.aliado?.soloPagoEfectivo
        ? {
              publicKey: boldPublicKey,
              orderId: reserva.codigo,
              amount: Math.round(Number(reserva.precioTotal)),
              currency: 'COP',
              integrity: boldHash,
              // /payment/result confirma el pago al volver de Bold (con reintentos) y muestra el resultado.
              redirectionUrl: `${appUrl}/payment/result`,
          }
        : null;

    const datos = getDatos(reserva.datos) as Record<string, unknown>;
    const aeropuerto = (reserva.aeropuertoNombre ?? datos.aeropuertoNombre) as string | undefined;
    const municipioTexto = reserva.otroMunicipio
        || (reserva.municipio && reserva.municipio !== 'OTRO' ? NOMBRE_MUNICIPIO[reserva.municipio] : null);

    const detalle: DetalleCotizacion = {
        aeropuertoTipo: (datos.aeropuertoTipo as 'DESDE' | 'HACIA' | undefined) ?? null,
        aeropuerto: aeropuerto ? NOMBRE_AEROPUERTO[aeropuerto] ?? aeropuerto : null,
        numeroVuelo: (datos.numeroVuelo as string | undefined) ?? null,
        lugarRecogida: (datos.lugarRecogida as string | undefined) ?? null,
        trasladoDestino: (datos.trasladoDestino as string | undefined) ?? null,
        municipio: municipioTexto,
        cantidadHoras: datos.cantidadHoras != null ? Number(datos.cantidadHoras) : null,
        adicionales: adicionalesElegidos(reserva.servicio?.configuracion, datos, en),
        notas: reserva.notas,
        email: reserva.emailCliente,
        whatsapp: reserva.whatsappCliente,
        precioBase: Number(reserva.precioBase),
        precioAdicionales: Number(reserva.precioAdicionales),
        recargoNocturno: Number(reserva.recargoNocturno),
        tarifaMunicipio: Number(reserva.tarifaMunicipio),
        comisionBold: Number(reserva.comisionBold ?? 0),
        vigencia: `${new Date().getFullYear()}-12-31`,
    };

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
                idioma,
                vehiculo: reserva.vehiculo?.nombre ?? null,
                soloPagoTarjeta: esWhatsApp || !!reserva.aliado?.soloPagoTarjeta,
            }}
            boldData={boldDataProp}
            detalle={detalle}
        />
    );
}
