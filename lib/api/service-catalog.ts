import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getLocalizedText } from '@/types/multi-language';
import { getConfiguracion } from '@/types/servicio-config';
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
    // Tarifa por persona: 'POR_PERSONA' => el precio es por persona (tramos 1/2/3+), no por vehículo.
    tipoTarifa: 'POR_PERSONA' | null;
    preciosPorPersona: { p1: number; p2: number; p3: number } | null;
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
        // Precio alterno para aeropuerto Olaya Herrera (null si no aplica/no configurado).
        precioOlaya: number | null;
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
        orderBy: { createdAt: 'asc' },
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
        esAeropuerto: s.esAeropuerto,
        esCompartido: s.esCompartido,
        esTraslado: s.esTraslado,
        vehiculosPermitidos: s.vehiculosPermitidos.map((sv) => ({
            precio: sv.precio ? Number(sv.precio) : null,
            precioOlaya: (sv as any).precioOlaya != null ? Number((sv as any).precioOlaya) : null,
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
        const cfg = getConfiguracion(s.configuracion);
        const esPorPersona = cfg.tipoTarifa === 'POR_PERSONA';
        const pp = esPorPersona ? cfg.preciosPorPersona ?? null : null;

        const precios = s.vehiculosPermitidos
            .map((sv) => Number(sv.precio ?? 0))
            .filter((p) => p > 0);

        // Para tours por persona, el precio de referencia es el precio por persona (p1),
        // igual que se muestra en la web. No se exponen vehículos (no aplican).
        const precioDesde = esPorPersona
            ? Number(pp?.p1 ?? 0)
            : precios.length > 0 ? Math.min(...precios) : 0;

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
            precioDesde,
            tipoTarifa: esPorPersona ? 'POR_PERSONA' : null,
            preciosPorPersona: pp,
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
            vehiculos: esPorPersona ? [] : s.vehiculosPermitidos.map((sv) => ({
                id: sv.vehiculo.id,
                nombre: sv.vehiculo.nombre,
                capacidadMinima: sv.vehiculo.capacidadMinima,
                capacidadMaxima: sv.vehiculo.capacidadMaxima,
                precio: Number(sv.precio ?? 0),
                precioOlaya: s.esAeropuerto && (sv as any).precioOlaya != null ? Number((sv as any).precioOlaya) : null,
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

const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');
function normTxt(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(COMBINING, '').trim();
}

export interface CatalogMatch {
    id: string;
    nombre: string;
    categoria: string;
    precioDesde: number;
    esMunicipal: boolean;
    linkReserva: string;
}

export function searchCatalogServices(servicios: CatalogService[], q: string): CatalogMatch[] {
    const nq = normTxt(q || '');
    if (!nq) return [];
    return servicios
        .filter((s) => {
            const es = normTxt(s.nombreES);
            const en = normTxt(s.nombreEN);
            return es.includes(nq) || en.includes(nq) || nq.includes(es);
        })
        .map((s) => ({
            id: s.id,
            nombre: s.nombreES,
            categoria: s.esMunicipal
                ? 'MUNICIPAL'
                : s.esAeropuerto
                ? 'AEROPUERTO'
                : s.tipoTarifa === 'POR_PERSONA'
                ? 'TOUR_PERSONA'
                : 'SERVICIO',
            precioDesde: s.precioDesde,
            esMunicipal: s.esMunicipal,
            linkReserva: s.linkReserva,
        }));
}

export async function buildCatalogText(
    formato: 'contexto' | 'texto',
    appUrl?: string,
    toolMode?: boolean
) {
    const rawServicios = await fetchActiveCatalogServices();
    const servicios = toServicioContextData(rawServicios);
    const texto =
        formato === 'contexto'
            ? buildFullSystemPrompt(servicios, appUrl, toolMode)
            : formatServicioContext(servicios, appUrl, toolMode);

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
