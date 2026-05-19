// Hook personalizado para gestión de idioma
'use client';

import { useState, useEffect } from 'react';

export type Language = 'es' | 'en';

export function useLanguage() {
    const [language, setLanguageState] = useState<Language>('es');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load language from localStorage on mount
    useEffect(() => {
        const savedLanguage = localStorage.getItem('language') as Language;
        if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'en')) {
            setLanguageState(savedLanguage);
        }
        setIsLoaded(true);

        // Listen for language changes from other components
        const handleLanguageChange = (event: CustomEvent<Language>) => {
            setLanguageState(event.detail);
        };

        window.addEventListener('languageChange', handleLanguageChange as EventListener);

        return () => {
            window.removeEventListener('languageChange', handleLanguageChange as EventListener);
        };
    }, []);

    // Function to change language
    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);

        // Dispatch custom event for other components to listen
        window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }));
    };

    // Toggle between languages
    const toggleLanguage = () => {
        const newLang = language === 'es' ? 'en' : 'es';
        setLanguage(newLang);
    };

    return {
        language,
        setLanguage,
        toggleLanguage,
        isLoaded
    };
}
