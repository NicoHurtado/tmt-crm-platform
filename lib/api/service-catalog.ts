import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLocalizedText } from '@/types/multi-language';
import {
    buildFullSystemPrompt,
    formatServicioContext,
    type ServicioContextData,
} from '@/lib/n8n/formatServicioContext';

export const PRICE_SOURCE = 'ServicioVehiculo.precio' as const;
export const PRICE_TYPE = 'independiente' as const;

export type CatalogLanguage = 'ES' | 'EN';

export type CatalogService = {
    id: string;
    tipo: string;
    nombre: string;
    nombreES: string;
    nombreEN: string;
    descripcion: string;
    descripcionES: string;
    descripcionEN: string;
    incluye: unknown;
    precioDesde: number;
    duracion: string | null;
    esAeropuerto: boolean;
    esPorHoras: boolean;
    esMunicipal: boolean;
    aplicaRecargoNocturno: boolean;
    recargoNocturno: {
        aplica: boolean;
        inicio?: string | null;
        fin?: string | null;
        monto?: number | null;
    };
    configuracion: unknown;
    linkReserva: string;
    vehiculos: {
        id: string;
        nombre: string;
        capacidadMinima: number;
        capacidadMaxima: number;
        precio: number;
        precioOrigen: typeof PRICE_SOURCE;
        tipoPrecio: typeof PRICE_TYPE;
    }[];
    precioOrigen: typeof PRICE_SOURCE;
    tipoPrecio: typeof PRICE_TYPE;
};

type ServicioWithVehiculos = Prisma.ServicioGetPayload<{
    include: {
        vehiculosPermitidos: {
            include: { vehiculo: true };
        };
    };
}>;

function appBaseUrl(appUrl?: string): string {
    return (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com').replace(/\/$/, '');
}

export async function fetchActiveCatalogServices(): Promise<ServicioWithVehiculos[]> {
    return prisma.servicio.findMany({
        where: { activo: true },
        include: {
            vehiculosPermitidos: {
                where: { vehiculo: { activo: true } },
                include: { vehiculo: true },
                orderBy: { vehiculo: { capacidadMaxima: 'asc' } },
            },
        },
        orderBy: { orden: 'asc' },
    });
}

export function toServicioContextData(rawServicios: ServicioWithVehiculos[]): ServicioContextData[] {
    return rawServicios.map((s) => ({
        id: s.id,
        tipoServicio: s.tipoServicio,
        nombre: s.nombre,
        descripcion: s.descripcion,
        incluye: s.incluye,
        duracion: s.duracion,
        aplicaRecargoNocturno: s.aplicaRecargoNocturno,
        recargoNocturnoInicio: s.recargoNocturnoInicio ?? null,
        recargoNocturnoFin: s.recargoNocturnoFin ?? null,
        montoRecargoNocturno: s.montoRecargoNocturno ? Number(s.montoRecargoNocturno) : null,
        esPorHoras: s.esPorHoras,
        esMunicipal: s.esMunicipal,
        configuracion: s.configuracion,
        vehiculosPermitidos: s.vehiculosPermitidos.map((sv) => ({
            precio: sv.precio ? Number(sv.precio) : null,
            vehiculo: {
                nombre: sv.vehiculo.nombre,
                capacidadMinima: sv.vehiculo.capacidadMinima,
                capacidadMaxima: sv.vehiculo.capacidadMaxima,
            },
        })),
    }));
}

export function toCatalogServices(
    rawServicios: ServicioWithVehiculos[],
    lang: CatalogLanguage = 'ES',
    appUrl?: string
): CatalogService[] {
    const base = appBaseUrl(appUrl);

    return rawServicios.map((s) => {
        const precios = s.vehiculosPermitidos
            .map((sv) => Number(sv.precio ?? 0))
            .filter((p) => p > 0);

        return {
            id: s.id,
            tipo: s.tipoServicio,
            nombre: getLocalizedText(s.nombre, lang),
            nombreES: getLocalizedText(s.nombre, 'ES'),
            nombreEN: getLocalizedText(s.nombre, 'EN'),
            descripcion: getLocalizedText(s.descripcion, lang),
            descripcionES: getLocalizedText(s.descripcion, 'ES'),
            descripcionEN: getLocalizedText(s.descripcion, 'EN'),
            incluye: s.incluye,
            precioDesde: precios.length > 0 ? Math.min(...precios) : 0,
            duracion: s.duracion,
            esAeropuerto: s.esAeropuerto,
            esPorHoras: s.esPorHoras,
            esMunicipal: s.esMunicipal,
            aplicaRecargoNocturno: s.aplicaRecargoNocturno,
            recargoNocturno: s.aplicaRecargoNocturno
                ? {
                      aplica: true,
                      inicio: s.recargoNocturnoInicio,
                      fin: s.recargoNocturnoFin,
                      monto: s.montoRecargoNocturno ? Number(s.montoRecargoNocturno) : null,
                  }
                : { aplica: false },
            configuracion: s.configuracion,
            linkReserva: `${base}/reservas?serviceId=${s.id}&form=1`,
            vehiculos: s.vehiculosPermitidos.map((sv) => ({
                id: sv.vehiculo.id,
                nombre: sv.vehiculo.nombre,
                capacidadMinima: sv.vehiculo.capacidadMinima,
                capacidadMaxima: sv.vehiculo.capacidadMaxima,
                precio: Number(sv.precio ?? 0),
                precioOrigen: PRICE_SOURCE,
                tipoPrecio: PRICE_TYPE,
            })),
            precioOrigen: PRICE_SOURCE,
            tipoPrecio: PRICE_TYPE,
        };
    });
}

export async function buildCatalogJson(lang: CatalogLanguage = 'ES', appUrl?: string) {
    const rawServicios = await fetchActiveCatalogServices();
    const servicios = toCatalogServices(rawServicios, lang, appUrl);

    return {
        empresa: 'TMT Travel — Transportes Medellín',
        sitioWeb: appBaseUrl(appUrl),
        moneda: 'COP',
        actualizadoEn: new Date().toISOString(),
        totalServicios: servicios.length,
        precioOrigen: PRICE_SOURCE,
        tipoPrecio: PRICE_TYPE,
        servicios,
    };
}

export async function buildCatalogText(
    formato: 'contexto' | 'texto',
    appUrl?: string
) {
    const rawServicios = await fetchActiveCatalogServices();
    const servicios = toServicioContextData(rawServicios);
    const texto =
        formato === 'contexto'
            ? buildFullSystemPrompt(servicios, appUrl)
            : formatServicioContext(servicios, appUrl);

    return {
        empresa: 'TMT Travel — Transportes Medellín',
        sitioWeb: appBaseUrl(appUrl),
        formato,
        actualizadoEn: new Date().toISOString(),
        totalServicios: servicios.length,
        precioOrigen: PRICE_SOURCE,
        tipoPrecio: PRICE_TYPE,
        contenido: texto,
        systemPrompt: texto,
        servicios,
    };
}
