import { NextRequest, NextResponse } from 'next/server';
import { checkExternalApiKey, externalUnauthorized } from '../_auth';
import {
    createExternalReserva,
    formatExternalReserva,
    listExternalReservas,
} from '@/lib/api/external-reservas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    if (!checkExternalApiKey(request)) return externalUnauthorized();

    try {
        const { searchParams } = new URL(request.url);
        const reservas = await listExternalReservas(searchParams);
        return NextResponse.json({
            success: true,
            count: reservas.length,
            data: reservas.map(formatExternalReserva),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
    }
}

export async function POST(request: NextRequest) {
    if (!checkExternalApiKey(request)) return externalUnauthorized();

    try {
        const body = await request.json();
        const reserva = await createExternalReserva(body);
        return NextResponse.json(
            {
                success: true,
                data: formatExternalReserva(reserva),
                message: 'Reserva creada exitosamente',
            },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
    }
}
