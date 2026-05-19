/**
 * Utilidades para manejar el flujo de pago de Tour Compartido
 * 
 * Para usuarios regulares: Los datos se guardan temporalmente y la reserva
 * se crea solo después de confirmar el pago con Bold.
 * 
 * Para hoteles: La reserva se crea inmediatamente, independientemente del método de pago.
 */

import { ReservationFormData } from '@/types/reservation';

const STORAGE_KEY = 'tour_compartido_pending_reservation';
const EXPIRATION_MINUTES = 30;

export interface PendingTourCompartidoData {
    formData: any; // Datos del formulario de reserva
    timestamp: number;
    hashPago: string;
}

/**
 * Guarda los datos de una reserva de Tour Compartido pendiente de pago
 */
export function savePendingReservation(formData: any, hashPago: string): void {
    const data: PendingTourCompartidoData = {
        formData,
        hashPago,
        timestamp: Date.now(),
    };

    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('✅ Datos de Tour Compartido guardados temporalmente');
    } catch (error) {
        console.error('❌ Error guardando datos temporales:', error);
        throw new Error('No se pudieron guardar los datos de la reserva');
    }
}

/**
 * Recupera los datos de una reserva de Tour Compartido pendiente
 * Retorna null si no hay datos o si han expirado
 */
export function getPendingReservation(): PendingTourCompartidoData | null {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }

        const data: PendingTourCompartidoData = JSON.parse(stored);

        // Verificar si los datos han expirado (30 minutos)
        const expirationTime = data.timestamp + (EXPIRATION_MINUTES * 60 * 1000);
        if (Date.now() > expirationTime) {
            console.log('⏰ Datos de Tour Compartido expirados');
            clearPendingReservation();
            return null;
        }

        return data;
    } catch (error) {
        console.error('❌ Error recuperando datos temporales:', error);
        return null;
    }
}

/**
 * Limpia los datos de reserva pendiente
 */
export function clearPendingReservation(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
        console.log('🗑️ Datos de Tour Compartido eliminados');
    } catch (error) {
        console.error('❌ Error limpiando datos temporales:', error);
    }
}

/**
 * Verifica si hay una reserva pendiente
 */
export function hasPendingReservation(): boolean {
    return getPendingReservation() !== null;
}

/**
 * Calcula el precio total con comisión de Bold (6%)
 */
export function calculateBoldPrice(basePrice: number): number {
    return basePrice * 1.06;
}

/**
 * Calcula la comisión de Bold (6% del precio base)
 */
export function calculateBoldCommission(basePrice: number): number {
    return basePrice * 0.06;
}

/**
 * Formatea un precio para mostrar en COP
 */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
}
