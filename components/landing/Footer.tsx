'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FiInstagram, FiMail, FiPhone } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';

export default function Footer() {
    const { language } = useLanguage();

    return (
        <footer className="bg-black text-white pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                    {/* Brand */}
                    <div className="flex flex-col items-start">
                        <div className="relative mb-4">
                            <Image
                                src="/logo.png"
                                alt="Transportes Medellín Travel"
                                width={64}
                                height={64}
                                className="w-16 h-16 object-contain"
                            />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Transportes Medellín Travel</h3>
                        <p className="text-gray-400 text-sm max-w-xs">
                            {t('landing.footer_descripcion', language)}
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-lg font-bold mb-6 text-[#D6A75D]">
                            {t('landing.footer_enlaces', language)}
                        </h4>
                        <ul className="space-y-3 text-gray-300">
                            <li>
                                <Link href="/" className="hover:text-white transition-colors">
                                    {t('landing.footer_inicio', language)}
                                </Link>
                            </li>
                            <li>
                                <Link href="/reservas" className="hover:text-white transition-colors">
                                    {t('header.reservar', language)}
                                </Link>
                            </li>
                            <li>
                                <Link href="/admin/login" className="hover:text-white transition-colors">
                                    {t('landing.footer_admin', language)}
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="hover:text-white transition-colors">
                                    {t('landing.footer_terminos', language)}
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="hover:text-white transition-colors">
                                    {t('landing.footer_privacidad', language)}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-lg font-bold mb-6 text-[#D6A75D]">
                            {t('landing.footer_contacto', language)}
                        </h4>
                        <ul className="space-y-4 text-gray-300">
                            <li>
                                <a
                                    href="https://wa.me/573106676736"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 hover:text-white transition-colors"
                                >
                                    <FiPhone className="text-[#D6A75D]" />
                                    <span>+57 310 6676736</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://instagram.com/transportesmedellintravel"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 hover:text-white transition-colors"
                                >
                                    <FiInstagram className="text-[#D6A75D]" />
                                    <span>@transportesmedellintravel</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="mailto:comercial@tmedellintravel.com"
                                    className="flex items-center gap-3 hover:text-white transition-colors"
                                >
                                    <FiMail className="text-[#D6A75D]" />
                                    <span>comercial@tmedellintravel.com</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} Transportes Medellín Travel. {t('landing.footer_derechos', language)}</p>
                </div>
            </div>
        </footer>
    );
}
