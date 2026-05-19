'use client';

import { FiShield, FiClock, FiAward, FiUserCheck, FiMapPin, FiHeadphones } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';

export default function Features() {
    const { language } = useLanguage();

    const features = [
        {
            icon: <FiUserCheck size={32} />,
            title: t('landing.caracteristica1_titulo', language),
            description: t('landing.caracteristica1_desc', language)
        },
        {
            icon: <FiShield size={32} />,
            title: t('landing.caracteristica2_titulo', language),
            description: t('landing.caracteristica2_desc', language)
        },
        {
            icon: <FiAward size={32} />,
            title: t('landing.caracteristica3_titulo', language),
            description: t('landing.caracteristica3_desc', language)
        },
        {
            icon: <FiClock size={32} />,
            title: t('landing.caracteristica4_titulo', language),
            description: t('landing.caracteristica4_desc', language)
        },
        {
            icon: <FiHeadphones size={32} />,
            title: t('landing.caracteristica5_titulo', language),
            description: t('landing.caracteristica5_desc', language)
        },
        {
            icon: <FiMapPin size={32} />,
            title: t('landing.caracteristica6_titulo', language),
            description: t('landing.caracteristica6_desc', language)
        }
    ];

    return (
        <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t('landing.porQueElegirnos_titulo', language)}
                    </h2>
                    <div className="h-1 w-20 bg-[#D6A75D] mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* Features Grid */}
                    <div className="flex flex-col gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-center text-left p-8 rounded-2xl hover:bg-gray-50 transition-colors duration-300 shadow-sm hover:shadow-md border border-transparent hover:border-gray-100"
                            >
                                <div className="w-20 h-20 bg-[#D6A75D]/10 text-[#D6A75D] rounded-full flex-shrink-0 flex items-center justify-center mr-8">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                                    <p className="text-gray-600 text-lg leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Video Column */}
                    <div className="flex items-center justify-center">
                        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                            <video
                                src="/video1.mp4"
                                className="w-full h-auto"
                                autoPlay
                                loop
                                muted
                                playsInline
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
