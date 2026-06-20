'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FiMenu, FiX, FiGlobe, FiLogIn, FiCalendar, FiLogOut, FiChevronDown, FiUser } from 'react-icons/fi';
import AliadoModal from './AliadoModal';
import { CartIcon } from '@/components/carrito/CartIcon';
import { useLanguage, t } from '@/lib/i18n';
import { useAliado } from '@/lib/hooks/useAliado';
import { useRouter } from 'next/navigation';

interface HeaderProps {
    /** Muestra el ícono de carrito en la barra (solo páginas con carrito, ej. /reservas). */
    showCart?: boolean;
    onCartClick?: () => void;
}

export default function Header({ showCart = false, onCartClick }: HeaderProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAliadoModalOpen, setIsAliadoModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { language, toggleLanguage } = useLanguage();
    const { aliado, logout, ready } = useAliado();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
        router.push('/reservas');
    };

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-black/95 backdrop-blur-sm py-3 shadow-lg' : 'bg-black/90 py-5'
                    }`}
            >
                <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="relative z-50 flex items-center gap-3 group">
                        <div className="relative transition-transform group-hover:scale-105">
                            <Image
                                src="/logo.png"
                                alt="Transportes Medellín Travel"
                                width={48}
                                height={48}
                                className="w-10 h-10 md:w-12 md:h-12 object-contain"
                                priority
                            />
                        </div>
                        <span className="font-bold text-lg md:text-xl tracking-tight text-white">
                            Transportes Medellín
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <Link href="/#servicios" className="text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium">
                            {t('header.servicios', language)}
                        </Link>
                        <Link href="/reservas/transporte-municipal" className="text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium">
                            {t('header.transporteMunicipal', language)}
                        </Link>
                        <Link href="/#como-funciona" className="text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium">
                            {t('header.comoFunciona', language)}
                        </Link>
                        <Link href="/#testimonios" className="text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium">
                            {t('header.testimonios', language)}
                        </Link>

                        <div className="h-4 w-px bg-white/20"></div>

                        <button
                            onClick={toggleLanguage}
                            className="flex items-center gap-1 text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium"
                        >
                            <FiGlobe size={16} />
                            {language.toUpperCase()}
                        </button>

                        {showCart && onCartClick && (
                            <CartIcon onClick={onCartClick} className="!text-white hover:!bg-white/10" />
                        )}

                        <Link
                            href="/reservas"
                            className="bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 text-sm"
                        >
                            {t('header.reservar', language)}
                        </Link>

                        {/* Aliado Controls */}
                        {ready && (
                            aliado ? (
                                <div className="flex items-center gap-2">
                                    {/* Mis Reservas button */}
                                    <Link
                                        href="/reservas/mis-reservas"
                                        className="flex items-center gap-1.5 text-white/90 hover:text-[#D6A75D] transition-colors text-sm font-medium border border-white/20 hover:border-[#D6A75D]/50 px-3 py-1.5 rounded-lg"
                                    >
                                        <FiCalendar size={14} />
                                        Mis Reservas
                                    </Link>

                                    {/* Aliado dropdown */}
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-lg text-sm text-white"
                                        >
                                            <span className="w-6 h-6 rounded-full bg-[#D6A75D] flex items-center justify-center text-black font-bold text-xs">
                                                {aliado.nombre.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="max-w-[120px] truncate font-medium">{aliado.nombre}</span>
                                            <FiChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isDropdownOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Perfil Aliado</p>
                                                    <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{aliado.nombre}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{aliado.codigo}</p>
                                                </div>
                                                <Link
                                                    href="/reservas/mis-reservas"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                >
                                                    <FiCalendar size={15} className="text-gray-500" />
                                                    Ver mis reservas
                                                </Link>
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                                                >
                                                    <FiLogOut size={15} />
                                                    Cerrar sesión
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAliadoModalOpen(true)}
                                    className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-xs font-normal"
                                >
                                    <FiUser size={12} />
                                    Perfil
                                </button>
                            )
                        )}
                    </nav>

                    {/* Mobile: carrito + botón de menú */}
                    <div className="md:hidden flex items-center gap-1 relative z-50">
                        {showCart && onCartClick && !isMobileMenuOpen && (
                            <CartIcon onClick={onCartClick} className="!text-white hover:!bg-white/10" />
                        )}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-white p-2"
                            aria-label="Menú"
                        >
                            {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <div className={`fixed inset-0 bg-black/95 backdrop-blur-md z-30 transition-transform duration-300 md:hidden flex flex-col items-center justify-center gap-8 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>
                <Link
                    href="/#servicios"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-bold text-white hover:text-[#D6A75D] transition-colors"
                >
                    {t('header.servicios', language)}
                </Link>
                <Link
                    href="/reservas/transporte-municipal"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-bold text-white hover:text-[#D6A75D] transition-colors"
                >
                    {t('header.transporteMunicipal', language)}
                </Link>
                <Link
                    href="/#como-funciona"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-bold text-white hover:text-[#D6A75D] transition-colors"
                >
                    {t('header.comoFunciona', language)}
                </Link>
                <Link
                    href="/#testimonios"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-bold text-white hover:text-[#D6A75D] transition-colors"
                >
                    {t('header.testimonios', language)}
                </Link>

                <div className="w-16 h-px bg-white/20"></div>

                <button
                    onClick={() => { toggleLanguage(); setIsMobileMenuOpen(false); }}
                    className="text-xl font-medium text-white hover:text-[#D6A75D] transition-colors flex items-center gap-2"
                >
                    <FiGlobe /> {language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
                </button>

                {ready && aliado && (
                    <>
                        <div className="text-center">
                            <p className="text-white/60 text-sm">Conectado como</p>
                            <p className="text-white font-bold text-lg">{aliado.nombre}</p>
                        </div>
                        <Link
                            href="/reservas/mis-reservas"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-2 text-white/90 text-xl font-medium hover:text-[#D6A75D] transition-colors"
                        >
                            <FiCalendar /> Mis Reservas
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-red-400 text-lg font-medium hover:text-red-300 transition-colors"
                        >
                            <FiLogOut /> Cerrar sesión
                        </button>
                    </>
                )}

                {ready && !aliado && (
                    <button
                        onClick={() => { setIsMobileMenuOpen(false); setIsAliadoModalOpen(true); }}
                        className="flex items-center gap-2 text-white/80 text-xl font-medium hover:text-[#D6A75D] transition-colors"
                    >
                        <FiLogIn /> Ingresar con perfil
                    </button>
                )}

                <Link
                    href="/reservas"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="bg-[#D6A75D] text-black font-bold py-3 px-8 rounded-xl text-xl mt-4"
                >
                    {t('header.reservar', language)}
                </Link>
            </div>

            <AliadoModal
                isOpen={isAliadoModalOpen}
                onClose={() => setIsAliadoModalOpen(false)}
            />
        </>
    );
}
