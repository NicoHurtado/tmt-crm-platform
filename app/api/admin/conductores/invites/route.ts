import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const INVITE_TTL_DAYS = 30;

/** Base pública del sitio: preferimos la config explícita y caemos al origin del request. */
function resolveBaseUrl(request: Request): string {
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    if (configured) return configured.replace(/\/$/, '');

    const origin = request.headers.get('origin');
    if (origin) return origin.replace(/\/$/, '');

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    return host ? `${proto}://${host}` : '';
}

/**
 * POST /api/admin/conductores/invites
 * Genera un link de registro reutilizable: cualquier cantidad de conductores
 * puede registrarse con el mismo link mientras no expire.
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

        const invite = await prisma.conductorInvite.create({
            data: {
                token,
                expiresAt,
                createdBy: (session.user as any)?.email || null,
            },
        });

        const url = `${resolveBaseUrl(request)}/conductor/registro/${token}`;

        return NextResponse.json({
            data: { token: invite.token, expiresAt: invite.expiresAt, url, ttlDays: INVITE_TTL_DAYS },
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating conductor invite:', error);
        return NextResponse.json({ error: 'Error al generar invitación' }, { status: 500 });
    }
}
