import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToBlob, UPLOAD_ERRORS } from '@/lib/upload';
import { checkInvite } from '@/lib/conductor-invite';

export const dynamic = 'force-dynamic';

/**
 * POST /api/conductor/registro/[token]/upload
 * Upload público gateado por token de invite válido.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
    const invite = await checkInvite(params.token);
    if (!invite.ok) {
        return NextResponse.json({ success: false, error: invite.error }, { status: invite.status });
    }

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
