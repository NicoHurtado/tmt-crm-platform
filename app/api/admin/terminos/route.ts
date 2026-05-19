import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_KEYS = ['terminos_condiciones', 'politica_privacidad'] as const;
type AllowedKey = typeof ALLOWED_KEYS[number];

function resolveKey(req: Request): AllowedKey | null {
    const url = new URL(req.url);
    const key = url.searchParams.get('key') ?? 'terminos_condiciones';
    return ALLOWED_KEYS.includes(key as AllowedKey) ? (key as AllowedKey) : null;
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = resolveKey(req);
    if (!key) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

    const content = await prisma.siteContent.findUnique({ where: { key } });
    return NextResponse.json({ value: content?.value ?? '', updatedAt: content?.updatedAt ?? null });
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const key: string = body.key ?? 'terminos_condiciones';
    const value: unknown = body.value;

    if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    if (typeof value !== 'string') {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const content = await prisma.siteContent.upsert({
        where: { key },
        update: { value, updatedBy: (session.user as any)?.email ?? null },
        create: { key, value, updatedBy: (session.user as any)?.email ?? null },
    });

    return NextResponse.json({ value: content.value, updatedAt: content.updatedAt });
}
