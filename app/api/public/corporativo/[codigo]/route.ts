import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { asignarCupoEnTurno, CupoError, formatHoraColombia, parseCupo } from '@/lib/corporativo';
import { sendCupoCorporativoEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/corporativo/[codigo] — un funcionario reserva su cupo.
 * Público (sin sesión): el código del link es la credencial. No hay pago.
 */
export async function POST(req: NextRequest, { params }: { params: { codigo: string } }) {
    try {
        const evento = await prisma.eventoCorporativo.findUnique({
            where: { codigo: params.codigo },
            include: { aliado: { select: { corporativoActivo: true } } },
        });
        if (!evento || !evento.activo || (evento.aliado && !evento.aliado.corporativoActivo)) {
            return NextResponse.json({ error: 'Este link ya no está disponible' }, { status: 404 });
        }

        const body = await req.json();
        const turnoId = String(body.turnoId ?? '');
        if (!turnoId) return NextResponse.json({ error: 'Escoge un horario' }, { status: 400 });

        const datos = parseCupo(body);
        const cupo = await asignarCupoEnTurno(turnoId, {
            crear: { eventoId: evento.id, datos },
            validarPublico: true,
        });
        const turno = await prisma.turnoCorporativo.findUniqueOrThrow({ where: { id: turnoId } });
        const salida = formatHoraColombia(turno.fechaHora, {
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
            salida,
            numeroVuelo: datos.numeroVuelo,
            linkEvento: `${base}/corporativo/${evento.codigo}`,
        }).catch((e) => console.error('Error enviando correo de cupo corporativo:', e));

        return NextResponse.json({ success: true, data: { id: cupo.id, salida } }, { status: 201 });
    } catch (error) {
        if (error instanceof CupoError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error reservando cupo corporativo:', error);
        return NextResponse.json({ error: 'No pudimos reservar tu cupo, intenta de nuevo' }, { status: 500 });
    }
}
