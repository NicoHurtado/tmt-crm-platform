import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { asignarCupoEnTurno, CupoError, parseCupo } from '@/lib/corporativo';

export const dynamic = 'force-dynamic';

/** POST /api/admin/corporativo/[id]/cupos — el admin agrega un pasajero a mano. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await req.json();
        const turnoId = String(body.turnoId ?? '');
        if (!turnoId) return NextResponse.json({ error: 'Turno requerido' }, { status: 400 });
        const cupo = await asignarCupoEnTurno(turnoId, {
            crear: { eventoId: params.id, datos: parseCupo(body) },
        });
        return NextResponse.json({ success: true, data: cupo }, { status: 201 });
    } catch (error) {
        if (error instanceof CupoError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('Error agregando cupo corporativo:', error);
        return NextResponse.json({ error: 'Error al agregar el cupo' }, { status: 500 });
    }
}
