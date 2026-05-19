import { Municipio } from '@prisma/client';

// Municipality pricing (in COP)
export const MUNICIPALITY_PRICES: Record<Municipio, number> = {
    MEDELLIN: 0,
    POBLADO: 0,
    LAURELES: 0,
    SABANETA: 15000,
    BELLO: 18000,
    ITAGUI: 12000,
    ENVIGADO: 10000,
    OTRO: 0, // Requires manual quote
};

interface PricingInput {
    basePrice: number;
    vehiclePrice?: number;
    municipality: Municipio;
    nightSurcharge?: number;
    allyDiscount?: number;
    additionals?: number;
}

interface PricingBreakdown {
    basePrice: number;
    vehiclePrice: number;
    subtotal: number;
    municipalityFee: number;
    nightSurcharge: number;
    allyDiscount: number;
    additionals: number;
    total: number;
}

export function calculateTotalPrice(input: PricingInput): PricingBreakdown {
    const {
        basePrice,
        vehiclePrice = 0,
        municipality,
        nightSurcharge = 0,
        allyDiscount = 0,
        additionals = 0,
    } = input;

    const municipalityFee = MUNICIPALITY_PRICES[municipality] || 0;
    const subtotal = basePrice + vehiclePrice + additionals;
    const total = subtotal + municipalityFee + nightSurcharge - allyDiscount;

    return {
        basePrice,
        vehiclePrice,
        subtotal,
        municipalityFee,
        nightSurcharge,
        allyDiscount,
        additionals,
        total: Math.max(0, total), // Ensure non-negative
    };
}

// Check if time falls within night surcharge period
export function isNightSurchargeApplicable(
    time: string, // HH:mm format
    startTime: string | null,
    endTime: string | null
): boolean {
    if (!startTime || !endTime) return false;

    const [hours, minutes] = time.split(':').map(Number);
    const [startHours, startMinutesRaw] = startTime.split(':').map(Number);
    const [endHours, endMinutesRaw] = endTime.split(':').map(Number);

    const timeMinutes = hours * 60 + minutes;
    const startMinutes = startHours * 60 + startMinutesRaw;
    const endMinutes = endHours * 60 + endMinutesRaw;

    // Handle overnight periods (e.g., 22:00 - 06:00)
    if (startMinutes > endMinutes) {
        return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

// Format price for display
export function formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
