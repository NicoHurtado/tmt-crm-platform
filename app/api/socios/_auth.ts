import { NextRequest, NextResponse } from 'next/server';
import { Socio } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Resuelve el header `x-api-key` al socio activo correspondiente.
 * Devuelve null si falta la llave, no existe o el socio está desactivado —
 * desactivar un socio (`activo: false`) es la forma de cortarle el acceso sin borrar
 * su histórico de reservas.
 */
export async function resolveSocio(request: NextRequest): Promise<Socio | null> {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) return null;

    const socio = await prisma.socio.findUnique({ where: { apiKey } });
    if (!socio || !socio.activo) return null;

    return socio;
}

export function socioUnauthorized() {
    return NextResponse.json(
        { ok: false, error: 'Llave de API inválida o inactiva' },
        { status: 401 }
    );
}
