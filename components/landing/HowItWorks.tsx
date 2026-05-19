'use client';

import { useLanguage, t } from '@/lib/i18n';

export default function HowItWorks() {
    const { language } = useLanguage();

    const steps = [
        {
            number: "1",
            title: t('landing.paso1_titulo', language),
            description: t('landing.paso1_desc', language)
        },
        {
            number: "2",
            title: t('landing.paso2_titulo', language),
            description: t('landing.paso2_desc', language)
        },
        {
            number: "3",
            title: t('landing.paso3_titulo', language),
            description: t('landing.paso3_desc', language)
        },
        {
            number: "4",
            title: t('landing.paso4_titulo', language),
            description: t('landing.paso4_desc', language)
        }
    ];

    return (
        <section id="como-funciona" className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t('landing.comoFunciona_titulo', language)}
                    </h2>
                    <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full mt-6"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Video Column - Left */}
                    <div className="flex items-center justify-center">
                        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                            <video
                                src="/video2.mp4"
                                className="w-full h-auto"
                                autoPlay
                                loop
                                muted
                                playsInline
                            />
                        </div>
                    </div>

                    {/* Steps Column - Right */}
                    <div className="flex items-center justify-center">
                        <div className="relative max-w-md">
                            {/* Vertical connecting line */}
                            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-[#D6A75D]/30"></div>

                            <div className="space-y-12 relative">
                                {steps.map((step, index) => (
                                    <div key={index} className="flex items-start gap-10 relative">
                                        {/* Circle Number */}
                                        <div className="flex-shrink-0 w-16 h-16 bg-[#D6A75D] text-black font-bold text-2xl rounded-full flex items-center justify-center shadow-lg relative z-10">
                                            {step.number}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pt-2">
                                            <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                                            <p className="text-gray-600 text-lg leading-relaxed">{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
