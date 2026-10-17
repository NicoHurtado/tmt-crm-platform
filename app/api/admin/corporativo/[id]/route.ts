import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    CupoError,
    datosDesdeAliado,
    eliminarEvento,
    parseAeropuerto,
    parsePrecio,
    parseSentido,
    parseTurnos,
    resincronizarEvento,
    sincronizarTurnos,
    validarCodigoLink,
} from '@/lib/corporativo';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const errorResponse = (error: unknown, fallback: string) => {
    if (error instanceof CupoError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
};

/** GET /api/admin/corporativo/[id] — evento con horarios, pasajeros y la reserva de cada salida. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const evento = await prisma.eventoCorporativo.findUnique({
        where: { id: params.id },
        include: {
            aliado: { select: { id: true, nombre: true, codigo: true, email: true, contacto: true, corporativoActivo: true } },
            turnos: {
                orderBy: { fechaHora: 'asc' },
                include: {
                    cupos: { orderBy: { createdAt: 'asc' } },
                    reserva: {
                        select: {
                            id: true, codigo: true, estado: true,
                            conductor: { select: { nombre: true } },
                            vehiculo: { select: { nombre: true } },
                        },
                    },
                },
            },
        },
    });
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: evento });
}

/** PUT /api/admin/corporativo/[id] — edita el evento y (si viene) la lista de horarios. */
export async function PUT(req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await req.json();
        const existe = await prisma.eventoCorporativo.findUnique({ where: { id: params.id } });
        if (!existe) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

        const data: Record<string, unknown> = {};
        for (const k of ['empresa', 'titulo', 'origen', 'destino'] as const) {
            if (body[k] !== undefined) {
                const v = String(body[k]).trim();
                if (!v) throw new CupoError(`El campo ${k} no puede estar vacío`);
                data[k] = v;
            }
        }
        for (const k of ['descripcion', 'contactoNombre', 'contactoEmail'] as const) {
            if (body[k] !== undefined) data[k] = String(body[k] ?? '').trim() || null;
        }
        if (body.precioPorPersona !== undefined) data.precioPorPersona = parsePrecio(body.precioPorPersona) ?? 0;
        if (body.activo !== undefined) data.activo = Boolean(body.activo);
        if (body.servicioId !== undefined) data.servicioId = body.servicioId || null;
        if (body.codigo !== undefined && body.codigo !== existe.codigo) {
            const codigo = validarCodigoLink(String(body.codigo));
            const otro = await prisma.eventoCorporativo.findUnique({ where: { codigo } });
            if (otro && otro.id !== existe.id) throw new CupoError(`El link /corporativo/${codigo} ya está en uso`);
            data.codigo = codigo;
        }
        // Cambiar aeropuerto o sentido con gente ya inscrita mezclaría dos servicios
        // distintos en el mismo link: en ese caso se crea un link nuevo.
        const nuevoAeropuerto = body.aeropuertoNombre !== undefined ? parseAeropuerto(body.aeropuertoNombre) : existe.aeropuertoNombre;
        const nuevoSentido = body.aeropuertoTipo !== undefined ? parseSentido(body.aeropuertoTipo) : existe.aeropuertoTipo;
        if (nuevoAeropuerto !== existe.aeropuertoNombre || nuevoSentido !== existe.aeropuertoTipo) {
            const cupos = await prisma.cupoCorporativo.count({ where: { eventoId: existe.id } });
            if (cupos > 0) {
                throw new CupoError('Este link ya tiene cupos: para otro aeropuerto o sentido crea un evento nuevo');
            }
            data.aeropuertoNombre = nuevoAeropuerto;
            data.aeropuertoTipo = nuevoSentido;
        }
        if (body.aliadoId !== undefined) {
            const aliado = await datosDesdeAliado(body.aliadoId);
            if (!aliado) throw new CupoError('El evento debe tener un aliado');
            data.aliadoId = aliado.id;
        }

        const evento = await prisma.eventoCorporativo.update({ where: { id: params.id }, data });
        // Los horarios recalculan sus reservas; si no vienen, se recalculan igual
        // porque precio, empresa, servicio o link pudieron cambiar.
        if (body.turnos !== undefined) await sincronizarTurnos(params.id, parseTurnos(body.turnos));
        else await resincronizarEvento(params.id);
        return NextResponse.json({ success: true, data: evento });
    } catch (error) {
        return errorResponse(error, 'Error al actualizar el evento');
    }
}

/** DELETE /api/admin/corporativo/[id] — borra el evento, sus cupos y las reservas de sus salidas. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        await eliminarEvento(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return errorResponse(error, 'Error al eliminar el evento');
    }
}
