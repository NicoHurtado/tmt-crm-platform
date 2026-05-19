'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReservasAeropuertoRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/reservas?servicio=aeropuerto&form=1');
    }, [router]);

    return null;
}
