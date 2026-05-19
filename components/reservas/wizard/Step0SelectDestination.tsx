'use client';

import { useState, useEffect } from 'react';
import { FiMapPin, FiClock, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import { getLocalizedText } from '@/types/multi-language';

interface ViajeMunicipal {
    id: string;
    nombre: { es: string; en: string };
    descripcion: { es: string; en: string };
    imagen: string;
    duracion: string | null;
    vehiculosPermitidos: {
        precio: number;
    }[];
}

interface Step0SelectDestinationProps {
    onSelectDestination: (serviceId: string) => void;
}

export default function Step0SelectDestination({ onSelectDestination }: Step0SelectDestinationProps) {
    const { language } = useLanguage();
    const [viajes, setViajes] = useState<ViajeMunicipal[]>([]);
    const [filteredViajes, setFilteredViajes] = useState<ViajeMunicipal[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchViajes();
    }, []);

    useEffect(() => {
        // Filter viajes based on search term
        if (searchTerm.trim() === '') {
            setFilteredViajes(viajes);
        } else {
            const filtered = viajes.filter((viaje) => {
                const nombre = getLocalizedText(viaje.nombre, language).toLowerCase();
                const descripcion = getLocalizedText(viaje.descripcion, language).toLowerCase();
                const search = searchTerm.toLowerCase();
                return nombre.includes(search) || descripcion.includes(search);
            });
            setFilteredViajes(filtered);
        }
    }, [searchTerm, viajes, language]);

    const fetchViajes = async () => {
        try {
            const res = await fetch('/api/servicios?esMunicipal=true&activo=true');
            const data = await res.json();
            
            if (data.success) {
                setViajes(data.data);
                setFilteredViajes(data.data);
            }
        } catch (error) {
            console.error('Error fetching viajes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (serviceId: string) => {
        setSelectedId(serviceId);
        // Small delay for visual feedback
        setTimeout(() => {
            onSelectDestination(serviceId);
        }, 200);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]"></div>
            </div>
        );
    }

    if (viajes.length === 0) {
        return (
            <div className="text-center py-12">
                <FiMapPin className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {language === 'es' ? 'No hay destinos disponibles' : 'No destinations available'}
                </h3>
                <p className="text-gray-600">
                    {language === 'es' 
                        ? 'Por favor intenta más tarde' 
                        : 'Please try again later'}
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {language === 'es' ? '¿A dónde quieres ir?' : 'Where do you want to go?'}
                </h2>
                <p className="text-gray-500 text-sm">
                    {language === 'es'
                        ? 'Elige tu destino para ver los servicios disponibles'
                        : 'Choose your destination to see available services'}
                </p>
            </div>

            {/* Search Bar */}
            <div className="mb-5">
                <div className="relative">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={language === 'es' ? 'Buscar destino...' : 'Search destination...'}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                    />
                </div>
            </div>

            {/* Grid de Destinos */}
            {filteredViajes.length === 0 ? (
                <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiMapPin className="text-gray-400" size={24} />
                    </div>
                    <p className="text-gray-500 text-sm">
                        {language === 'es'
                            ? 'No se encontraron destinos con ese término'
                            : 'No destinations found for that term'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {filteredViajes.map((viaje) => {
                        const isSelected = selectedId === viaje.id;
                        const nombre = getLocalizedText(viaje.nombre, language);
                        const descripcion = getLocalizedText(viaje.descripcion, language);
                        const minPrice = viaje.vehiculosPermitidos?.length
                            ? Math.min(...viaje.vehiculosPermitidos.map((v) => v.precio))
                            : null;

                        return (
                            <button
                                key={viaje.id}
                                onClick={() => handleSelect(viaje.id)}
                                className={`group text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden
                                    ${isSelected
                                        ? 'border-[#D6A75D] shadow-md'
                                        : 'border-gray-100 hover:border-gray-200 hover:shadow-md bg-white'
                                    }`}
                            >
                                {/* Image or color block */}
                                <div className={`relative h-32 overflow-hidden ${isSelected ? 'bg-[#D6A75D]/10' : 'bg-gray-50'}`}>
                                    {viaje.imagen ? (
                                        <img
                                            src={viaje.imagen}
                                            alt={nombre}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FiMapPin size={32} className={isSelected ? 'text-[#D6A75D]' : 'text-gray-300'} />
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 bg-[#D6A75D] text-black text-xs font-bold px-2 py-0.5 rounded-full">
                                            ✓
                                        </div>
                                    )}
                                    {minPrice !== null && (
                                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                                            {language === 'es' ? 'Desde' : 'From'} ${minPrice.toLocaleString('es-CO')}
                                        </div>
                                    )}
                                </div>

                                {/* Card body */}
                                <div className="p-3">
                                    <h3 className={`font-bold text-sm mb-0.5 ${isSelected ? 'text-[#D6A75D]' : 'text-gray-900'}`}>
                                        {nombre}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                        {descripcion}
                                    </p>
                                    {viaje.duracion && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <FiClock size={11} className="text-gray-400" />
                                            <span className="text-xs text-gray-400">{viaje.duracion}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

