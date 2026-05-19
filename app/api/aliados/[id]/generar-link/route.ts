import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/aliados/[id]/generar-link
 * Generate (or regenerate) a unique share link token for an aliado
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Derive base URL from the incoming request so dev shows localhost
        // and prod shows the real domain — no hardcoded env var needed.
        const origin = req.headers.get('origin') ||
            `${req.nextUrl.protocol}//${req.nextUrl.host}`;

        const token = crypto.randomBytes(32).toString('hex');

        const aliado = await prisma.aliado.update({
            where: { id },
            data: { linkToken: token },
            select: { codigo: true },
        });

        const linkUrl = `${origin}/reservas/${aliado.codigo}`;

        return NextResponse.json({
            linkToken: token,
            linkUrl,
        });
    } catch (error) {
        console.error('Error generating aliado link:', error);
        return NextResponse.json(
            { error: 'Error al generar link' },
            { status: 500 }
        );
    }
}
