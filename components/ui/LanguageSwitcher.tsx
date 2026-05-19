'use client';

import { useLanguage } from '@/lib/i18n';
import { FiGlobe } from 'react-icons/fi';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'es' ? 'en' : 'es');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            aria-label="Switch Language"
        >
            <FiGlobe className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'es' ? 'ES' : 'EN'}</span>
        </button>
    );
}
