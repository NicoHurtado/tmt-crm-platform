import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    checkInvite,
    normalizarDocumento,
    normalizarPlaca,
    normalizarTelefono,
} from '@/lib/conductor-invite';
import { sendConductorAutoRegistradoEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conductor/registro/[token]
 * Valida el token (público).
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
    const result = await checkInvite(params.token);
    if (!result.ok) {
        return NextResponse.json({ valid: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ valid: true, expiresAt: result.expiresAt });
}

/**
 * POST /api/conductor/registro/[token]
 * Recibe los datos del conductor y lo crea (público, validado por token).
 * El link es reutilizable: cada envío crea un conductor distinto.
 */
export async function POST(request: Request, { params }: { params: { token: string } }) {
    try {
        const result = await checkInvite(params.token);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const body = await request.json();
        const requiredFields = ['nombre', 'whatsapp', 'telefono', 'documento', 'placa'];
        for (const field of requiredFields) {
            if (!body[field] || !String(body[field]).trim()) {
                return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
            }
        }

        const nombre = String(body.nombre).trim().replace(/\s+/g, ' ');
        const telefono = normalizarTelefono(body.telefono);
        const whatsapp = normalizarTelefono(body.whatsapp);
        const documento = normalizarDocumento(body.documento);
        const placa = normalizarPlaca(body.placa);

        if (nombre.length < 3) {
            return NextResponse.json({ error: 'Escribe tu nombre completo' }, { status: 400 });
        }
        if (documento.length < 5) {
            return NextResponse.json({ error: 'El número de documento no es válido' }, { status: 400 });
        }
        if (placa.length < 5 || placa.length > 8) {
            return NextResponse.json({ error: 'La placa no es válida (ej: ABC123)' }, { status: 400 });
        }
        if (telefono.replace(/\D/g, '').length < 7 || whatsapp.replace(/\D/g, '').length < 7) {
            return NextResponse.json({ error: 'El teléfono o WhatsApp no es válido' }, { status: 400 });
        }

        // Evita que el mismo conductor quede duplicado si reenvía el formulario.
        const duplicados = await prisma.$queryRaw<Array<{ documento: string; placa: string }>>`
            SELECT documento, placa FROM "Conductor"
            WHERE regexp_replace(upper(placa), '[^A-Z0-9]', '', 'g') = ${placa}
               OR regexp_replace(documento, '[^0-9A-Za-z]', '', 'g') = ${documento}
            LIMIT 1
        `;
        if (duplicados.length > 0) {
            return NextResponse.json(
                { error: 'Ya existe un conductor registrado con ese documento o esa placa.' },
                { status: 409 }
            );
        }

        const conductor = await prisma.$transaction(async (tx) => {
            const c = await tx.conductor.create({
                data: {
                    nombre,
                    whatsapp,
                    telefono,
                    documento,
                    placa,
                    foto: body.foto || null,
                    fotosVehiculo: Array.isArray(body.fotosVehiculo) ? body.fotosVehiculo : [],
                    activo: true,
                    disponible: true,
                    selfRegistered: true,
                },
            });
            // Marca el último uso del link (no lo invalida: es reutilizable).
            await tx.conductorInvite.update({
                where: { token: params.token },
                data: { usedAt: new Date() },
            });
            return c;
        });

        // El aviso no puede tumbar el registro: si el SMTP falla, el conductor
        // ya quedó creado y lo único que se pierde es el correo. Se registra en
        // el log y se sigue.
        try {
            await sendConductorAutoRegistradoEmail(conductor);
        } catch (mailError) {
            console.error('No se pudo avisar del auto-registro de conductor:', mailError);
        }

        return NextResponse.json({ data: { id: conductor.id, nombre: conductor.nombre } }, { status: 201 });
    } catch (error) {
        console.error('Error registering conductor:', error);
        return NextResponse.json({ error: 'Error al registrar conductor' }, { status: 500 });
    }
}
