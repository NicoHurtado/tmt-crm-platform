'use client';

import { useEffect, useRef } from 'react';

interface BoldButtonProps {
    orderId: string;
    amount: string; // Entero en string (ej: "150000")
    currency: string;
    apiKey: string;
    integritySignature: string;
    redirectionUrl: string;
    description: string;
    customerData?: {
        email?: string;
        fullName?: string;
        phone?: string;
        dialCode?: string;
    };
}

export const BoldButton = ({
    orderId,
    amount,
    currency,
    apiKey,
    integritySignature,
    redirectionUrl,
    description,
    customerData
}: BoldButtonProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://checkout.bold.co/library/boldPaymentButton.js';

        script.setAttribute('data-bold-button', 'dark-L');
        script.setAttribute('data-order-id', orderId);
        script.setAttribute('data-currency', currency);
        script.setAttribute('data-amount', amount);
        script.setAttribute('data-api-key', apiKey);
        script.setAttribute('data-integrity-signature', integritySignature);
        script.setAttribute('data-redirection-url', redirectionUrl);
        script.setAttribute('data-description', description);

        if (customerData) {
            script.setAttribute('data-customer-data', JSON.stringify(customerData));
        }

        containerRef.current.appendChild(script);

        const currentContainer = containerRef.current;
        return () => {
            if (currentContainer) {
                currentContainer.innerHTML = '';
            }
        };
    }, [orderId, amount, integritySignature, apiKey, redirectionUrl, currency, description, customerData]); // Solo recargar si cambian datos críticos

    return (
        <div
            ref={containerRef}
            className="bold-container my-4 flex justify-center"
            style={{ minHeight: '60px' }} // Reserva espacio para evitar saltos
        >
            {/* Bold inyectará el iframe/botón aquí */}
        </div>
    );
};
