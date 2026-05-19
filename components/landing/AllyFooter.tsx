'use client';

import Image from 'next/image';
import { FiPhone, FiMail } from 'react-icons/fi';
import { FaInstagram } from 'react-icons/fa';

export default function AllyFooter() {
    return (
        <footer className="bg-black text-white py-12 border-t border-gray-800">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Company Info */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="relative">
                                <Image
                                    src="/logo.png"
                                    alt="Transportes Medellín Travel"
                                    width={40}
                                    height={40}
                                    className="w-10 h-10 object-contain"
                                />
                            </div>
                            <h3 className="text-xl font-bold">Transportes Medellín Travel</h3>
                        </div>
                        <p className="text-gray-400 text-sm max-w-md">
                            Tu aliado de confianza para descubrir lo mejor de Medellín y sus alrededores con seguridad y confort.
                        </p>
                    </div>

                    {/* Contact Info - Sin enlaces */}
                    <div>
                        <h3 className="text-[#D6A75D] font-bold text-lg mb-4">Contacto</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-gray-300">
                                <FiPhone className="text-[#D6A75D] flex-shrink-0" size={18} />
                                <span className="text-sm">+57 310 6676736</span>
                            </div>

                            <div className="flex items-center gap-3 text-gray-300">
                                <FaInstagram className="text-[#D6A75D] flex-shrink-0" size={18} />
                                <span className="text-sm">@transportesmedellintravel</span>
                            </div>

                            <div className="flex items-center gap-3 text-gray-300">
                                <FiMail className="text-[#D6A75D] flex-shrink-0" size={18} />
                                <span className="text-sm">comercial@tmedellintravel.com</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="pt-6 border-t border-gray-800 text-center">
                    <p className="text-gray-400 text-sm">
                        © {new Date().getFullYear()} Transportes Medellín Travel. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
}

