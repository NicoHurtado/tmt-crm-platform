import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getValidInvite(token: string) {
    const invite = await prisma.conductorInvite.findUnique({ where: { token } });
    if (!invite) return { error: 'Link inválido', status: 404 as const };
    if (invite.usedAt) return { error: 'Este link ya fue utilizado', status: 410 as const };
    if (invite.expiresAt < new Date()) return { error: 'Este link ha expirado', status: 410 as const };
    return { invite };
}

/**
 * GET /api/conductor/registro/[token]
 * Valida el token (público).
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
    const result = await getValidInvite(params.token);
    if ('error' in result) {
        return NextResponse.json({ valid: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ valid: true, expiresAt: result.invite.expiresAt });
}

/**
 * POST /api/conductor/registro/[token]
 * Recibe los datos del conductor y lo crea (público, validado por token).
 */
export async function POST(request: Request, { params }: { params: { token: string } }) {
    try {
        const result = await getValidInvite(params.token);
        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await request.json();
        const requiredFields = ['nombre', 'whatsapp', 'telefono', 'documento', 'placa'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
            }
        }

        const conductor = await prisma.$transaction(async (tx) => {
            const c = await tx.conductor.create({
                data: {
                    nombre: String(body.nombre).trim(),
                    whatsapp: String(body.whatsapp).trim(),
                    telefono: String(body.telefono).trim(),
                    documento: String(body.documento).trim(),
                    placa: String(body.placa).trim(),
                    foto: body.foto || null,
                    fotosVehiculo: Array.isArray(body.fotosVehiculo) ? body.fotosVehiculo : [],
                    activo: true,
                    disponible: true,
                    selfRegistered: true,
                },
            });
            await tx.conductorInvite.update({
                where: { token: params.token },
                data: { usedAt: new Date() },
            });
            return c;
        });

        return NextResponse.json({ data: { id: conductor.id, nombre: conductor.nombre } }, { status: 201 });
    } catch (error) {
        console.error('Error registering conductor:', error);
        return NextResponse.json({ error: 'Error al registrar conductor' }, { status: 500 });
    }
}
