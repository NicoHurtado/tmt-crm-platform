'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FiArrowDown } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import { TextRotate } from '@/components/ui/text-rotate';
import { LayoutGroup, motion } from 'motion/react';

export default function Hero() {
    const { language } = useLanguage();

    return (
        <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
            {/* Background Image with Parallax-like effect (fixed) */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/heroimage.png"
                    alt="Medellín Landscape"
                    fill
                    className="object-cover object-center"
                    priority
                    quality={90}
                />
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
            </div>

            {/* Content */}
            {/* Content */}
            <div className="container mx-auto px-4 relative z-10 text-center md:text-left text-white">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 flex flex-col md:flex-row items-center md:items-start justify-center md:justify-start gap-2 md:gap-4">
                    <span>{t('landing.hero_transporte', language)}</span>
                    <LayoutGroup>
                        <motion.span className="flex whitespace-pre" layout>
                            <TextRotate
                                texts={t('landing.hero_adjetivos', language).split(',')}
                                mainClassName="text-[#D6A75D] overflow-hidden py-0.5 sm:py-1 md:py-2 justify-center rounded-lg"
                                staggerFrom={"last"}
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "-120%" }}
                                staggerDuration={0.025}
                                splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
                                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                                rotationInterval={3000}
                            />
                        </motion.span>
                    </LayoutGroup>
                </h1>

                <p className="text-lg md:text-2xl text-gray-200 mb-10 max-w-2xl mx-auto md:mx-0 font-light leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    {t('landing.hero_subtitulo', language)}
                </p>

                <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                    <Link
                        href="#servicios"
                        className="w-full sm:w-auto bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 active:scale-95 text-lg shadow-lg shadow-[#D6A75D]/20"
                    >
                        {t('landing.hero_cta', language)}
                    </Link>
                    <Link
                        href="/reservas"
                        className="w-full sm:w-auto bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-3.5 px-8 rounded-lg transition-all text-lg backdrop-blur-sm"
                    >
                        {t('header.reservar', language)}
                    </Link>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
                <FiArrowDown size={32} />
            </div>
        </section>
    );
}
