import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const isTestMode = process.env.BOLD_MODE === 'test';

        const config = {
            publicKey: isTestMode
                ? process.env.NEXT_PUBLIC_BOLD_PUBLIC_KEY_TEST
                : process.env.NEXT_PUBLIC_BOLD_PUBLIC_KEY,
            isTestMode,
            redirectUrl: process.env.NEXT_PUBLIC_APP_URL
                ? `${process.env.NEXT_PUBLIC_APP_URL}/payment/result`
                : 'http://localhost:3001/payment/result',
        };

        return NextResponse.json(config);
    } catch (error) {
        console.error('[bold/config] Error:', error);
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    }
}
