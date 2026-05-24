import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const INVITE_TTL_DAYS = 7;

/**
 * POST /api/admin/conductores/invites
 * Genera un link único para que un conductor se auto-registre.
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

        const origin = request.headers.get('origin') || request.headers.get('host') || '';
        const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
        const url = `${baseUrl}/conductor/registro/${token}`;

        return NextResponse.json({
            data: { token: invite.token, expiresAt: invite.expiresAt, url },
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating conductor invite:', error);
        return NextResponse.json({ error: 'Error al generar invitación' }, { status: 500 });
    }
}
