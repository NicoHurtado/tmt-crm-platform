import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadImageToBlob, UPLOAD_ERRORS } from '@/lib/upload';

export const dynamic = 'force-dynamic';

/**
 * POST /api/conductor/registro/[token]/upload
 * Upload público gateado por token de invite válido.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
    const invite = await prisma.conductorInvite.findUnique({ where: { token: params.token } });
    if (!invite) return NextResponse.json({ success: false, error: 'Link inválido' }, { status: 404 });
    if (invite.usedAt) return NextResponse.json({ success: false, error: 'Link ya utilizado' }, { status: 410 });
    if (invite.expiresAt < new Date()) return NextResponse.json({ success: false, error: 'Link expirado' }, { status: 410 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ success: false, error: UPLOAD_ERRORS.NO_FILE }, { status: 400 });
        }
        const url = await uploadImageToBlob(file, 'conductores');
        return NextResponse.json({ success: true, url, filename: file.name });
    } catch (error: any) {
        console.error('Error uploading conductor self-reg photo:', error);
        return NextResponse.json({ success: false, error: error.message || UPLOAD_ERRORS.UPLOAD_FAILED }, { status: 500 });
    }
}
