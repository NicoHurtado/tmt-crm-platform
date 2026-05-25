import { NextRequest, NextResponse } from 'next/server';
import { checkExternalApiKey, externalUnauthorized } from '../../_auth';
import {
    cancelExternalReserva,
    formatExternalReserva,
    getExternalReserva,
    updateExternalReserva,
} from '@/lib/api/external-reservas';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { codigo: string } }
) {
    if (!checkExternalApiKey(request)) return externalUnauthorized();

    try {
        const reserva = await getExternalReserva(params.codigo);
        if (!reserva) {
            return NextResponse.json({ success: false, error: 'Reserva no encontrada' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: formatExternalReserva(reserva) });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { codigo: string } }
) {
    if (!checkExternalApiKey(request)) return externalUnauthorized();

    try {
        const body = await request.json();
        const reserva = await updateExternalReserva(params.codigo, body);
        return NextResponse.json({
            success: true,
            data: formatExternalReserva(reserva),
            message: 'Reserva actualizada exitosamente',
        });
    } catch (error: any) {
        const status = String(error?.message || error).includes('no encontrada') ? 404 : 400;
        return NextResponse.json({ success: false, error: String(error?.message || error) }, { status });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { codigo: string } }
) {
    if (!checkExternalApiKey(request)) return externalUnauthorized();

    try {
        const reserva = await cancelExternalReserva(params.codigo);
        return NextResponse.json({
            success: true,
            data: formatExternalReserva(reserva),
            message: 'Reserva cancelada exitosamente',
        });
    } catch (error: any) {
        const status = error?.code === 'P2025' ? 404 : 400;
        return NextResponse.json({ success: false, error: String(error?.message || error) }, { status });
    }
}
