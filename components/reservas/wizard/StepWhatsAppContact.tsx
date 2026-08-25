'use client';

import { FiMessageCircle } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';

interface StepWhatsAppContactProps {
    serviceName: string;
    onBack: () => void;
}

export default function StepWhatsAppContact({ serviceName, onBack }: StepWhatsAppContactProps) {
    const { language } = useLanguage();

    const handleWhatsAppClick = () => {
        const message = language === 'es'
            ? `Hola, estoy interesado en el transporte por horas: ${serviceName}.`
            : `Hello, I am interested in the hourly transport service: ${serviceName}.`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/573175177409?text=${encodedMessage}`, '_blank');
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-8 animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-4">
                <FiMessageCircle className="w-12 h-12 text-[#25D366]" />
            </div>

            <div className="max-w-md space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">
                    {language === 'es' ? 'Cotización Personalizada' : 'Custom Quote'}
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed">
                    {language === 'es'
                        ? 'Para este servicio por horas, necesitamos conocer mejor tus necesidades para ofrecerte la mejor tarifa.'
                        : 'For this hourly service, we need to better understand your needs to offer you the best rate.'}
                </p>
                <p className="text-gray-500">
                    {language === 'es'
                        ? 'Contáctanos directamente por WhatsApp y un asesor te atenderá de inmediato.'
                        : 'Contact us directly via WhatsApp and an advisor will assist you immediately.'}
                </p>
            </div>

            <button
                onClick={handleWhatsAppClick}
                className="flex items-center gap-3 px-8 py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
                <FiMessageCircle size={24} />
                {language === 'es' ? 'Contactar por WhatsApp' : 'Contact via WhatsApp'}
            </button>

            <button
                onClick={onBack}
                className="text-gray-400 hover:text-gray-600 text-sm mt-8 underline"
            >
                {t('reservas.paso0_volver', language)}
            </button>
        </div>
    );
}
