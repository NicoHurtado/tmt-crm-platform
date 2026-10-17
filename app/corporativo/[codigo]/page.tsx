import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import ReservaCupoCorporativo from './ReservaCupoCorporativo';

export const dynamic = 'force-dynamic';

/** Vista previa del link en WhatsApp/correo: nombre de la empresa y qué hacer. */
export async function generateMetadata({ params }: { params: { codigo: string } }): Promise<Metadata> {
    const evento = await prisma.eventoCorporativo.findUnique({
        where: { codigo: params.codigo },
        select: { empresa: true, titulo: true, origen: true, destino: true },
    });
    if (!evento) return { title: 'Transportes Medellín Travel', robots: { index: false, follow: false } };
    const title = `${evento.empresa} · Reserva tu cupo de transporte`;
    const description = `${evento.titulo}: ${evento.origen} → ${evento.destino}. Escoge el día y la hora que mejor se ajusten a tu vuelo. Sin costo para ti.`;
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
            _count: { select: { horarios: { where: { activo: true } } } },
        },
    });
    if (!evento) notFound();

    return (
        <ReservaCupoCorporativo
            codigo={evento.codigo}
            activo={evento.activo && (evento.aliado ? evento.aliado.corporativoActivo : true) && evento._count.horarios > 0}
            empresa={evento.empresa}
            titulo={evento.titulo}
            descripcion={evento.descripcion}
            origen={evento.origen}
            destino={evento.destino}
            aeropuertoNombre={evento.aeropuertoNombre}
            aeropuertoTipo={evento.aeropuertoTipo}
            reglas={{ fechaDesde: evento.fechaDesde, fechaHasta: evento.fechaHasta, diasSemana: evento.diasSemana }}
        />
    );
}
