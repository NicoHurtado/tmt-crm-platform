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
 * GET /api/admin/conductores/invites
 * Lista los links todavía vigentes, para poder verlos y anularlos.
 */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const invites = await prisma.conductorInvite.findMany({
            where: { expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
        });

        const base = resolveBaseUrl(request);
        return NextResponse.json({
            data: invites.map((i) => ({
                token: i.token,
                url: `${base}/conductor/registro/${i.token}`,
                expiresAt: i.expiresAt,
                usedAt: i.usedAt,
                createdAt: i.createdAt,
                createdBy: i.createdBy,
            })),
        });
    } catch (error) {
        console.error('Error listing conductor invites:', error);
        return NextResponse.json({ error: 'Error al listar invitaciones' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/conductores/invites?token=...
 * Anula un link. No borra la fila: le adelanta la expiración, con lo que
 * `checkInvite` empieza a rechazarlo de inmediato y se conserva el rastro de
 * quién lo creó y cuándo se usó por última vez.
 */
export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = new URL(request.url).searchParams.get('token');
        if (!token) {
            return NextResponse.json({ error: 'Falta el token' }, { status: 400 });
        }

        const invite = await prisma.conductorInvite.findUnique({ where: { token } });
        if (!invite) {
            return NextResponse.json({ error: 'Ese link no existe' }, { status: 404 });
        }

        // Un segundo atrás y no `ahora`: checkInvite compara con `<`, así que
        // dejarlo exactamente en el instante actual lo daría por válido durante
        // ese milisegundo.
        await prisma.conductorInvite.update({
            where: { token },
            data: { expiresAt: new Date(Date.now() - 1000) },
        });

        return NextResponse.json({ data: { token, revoked: true } });
    } catch (error) {
        console.error('Error revoking conductor invite:', error);
        return NextResponse.json({ error: 'Error al anular el link' }, { status: 500 });
    }
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
