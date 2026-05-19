'use client';

import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';

const WHATSAPP_NUMBER = '573106676736';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function WhatsAppButton() {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contactar por WhatsApp"
            className="whatsapp-float"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <FaWhatsapp size={28} />
            <span
                className="whatsapp-tooltip"
                style={{
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? 'translateX(0)' : 'translateX(10px)',
                }}
            >
                ¡Escríbenos!
            </span>

            <style jsx>{`
                .whatsapp-float {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 60px;
                    height: 60px;
                    background-color: #25D366;
                    color: white;
                    border-radius: 50%;
                    box-shadow: 0 4px 14px rgba(37, 211, 102, 0.45);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    text-decoration: none;
                    cursor: pointer;
                }

                .whatsapp-float:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 20px rgba(37, 211, 102, 0.6);
                }

                .whatsapp-tooltip {
                    position: absolute;
                    right: 72px;
                    background-color: #333;
                    color: white;
                    padding: 8px 14px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    white-space: nowrap;
                    pointer-events: none;
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }

                .whatsapp-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    right: -6px;
                    transform: translateY(-50%);
                    border-width: 6px;
                    border-style: solid;
                    border-color: transparent transparent transparent #333;
                }

                @media (max-width: 640px) {
                    .whatsapp-float {
                        bottom: 16px;
                        right: 16px;
                        width: 54px;
                        height: 54px;
                    }
                }
            `}</style>
        </a>
    );
}
