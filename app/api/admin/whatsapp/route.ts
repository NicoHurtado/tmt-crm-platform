// app/api/admin/whatsapp/route.ts
//
// Puente entre el backoffice y el agente de WhatsApp (n8n). Las conversaciones, cotizaciones
// del agente y respuestas aprendidas viven en tablas de n8n; esta ruta exige sesión de admin y
// reenvía la acción al webhook del panel con la misma llave que n8n usa para la web (N8N_API_KEY).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PANEL_URL = process.env.N8N_PANEL_URL || 'https://n8n-production-9d890.up.railway.app/webhook/tmt-panel';

const ACCIONES = new Set([
    'resumen',
    'mensajes',
    'devolver',
    'pausar',
    'conocimiento_estado',
    'conocimiento_agregar',
    'conocimiento_borrar',
]);

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }

    const key = process.env.N8N_API_KEY;
    if (!key) {
        return NextResponse.json({ ok: false, error: 'N8N_API_KEY no configurada' }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 });
    }
    const accion = String(body.accion || '');
    if (!ACCIONES.has(accion)) {
        return NextResponse.json({ ok: false, error: 'Acción no permitida' }, { status: 400 });
    }

    try {
        const res = await fetch(PANEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key },
            body: JSON.stringify(body),
            cache: 'no-store',
            signal: AbortSignal.timeout(60_000),
        });
        const data = await res.json().catch(() => ({ ok: false, error: `El panel respondió ${res.status}` }));
        return NextResponse.json(data, { status: res.ok ? 200 : 502 });
    } catch (e) {
        console.error('[admin/whatsapp]', e);
        return NextResponse.json({ ok: false, error: 'No se pudo conectar con el agente de WhatsApp' }, { status: 502 });
    }
}
