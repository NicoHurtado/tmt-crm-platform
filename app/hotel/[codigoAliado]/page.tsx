import { redirect } from 'next/navigation';

export default async function HotelRedirectPage({
    params,
}: {
    params: Promise<{ codigoAliado: string }>;
}) {
    const { codigoAliado } = await params;
    redirect(`/reservas/${codigoAliado}`);
}
