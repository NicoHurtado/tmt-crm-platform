import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    CupoError,
    codigoEventoDisponible,
    crearHorarios,
    datosDesdeAliado,
    parseAeropuerto,
    parseDisponibilidad,
    parseHorarios,
    parsePrecio,
    parseSentido,
    precioDeTurno,
    validarCodigoLink,
} from '@/lib/corporativo';
import { partesColombia, rutaPorDefecto, sufijoLink } from '@/lib/corporativo-horarios';

export const dynamic = 'force-dynamic';

const errorResponse = (error: unknown, fallback: string) => {
    if (error instanceof CupoError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(fallback, error);
    return NextResponse.json({ error: fallback }, { status: 500 });
};

/** GET /api/admin/corporativo[?aliadoId=] — eventos con resumen de reservas y facturación. */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const aliadoId = req.nextUrl.searchParams.get('aliadoId');
    const eventos = await prisma.eventoCorporativo.findMany({
        where: aliadoId ? { aliadoId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
            horarios: { orderBy: { hora: 'asc' }, select: { hora: true, capacidad: true, activo: true } },
            turnos: {
                select: { fechaHora: true, capacidad: true, precioPorPersona: true, _count: { select: { cupos: true } } },
                orderBy: { fechaHora: 'asc' },
            },
            aliado: { select: { id: true, nombre: true, codigo: true, corporativoActivo: true } },
        },
    });

    const ahora = Date.now();
    const data = eventos.map(({ turnos, ...e }) => {
        const conCupos = turnos.filter((t) => t._count.cupos > 0);
        const proxima = conCupos.find((t) => t.fechaHora.getTime() >= ahora);
        return {
            ...e,
            cuposReservados: conCupos.reduce((s, t) => s + t._count.cupos, 0),
            cuposProximos: conCupos.filter((t) => t.fechaHora.getTime() >= ahora).reduce((s, t) => s + t._count.cupos, 0),
            diasConReservas: new Set(conCupos.map((t) => partesColombia(t.fechaHora).fecha)).size,
            totalFacturar: conCupos.reduce((s, t) => s + t._count.cupos * precioDeTurno(t, e), 0),
            proximaSalida: proxima
                ? { fechaHora: proxima.fechaHora, cupos: proxima._count.cupos, capacidad: proxima.capacidad }
                : null,
        };
    });
    return NextResponse.json({ success: true, data });
}

/** POST /api/admin/corporativo — crea un link para un aliado con corporativo activo. */
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
        // Cada combinación aeropuerto + sentido es su propio link: no se mezclan servicios.
        const aeropuertoNombre = parseAeropuerto(body.aeropuertoNombre ?? 'JOSE_MARIA_CORDOVA');
        const aeropuertoTipo = parseSentido(body.aeropuertoTipo ?? 'DESDE');
        const ruta = rutaPorDefecto(aeropuertoNombre, aeropuertoTipo);
        const horarios = parseHorarios(body.horarios);
        if (horarios.length === 0) throw new CupoError('Agrega al menos una hora al horario');
        const disponibilidad = parseDisponibilidad(body);
        const codigo = body.codigo
            ? validarCodigoLink(String(body.codigo))
            : await codigoEventoDisponible(`${aliado.nombre}-${sufijoLink(aeropuertoNombre, aeropuertoTipo)}`);
        if (body.codigo && (await prisma.eventoCorporativo.findUnique({ where: { codigo } }))) {
            throw new CupoError(`El link /corporativo/${codigo} ya está en uso`);
        }

        const evento = await prisma.eventoCorporativo.create({
            data: {
                codigo,
                aliadoId: aliado.id,
                empresa,
                titulo: String(body.titulo ?? '').trim() || ruta.titulo,
                descripcion: body.descripcion?.trim() || null,
                aeropuertoNombre,
                aeropuertoTipo,
                origen: body.origen?.trim() || ruta.origen,
                destino: body.destino?.trim() || ruta.destino,
                precioPorPersona: parsePrecio(body.precioPorPersona) ?? 0,
                servicioId: body.servicioId || null,
                contactoNombre: body.contactoNombre?.trim() || aliado.contacto || null,
                contactoEmail: body.contactoEmail?.trim() || aliado.email || null,
                activo: body.activo !== undefined ? Boolean(body.activo) : true,
                ...disponibilidad,
            },
        });
        await crearHorarios(evento.id, horarios);
        return NextResponse.json({ success: true, data: evento }, { status: 201 });
    } catch (error) {
        return errorResponse(error, 'Error al crear el evento');
    }
}
