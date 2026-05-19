import { Prisma } from '@prisma/client';

// Vehicle selection based on passenger count
export interface Vehicle {
    id: string;
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
    imagen: string;
}

export function selectVehicleForPassengers(
    vehicles: Vehicle[],
    passengerCount: number
): Vehicle | null {
    // Filter vehicles that can accommodate the passenger count
    const suitableVehicles = vehicles.filter(
        v => passengerCount >= v.capacidadMinima && passengerCount <= v.capacidadMaxima
    );

    if (suitableVehicles.length === 0) {
        return null;
    }

    // Return the vehicle with the smallest capacity that fits
    // (most economical option)
    return suitableVehicles.reduce((prev, current) => {
        return current.capacidadMaxima < prev.capacidadMaxima ? current : prev;
    });
}

export async function getVehicleForPassengers(
    passengerCount: number,
    prismaClient: Prisma.TransactionClient
): Promise<Vehicle | null> {
    const vehiculos = await prismaClient.vehiculo.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, capacidadMinima: true, capacidadMaxima: true, imagen: true },
    });
    return selectVehicleForPassengers(vehiculos, passengerCount);
}
