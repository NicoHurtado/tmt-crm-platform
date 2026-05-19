'use client';

import Link from 'next/link';
import { useLanguage, t } from '@/lib/i18n';

export default function CallToAction() {
    const { language } = useLanguage();

    return (
        <section className="py-20 bg-[#D6A75D] text-black text-center">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                    {t('landing.cta_titulo', language)}
                </h2>
                <p className="text-xl mb-10 max-w-2xl mx-auto font-medium">
                    {t('landing.cta_subtitulo', language)}
                </p>
                <Link
                    href="/reservas"
                    className="inline-block bg-black text-white hover:bg-gray-900 font-bold py-4 px-10 rounded-lg text-lg transition-all transform hover:scale-105 shadow-xl"
                >
                    {t('landing.cta_boton', language)}
                </Link>
            </div>
        </section>
    );
}
