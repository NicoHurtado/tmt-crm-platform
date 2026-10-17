import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    CupoError,
    datosDesdeAliado,
    eliminarEvento,
    guardarHorarios,
    parseAeropuerto,
    parseDisponibilidad,
    parseHorarios,
    parsePrecio,
    parseSentido,
    validarCodigoLink,
} from '@/lib/corporativo';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const errorResponse = (error: unknown, fallback: string) => {
    if (error instanceof CupoError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
};

/** GET /api/admin/corporativo/[id] — evento, horario diario y salidas con sus pasajeros. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const evento = await prisma.eventoCorporativo.findUnique({
        where: { id: params.id },
        include: {
            aliado: { select: { id: true, nombre: true, codigo: true, email: true, contacto: true, corporativoActivo: true } },
            horarios: { orderBy: { hora: 'asc' } },
            turnos: {
                orderBy: { fechaHora: 'asc' },
                include: {
                    cupos: { orderBy: { createdAt: 'asc' } },
                    reserva: {
                        select: {
                            id: true, codigo: true, estado: true,
                            conductor: { select: { nombre: true } },
                        },
                    },
                },
            },
        },
    });
    if (!evento) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: evento });
}

/** PUT /api/admin/corporativo/[id] — edita el evento, su disponibilidad y su horario diario. */
export async function PUT(req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await req.json();
        const existe = await prisma.eventoCorporativo.findUnique({ where: { id: params.id } });
        if (!existe) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

        const data: Record<string, unknown> = { ...parseDisponibilidad(body) };
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
            if (cupos > 0) throw new CupoError('Este link ya tiene cupos: para otro aeropuerto o sentido crea un evento nuevo');
            data.aeropuertoNombre = nuevoAeropuerto;
            data.aeropuertoTipo = nuevoSentido;
        }
        if (body.aliadoId !== undefined) {
            const aliado = await datosDesdeAliado(body.aliadoId);
            if (!aliado) throw new CupoError('El evento debe tener un aliado');
            data.aliadoId = aliado.id;
        }
        const horarios = body.horarios !== undefined ? parseHorarios(body.horarios) : undefined;
        if (horarios && horarios.length === 0) throw new CupoError('El horario debe tener al menos una hora');

        const evento = await prisma.eventoCorporativo.update({ where: { id: params.id }, data });
        // Recalcula las salidas próximas (puestos, precio, empresa, link…) y sus reservas.
        await guardarHorarios(params.id, horarios);
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
