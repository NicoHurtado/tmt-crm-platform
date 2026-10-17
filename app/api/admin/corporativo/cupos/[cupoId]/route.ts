import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CupoError, eliminarCupo, moverCupo } from '@/lib/corporativo';

export const dynamic = 'force-dynamic';

type Ctx = { params: { cupoId: string } };

/** PUT /api/admin/corporativo/cupos/[cupoId] — mueve el cupo a otra fecha/hora ({ fecha, horarioId }). */
export async function PUT(req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { horarioId, fecha } = await req.json();
        if (!horarioId || !fecha) throw new CupoError('Escoge fecha y hora');
        const cupo = await moverCupo(params.cupoId, String(horarioId), String(fecha));
        return NextResponse.json({ success: true, data: cupo });
    } catch (error) {
        if (error instanceof CupoError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error('Error moviendo cupo corporativo:', error);
        return NextResponse.json({ error: 'Error al mover el cupo' }, { status: 500 });
    }
}

/** DELETE /api/admin/corporativo/cupos/[cupoId] — libera el cupo. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        await eliminarCupo(params.cupoId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error eliminando cupo corporativo:', error);
        return NextResponse.json({ error: 'Error al eliminar el cupo' }, { status: 500 });
    }
}
