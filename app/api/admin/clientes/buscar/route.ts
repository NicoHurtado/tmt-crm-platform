import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ClienteEncontrado, normalizarDocumento, ultimosDigitos } from '@/lib/clientes';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/clientes/buscar?q=<celular o documento>
 * Busca clientes anteriores por celular (últimos 10 dígitos) o por número de documento
 * (del pasajero principal). Devuelve hasta 5 coincidencias, la más reciente primero.
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const digitos = q.replace(/\D/g, '');
    const doc = normalizarDocumento(q);

    if (doc.length < 5) {
        return NextResponse.json({ success: true, data: [] });
    }

    try {
        // Celular: se compara por los últimos dígitos (7 a 10) para tolerar indicativo y formato.
        const tel = digitos.length >= 7 ? ultimosDigitos(digitos) : null;

        const filas = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT r.id
            FROM "Reserva" r
            WHERE (
                ${tel}::text IS NOT NULL
                AND regexp_replace(r."whatsappCliente", '\\D', '', 'g') LIKE '%' || ${tel}::text
            ) OR EXISTS (
                SELECT 1 FROM "Asistente" a
                WHERE a."reservaId" = r.id
                  AND upper(regexp_replace(a."numeroDocumento", '[^0-9a-zA-Z]', '', 'g')) = ${doc}
            )
            ORDER BY r."createdAt" DESC
            LIMIT 50
        `;

        if (filas.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const reservas = await prisma.reserva.findMany({
            where: { id: { in: filas.map((f) => f.id) } },
            select: {
                nombreCliente: true,
                whatsappCliente: true,
                emailCliente: true,
                idioma: true,
                createdAt: true,
                asistentes: {
                    select: { nombre: true, tipoDocumento: true, numeroDocumento: true, createdAt: true },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Un cliente = mismo correo (o mismo celular si no hay correo). Se queda con lo más reciente.
        const porCliente = new Map<string, ClienteEncontrado>();
        for (const r of reservas) {
            const clave = (r.emailCliente || '').trim().toLowerCase() || ultimosDigitos(r.whatsappCliente || '');
            if (!clave) continue;

            // Documento del cliente: el asistente cuyo documento coincide con la búsqueda,
            // si no el que lleva su mismo nombre, y si no el primero (representante).
            const nombreNorm = (r.nombreCliente || '').trim().toLowerCase();
            const asistente =
                r.asistentes.find((a) => normalizarDocumento(a.numeroDocumento) === doc) ||
                r.asistentes.find((a) => a.nombre.trim().toLowerCase() === nombreNorm) ||
                r.asistentes[0];

            const existente = porCliente.get(clave);
            if (existente) {
                existente.totalReservas += 1;
                // Completa el documento si la reserva más reciente no lo tenía.
                if (!existente.numeroDocumento && asistente?.numeroDocumento) {
                    existente.tipoDocumento = asistente.tipoDocumento;
                    existente.numeroDocumento = asistente.numeroDocumento;
                }
                continue;
            }

            porCliente.set(clave, {
                nombre: r.nombreCliente,
                whatsapp: r.whatsappCliente,
                email: r.emailCliente,
                idioma: r.idioma === 'EN' ? 'EN' : 'ES',
                tipoDocumento: asistente?.numeroDocumento ? asistente.tipoDocumento : null,
                numeroDocumento: asistente?.numeroDocumento || null,
                ultimaReserva: r.createdAt.toISOString(),
                totalReservas: 1,
            });
        }

        return NextResponse.json({ success: true, data: Array.from(porCliente.values()).slice(0, 5) });
    } catch (error: any) {
        console.error('❌ Error buscando cliente:', error);
        return NextResponse.json({ error: 'Error al buscar el cliente' }, { status: 500 });
    }
}
