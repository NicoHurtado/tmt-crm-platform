import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CupoError, fechaHoraColombia, formatHoraColombia, parseCupo, reservarCupoPublico } from '@/lib/corporativo';
import { fechaReservable } from '@/lib/corporativo-horarios';
import { sendCupoCorporativoEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/corporativo/[codigo]?fecha=YYYY-MM-DD — puestos libres de cada hora ese día.
 * Público: solo devuelve conteos, nunca datos de los pasajeros.
 */
export async function GET(req: NextRequest, { params }: { params: { codigo: string } }) {
    const fecha = req.nextUrl.searchParams.get('fecha') ?? '';
    const evento = await prisma.eventoCorporativo.findUnique({
        where: { codigo: params.codigo },
        include: {
            aliado: { select: { corporativoActivo: true } },
            horarios: { where: { activo: true }, orderBy: { hora: 'asc' } },
        },
    });
    if (!evento || !evento.activo || (evento.aliado && !evento.aliado.corporativoActivo)) {
        return NextResponse.json({ error: 'Este link ya no está disponible' }, { status: 404 });
    }
    if (!fechaReservable(fecha, evento)) {
        return NextResponse.json({ success: true, data: { fecha, disponible: false, horas: [] } });
    }

    const salidas = await prisma.turnoCorporativo.findMany({
        where: { eventoId: evento.id, fechaHora: { in: evento.horarios.map((h) => fechaHoraColombia(fecha, h.hora)) } },
        include: { _count: { select: { cupos: true } } },
    });
    const ahora = Date.now();
    const horas = evento.horarios.map((h) => {
        const fechaHora = fechaHoraColombia(fecha, h.hora);
        const salida = salidas.find((s) => s.fechaHora.getTime() === fechaHora.getTime());
        const capacidad = salida?.capacidad ?? h.capacidad;
        return {
            horarioId: h.id,
            hora: h.hora,
            capacidad,
            disponibles: Math.max(0, capacidad - (salida?._count.cupos ?? 0)),
            yaPaso: fechaHora.getTime() <= ahora,
        };
    });
    return NextResponse.json({ success: true, data: { fecha, disponible: true, horas } });
}

/**
 * POST /api/public/corporativo/[codigo] — un funcionario reserva su cupo ({ fecha, horarioId, …datos }).
 * Público (sin sesión): el código del link es la credencial. No hay pago.
 */
export async function POST(req: NextRequest, { params }: { params: { codigo: string } }) {
    try {
        const body = await req.json();
        if (!body.fecha) throw new CupoError('Escoge la fecha');
        if (!body.horarioId) throw new CupoError('Escoge la hora');
        const datos = parseCupo(body);
        const { evento, salida } = await reservarCupoPublico(params.codigo, {
            horarioId: String(body.horarioId),
            fecha: String(body.fecha),
            datos,
        });
        const textoSalida = formatHoraColombia(salida.fechaHora, {
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: true,
        });

        const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        // Se espera el envío (en Vercel una promesa suelta se corta al responder),
        // pero un fallo de correo no deshace el cupo.
        await sendCupoCorporativoEmail({
            to: datos.email,
            nombre: datos.nombre,
            empresa: evento.empresa,
            titulo: evento.titulo,
            origen: evento.origen,
            destino: evento.destino,
            salida: textoSalida,
            numeroVuelo: datos.numeroVuelo,
            linkEvento: `${base}/corporativo/${evento.codigo}`,
        }).catch((e) => console.error('Error enviando correo de cupo corporativo:', e));

        return NextResponse.json({ success: true, data: { salida: textoSalida } }, { status: 201 });
    } catch (error) {
        if (error instanceof CupoError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error reservando cupo corporativo:', error);
        return NextResponse.json({ error: 'No pudimos reservar tu cupo, intenta de nuevo' }, { status: 500 });
    }
}
