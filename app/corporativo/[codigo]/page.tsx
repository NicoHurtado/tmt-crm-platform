import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import ReservaCupoCorporativo, { type TurnoPublico } from './ReservaCupoCorporativo';

export const dynamic = 'force-dynamic';

/** Vista previa del link en WhatsApp/correo: nombre de la empresa y qué hacer. */
export async function generateMetadata({ params }: { params: { codigo: string } }): Promise<Metadata> {
    const evento = await prisma.eventoCorporativo.findUnique({
        where: { codigo: params.codigo },
        select: { empresa: true, titulo: true, origen: true, destino: true },
    });
    if (!evento) return { title: 'Transportes Medellín Travel', robots: { index: false, follow: false } };
    const title = `${evento.empresa} · Reserva tu cupo de transporte`;
    const description = `${evento.titulo}: ${evento.origen} → ${evento.destino}. Escoge la hora que mejor se ajuste a tu vuelo. Sin costo para ti.`;
    return {
        title,
        description,
        robots: { index: false, follow: false },
        openGraph: { title, description, images: [{ url: '/logo.png', width: 512, height: 512 }], siteName: 'Transportes Medellín Travel' },
    };
}

export default async function EventoCorporativoPage({ params }: { params: { codigo: string } }) {
    const evento = await prisma.eventoCorporativo.findUnique({
        where: { codigo: params.codigo },
        include: {
            aliado: { select: { corporativoActivo: true } },
            turnos: {
                where: { activo: true },
                orderBy: { fechaHora: 'asc' },
                include: { _count: { select: { cupos: true } } },
            },
        },
    });
    if (!evento) notFound();

    const ahora = Date.now();
    const turnos: TurnoPublico[] = evento.turnos.map((t) => ({
        id: t.id,
        fechaHora: t.fechaHora.toISOString(),
        capacidad: t.capacidad,
        disponibles: Math.max(0, t.capacidad - t._count.cupos),
        vehiculo: t.vehiculo,
        yaSalio: t.fechaHora.getTime() < ahora,
    }));

    return (
        <ReservaCupoCorporativo
            codigo={evento.codigo}
            activo={evento.activo && (evento.aliado ? evento.aliado.corporativoActivo : true)}
            empresa={evento.empresa}
            titulo={evento.titulo}
            descripcion={evento.descripcion}
            origen={evento.origen}
            destino={evento.destino}
            turnos={turnos}
        />
    );
}
