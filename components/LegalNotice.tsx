'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

interface LegalNoticeProps {
    variant?: 'default' | 'compact';
}

export default function LegalNotice({ variant = 'default' }: LegalNoticeProps) {
    const { language } = useLanguage();

    const textEs = {
        line1: "Al continuar, aceptas nuestros",
        line2: "y autorizas el tratamiento de tus datos personales conforme a nuestra",
        terminos: "Términos y Condiciones",
        privacidad: "Política de Privacidad"
    };

    const textEn = {
        line1: "By continuing, you accept our",
        line2: "and authorize the processing of your personal data according to our",
        terminos: "Terms and Conditions",
        privacidad: "Privacy Policy"
    };

    const text = language === 'es' ? textEs : textEn;

    if (variant === 'compact') {
        return (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                    {text.line1}{' '}
                    <Link
                        href="/terminos-condiciones"
                        target="_blank"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                    >
                        {text.terminos}
                    </Link>
                    {' '}{text.line2}{' '}
                    <Link
                        href="/politica-privacidad"
                        target="_blank"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                    >
                        {text.privacidad}
                    </Link>.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="space-y-1.5">
                <p className="text-sm text-gray-500 leading-relaxed">
                    {text.line1}{' '}
                    <Link
                        href="/terminos-condiciones"
                        target="_blank"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                    >
                        {text.terminos}
                    </Link>
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">
                    {text.line2}{' '}
                    <Link
                        href="/politica-privacidad"
                        target="_blank"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                    >
                        {text.privacidad}
                    </Link>
                </p>
            </div>
        </div>
    );
}
