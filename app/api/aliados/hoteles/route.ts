import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/aliados/hoteles
 * Endpoint público (sin auth) que devuelve los aliados (Hoteles y Airbnbs) activos
 * para mostrarlos como cards en la página pública de reservas.
 * Solo expone los campos necesarios para la card (nombre, contacto/WhatsApp, imagen, tipo).
 */
export async function GET() {
    try {
        const hoteles = await prisma.aliado.findMany({
            // Solo aliados activos. Hoteles y Airbnbs se muestran en /reservas;
            // agencias quedan fuera por ahora (la consulta es trivial de extender).
            where: { tipo: { in: ['HOTEL', 'AIRBNB'] }, activo: true },
            select: { id: true, nombre: true, contacto: true, imagen: true, tipo: true },
            orderBy: { nombre: 'asc' },
        });

        return NextResponse.json({ success: true, data: hoteles });
    } catch (error) {
        console.error('Error fetching hoteles aliados:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener hoteles' },
            { status: 500 }
        );
    }
}
