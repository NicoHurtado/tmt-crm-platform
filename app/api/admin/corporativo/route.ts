import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    CupoError,
    codigoEventoDisponible,
    crearTurnos,
    datosDesdeAliado,
    parsePrecio,
    parseTurnos,
    totalFacturar,
    validarCodigoLink,
} from '@/lib/corporativo';

export const dynamic = 'force-dynamic';

const errorResponse = (error: unknown, fallback: string) => {
    if (error instanceof CupoError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
};

/** GET /api/admin/corporativo[?aliadoId=] — eventos con ocupación y total a facturar. */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const aliadoId = req.nextUrl.searchParams.get('aliadoId');
    const eventos = await prisma.eventoCorporativo.findMany({
        where: aliadoId ? { aliadoId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
            turnos: {
                select: { fechaHora: true, capacidad: true, precioPorPersona: true, _count: { select: { cupos: true } } },
                orderBy: { fechaHora: 'asc' },
            },
            aliado: { select: { id: true, nombre: true, codigo: true, corporativoActivo: true } },
        },
    });

    const data = eventos.map(({ turnos, ...e }) => ({
        ...e,
        totalTurnos: turnos.length,
        capacidadTotal: turnos.reduce((s, t) => s + t.capacidad, 0),
        cuposReservados: turnos.reduce((s, t) => s + t._count.cupos, 0),
        totalFacturar: totalFacturar(e, turnos.map((t) => ({ precioPorPersona: t.precioPorPersona, cupos: t._count.cupos }))),
        primeraSalida: turnos[0]?.fechaHora ?? null,
        ultimaSalida: turnos[turnos.length - 1]?.fechaHora ?? null,
    }));
    return NextResponse.json({ success: true, data });
}

/** POST /api/admin/corporativo — crea un evento para un aliado con corporativo activo. */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await req.json();
        const aliado = await datosDesdeAliado(body.aliadoId);
        if (!aliado) throw new CupoError('Escoge el aliado (perfil de la empresa)');
        if (!aliado.corporativoActivo) {
            throw new CupoError(`${aliado.nombre} no tiene activo el servicio corporativo. Actívalo en Aliados.`);
        }
        const empresa = String(body.empresa ?? '').trim() || aliado.nombre;
        const titulo = String(body.titulo ?? '').trim() || 'Traslado Aeropuerto → Medellín';
        const precio = parsePrecio(body.precioPorPersona) ?? 0;
        const turnos = parseTurnos(body.turnos);
        const codigo = body.codigo
            ? validarCodigoLink(String(body.codigo))
            : await codigoEventoDisponible(aliado.nombre);
        if (body.codigo && (await prisma.eventoCorporativo.findUnique({ where: { codigo } }))) {
            throw new CupoError(`El link /corporativo/${codigo} ya está en uso`);
        }

        const evento = await prisma.eventoCorporativo.create({
            data: {
                codigo,
                aliadoId: aliado.id,
                empresa,
                titulo,
                descripcion: body.descripcion?.trim() || null,
                origen: body.origen?.trim() || undefined,
                destino: body.destino?.trim() || undefined,
                precioPorPersona: precio,
                servicioId: body.servicioId || null,
                contactoNombre: body.contactoNombre?.trim() || aliado.contacto || null,
                contactoEmail: body.contactoEmail?.trim() || aliado.email || null,
                activo: body.activo !== undefined ? Boolean(body.activo) : true,
            },
        });
        try {
            await crearTurnos(evento.id, turnos);
        } catch (e) {
            await prisma.eventoCorporativo.delete({ where: { id: evento.id } });
            throw e;
        }
        return NextResponse.json({ success: true, data: evento }, { status: 201 });
    } catch (error) {
        return errorResponse(error, 'Error al crear el evento');
    }
}
