'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReservasTourCompartidoGuatapeRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/reservas?servicio=tour-compartido&form=1');
    }, [router]);

    return null;
}
