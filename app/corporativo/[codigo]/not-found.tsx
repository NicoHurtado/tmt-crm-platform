import Link from 'next/link';

export default function EventoNoEncontrado() {
    return (
        <main className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 text-center">
            <div>
                <h1 className="text-2xl">Link no encontrado</h1>
                <p className="mt-2 text-sm text-white/60">Revisa el link que te compartió tu empresa.</p>
                <Link href="/corporativo" className="mt-6 inline-block text-[#D6A75D] underline underline-offset-4">
                    Ingresar un código
                </Link>
            </div>
        </main>
    );
}
