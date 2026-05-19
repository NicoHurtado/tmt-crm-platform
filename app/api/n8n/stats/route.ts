import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkApiKey, unauthorized } from '../_auth';

export const dynamic = 'force-dynamic';

/** GET /api/n8n/stats — Operational dashboard stats */
export async function GET(request: NextRequest) {
    if (!checkApiKey(request)) return unauthorized();

    try {
        const now = new Date();
        const hoyStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const hoyEnd = new Date(hoyStart.getTime() + 86400000);
        const semanaStart = new Date(hoyStart.getTime() - 6 * 86400000);
        const mesStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const mesEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const [
            reservasHoy,
            reservasSemana,
            reservasPorEstado,
            ingresosMes,
            conductoresDisponibles,
            totalReservasActivas,
        ] = await Promise.all([
            prisma.reserva.count({ where: { fecha: { gte: hoyStart, lt: hoyEnd } } }),
            prisma.reserva.count({ where: { fecha: { gte: semanaStart, lt: hoyEnd } } }),
            prisma.reserva.groupBy({ by: ['estado'], _count: { estado: true } }),
            prisma.reserva.aggregate({
                _sum: { precioTotal: true },
                where: {
                    fecha: { gte: mesStart, lte: mesEnd },
                    estado: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] },
                    estadoPago: 'APROBADO',
                },
            }),
            prisma.conductor.count({ where: { activo: true, disponible: true } }),
            prisma.reserva.count({
                where: { estado: { notIn: ['COMPLETED', 'CANCELLED'] } },
            }),
        ]);

        const estadoMap: Record<string, number> = {};
        reservasPorEstado.forEach(e => { estadoMap[e.estado] = e._count.estado; });

        return NextResponse.json({
            success: true,
            data: {
                reservasHoy,
                reservasSemana,
                totalActivas: totalReservasActivas,
                conductoresDisponibles,
                ingresosMesCOP: Number(ingresosMes._sum.precioTotal || 0),
                porEstado: estadoMap,
                generadoEn: now.toISOString(),
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
