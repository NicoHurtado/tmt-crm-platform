'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Entrada sutil para clientes corporativos: ingresan el código que les compartimos. */
export default function CorporativoAccesoPage() {
    const router = useRouter();
    const [codigo, setCodigo] = useState('');

    const ir = (e: React.FormEvent) => {
        e.preventDefault();
        const c = codigo.trim().toLowerCase().split('/').pop();
        if (c) router.push(`/corporativo/${encodeURIComponent(c)}`);
    };

    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
            <form onSubmit={ir} className="w-full max-w-sm text-center">
                <Link href="/" className="inline-block">
                    <Image src="/logo.png" alt="Transportes Medellín Travel" width={64} height={64} className="mx-auto h-16 w-16 object-contain" />
                </Link>
                <h1 className="mt-6 text-2xl">Acceso corporativo</h1>
                <p className="mt-2 text-sm text-white/60 font-[family-name:var(--font-sans)]">
                    Ingresa el código o link que te compartió tu empresa para reservar tu cupo.
                </p>
                <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Código del evento"
                    aria-label="Código del evento"
                    className="mt-6 w-full rounded-lg bg-white/5 border border-white/15 px-3.5 py-3 text-center text-white placeholder:text-white/35 focus:outline-none focus:border-[#D6A75D] font-[family-name:var(--font-sans)]"
                />
                <button type="submit" className="mt-3 w-full rounded-lg bg-[#D6A75D] py-3 text-black hover:bg-[#F2C94C] transition-colors">
                    Continuar
                </button>
            </form>
        </main>
    );
}
