/**
 * Datos personales (estables) de un cliente que ya reservó o cotizó antes.
 * Solo nombre, contacto, idioma y documento: nada del servicio, fecha, dirección
 * ni precio, que cambian en cada cotización.
 */
export interface ClienteEncontrado {
    nombre: string;
    whatsapp: string;
    email: string;
    idioma: 'ES' | 'EN';
    tipoDocumento: string | null;
    numeroDocumento: string | null;
    ultimaReserva: string; // ISO
    totalReservas: number;
}

/** Dígitos finales del celular: así cuadra "+57 300 123 4567" con "3001234567". */
export const ultimosDigitos = (telefono: string, n = 10) => telefono.replace(/\D/g, '').slice(-n);

/** Documento comparable: sin puntos, guiones ni espacios, en mayúscula (pasaportes). */
export const normalizarDocumento = (doc: string) => doc.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
