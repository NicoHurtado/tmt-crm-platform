import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recalcularPrecioWebDirecto, type AeropuertoNombreInput } from '@/lib/priceCalculator';
import { selectVehicleForPassengers } from '@/lib/vehicle-selector';
import { getConfiguracion } from '@/types/servicio-config';
import { getLocalizedText } from '@/types/multi-language';
import { badRequest } from './errors';

/**
 * Cotización para socios de API (`/api/socios/*`).
 *
 * El precio sale de `recalcularPrecioWebDirecto`, la misma función que usa el flujo web
 * para recalcular precios server-side. Es decir: el socio recibe exactamente el precio
 * que vería un cliente en nuestra web, con recargo nocturno y precio alterno de Olaya
 * incluidos. No hay tabla de tarifas paralela que mantener.
 *
 * No se aplica tarifa de zona (`MunicipioConfig`): los traslados de aeropuerto no la
 * cobran en la web, y se replica ese comportamiento tal cual.
 */

const SERVICIO_INCLUDE = {
    vehiculosPermitidos: {
        where: { vehiculo: { activo: true } },
        include: { vehiculo: true },
        orderBy: { vehiculo: { capacidadMaxima: 'asc' } },
    },
} satisfies Prisma.ServicioInclude;

export type ServicioCotizable = Prisma.ServicioGetPayload<{ include: typeof SERVICIO_INCLUDE }>;

export interface CotizacionInput {
    servicioId: string;
    numeroPasajeros: number;
    /** HH:MM — define si aplica el recargo nocturno. */
    hora: string;
    aeropuertoNombre?: AeropuertoNombreInput | null;
    datosDinamicos?: Record<string, unknown>;
}

export interface Cotizacion {
    servicioId: string;
    servicioNombre: string;
    vehiculo: {
        id: string;
        nombre: string;
        capacidadMinima: number;
        capacidadMaxima: number;
    };
    desglose: {
        precioBase: number;
        precioAdicionales: number;
        recargoNocturno: number;
        tarifaMunicipio: number;
    };
    total: number;
    moneda: 'COP';
}

const AEROPUERTOS: AeropuertoNombreInput[] = ['JOSE_MARIA_CORDOVA', 'OLAYA_HERRERA'];

// ── Parseo de entradas (compartido con la creación de reservas) ────────────────

export function parseFecha(valor: unknown): Date {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        badRequest('fecha debe usar formato YYYY-MM-DD');
    }
    // Mediodía UTC: así el día calendario es el mismo en UTC y en America/Bogota (UTC-5)
    // y no se corre en el calendario ni en los correos. Misma convención del resto del proyecto.
    const fecha = new Date(`${valor}T12:00:00.000Z`);
    if (Number.isNaN(fecha.getTime())) badRequest('fecha inválida');
    // Una fecha que no existe (ej. 2026-02-31) NO produce NaN: JavaScript la corre al mes
    // siguiente. Sin esta comprobación, un error de tipeo del socio crearía el traslado en
    // otro día sin avisar a nadie.
    if (fecha.toISOString().slice(0, 10) !== valor) {
        badRequest(`fecha inexistente en el calendario: ${valor}`);
    }
    return fecha;
}

export function parseHora(valor: unknown): string {
    if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
        badRequest('hora debe usar formato HH:MM (24 horas)');
    }
    return valor as string;
}

export function parseEnteroPositivo(valor: unknown, campo: string): number {
    // Solo número o cadena numérica. Sin este filtro, `Number()` convierte `true` en 1 y
    // `[2]` en 2, así que un bug del socio se colaría como una reserva silenciosamente
    // equivocada en vez de dar un error que pueda corregir.
    if (typeof valor !== 'number' && typeof valor !== 'string') {
        badRequest(`${campo} debe ser un entero mayor a 0`);
    }
    const n = typeof valor === 'number' ? valor : Number(valor);
    if (!Number.isInteger(n) || n < 1) badRequest(`${campo} debe ser un entero mayor a 0`);
    return n;
}

export function parseAeropuerto(valor: unknown): AeropuertoNombreInput | null {
    if (valor === undefined || valor === null || valor === '') return null;
    if (typeof valor !== 'string' || !AEROPUERTOS.includes(valor as AeropuertoNombreInput)) {
        badRequest(`aeropuertoNombre inválido. Valores válidos: ${AEROPUERTOS.join(', ')}`);
    }
    return valor as AeropuertoNombreInput;
}

export function parseDatosDinamicos(valor: unknown): Record<string, unknown> {
    if (valor === undefined || valor === null) return {};
    if (typeof valor !== 'object' || Array.isArray(valor)) {
        badRequest('datosDinamicos debe ser un objeto');
    }
    return valor as Record<string, unknown>;
}

// ── Cotización ────────────────────────────────────────────────────────────────

export async function cargarServicioCotizable(servicioId: unknown): Promise<ServicioCotizable> {
    if (typeof servicioId !== 'string' || !servicioId) {
        badRequest('servicioId es requerido');
    }

    const servicio = await prisma.servicio.findFirst({
        where: { id: servicioId as string, activo: true },
        include: SERVICIO_INCLUDE,
    });
    if (!servicio) badRequest('Servicio no encontrado o inactivo');

    // Los tours con tarifa por persona (tramos 1/2/3+) usan otro modelo de precio que
    // `recalcularPrecioWebDirecto` no cubre. Se rechazan en vez de devolver un precio
    // silenciosamente equivocado.
    if (getConfiguracion(servicio.configuracion).tipoTarifa === 'POR_PERSONA') {
        badRequest('Este servicio no está disponible por la API de socios');
    }

    return servicio;
}

export function cotizarServicio(servicio: ServicioCotizable, input: CotizacionInput): Cotizacion {
    if (servicio.esAeropuerto && !input.aeropuertoNombre) {
        badRequest(
            `aeropuertoNombre es requerido para este servicio. Valores válidos: ${AEROPUERTOS.join(', ')}`
        );
    }

    const vehiculo = selectVehicleForPassengers(
        servicio.vehiculosPermitidos.map((sv) => sv.vehiculo),
        input.numeroPasajeros
    );
    if (!vehiculo) {
        const capacidades = servicio.vehiculosPermitidos.map((sv) => sv.vehiculo.capacidadMaxima);
        const maxima = capacidades.length > 0 ? Math.max(...capacidades) : 0;
        badRequest(
            `No hay vehículo disponible para ${input.numeroPasajeros} pasajeros (capacidad máxima: ${maxima})`
        );
    }

    const cantidadHoras = Number(input.datosDinamicos?.cantidadHoras);

    const desglose = recalcularPrecioWebDirecto({
        servicio,
        vehiculoId: vehiculo.id,
        numeroPasajeros: input.numeroPasajeros,
        cantidadHoras: Number.isFinite(cantidadHoras) && cantidadHoras > 0 ? cantidadHoras : null,
        hora: input.hora,
        datosDinamicos: (input.datosDinamicos ?? {}) as any,
        aeropuertoNombre: input.aeropuertoNombre ?? null,
        // Sin zona: los traslados de aeropuerto no cobran tarifa de municipio en la web.
        // `municipio` va en null a propósito — con 'OTRO' la función devuelve todo en cero.
        municipio: null,
        municipioConfigId: null,
        municipioConfigRecargo: 0,
    });

    const total =
        desglose.precioBase +
        desglose.precioAdicionales +
        desglose.recargoNocturno +
        desglose.tarifaMunicipio;

    // Falta de configuración de nuestro lado, no un error del socio. Aun así se responde
    // 400 y no 500: reintentar no lo arregla, hace falta que alguien cargue el precio en
    // el admin. El mensaje lo dice para que el socio sepa que debe avisarnos.
    if (!Number.isFinite(total) || total <= 0) {
        badRequest(
            `El servicio no tiene precio configurado para el vehículo de ${input.numeroPasajeros} pasajeros. Avísanos para corregirlo.`
        );
    }

    return {
        servicioId: servicio.id,
        servicioNombre: getLocalizedText(servicio.nombre, 'ES'),
        vehiculo: {
            id: vehiculo.id,
            nombre: vehiculo.nombre,
            capacidadMinima: vehiculo.capacidadMinima,
            capacidadMaxima: vehiculo.capacidadMaxima,
        },
        desglose,
        total,
        moneda: 'COP',
    };
}

/** Cotiza cargando el servicio desde la base de datos. */
export async function cotizar(input: CotizacionInput): Promise<Cotizacion> {
    const servicio = await cargarServicioCotizable(input.servicioId);
    return cotizarServicio(servicio, input);
}
