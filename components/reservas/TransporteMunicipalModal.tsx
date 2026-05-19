'use client';

import { useState, useEffect } from 'react';
import { FiX, FiMapPin, FiClock, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useLanguage } from '@/lib/i18n';
import { getLocalizedText } from '@/types/multi-language';

interface ViajeMunicipal {
    id: string;
    nombre: { es: string; en: string };
    descripcion: { es: string; en: string };
    duracion: string | null;
}

interface TransporteMunicipalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectService: (serviceId: string) => void;
    serviciosMunicipales: any[];
}

export default function TransporteMunicipalModal({
    isOpen,
    onClose,
    onSelectService,
    serviciosMunicipales,
}: TransporteMunicipalModalProps) {
    const { language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredViajes, setFilteredViajes] = useState<any[]>(serviciosMunicipales);

    useEffect(() => {
        setFilteredViajes(serviciosMunicipales);
    }, [serviciosMunicipales]);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredViajes(serviciosMunicipales);
        } else {
            const filtered = serviciosMunicipales.filter((viaje) => {
                const nombre = getLocalizedText(viaje.nombre, language).toLowerCase();
                const descripcion = getLocalizedText(viaje.descripcion, language).toLowerCase();
                const search = searchTerm.toLowerCase();
                return nombre.includes(search) || descripcion.includes(search);
            });
            setFilteredViajes(filtered);
        }
    }, [searchTerm, serviciosMunicipales, language]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {language === 'es' ? 'Transporte Municipal' : 'Municipal Transport'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                        >
                            <FiX size={24} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={language === 'es' ? 'Buscar destino...' : 'Search destination...'}
                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-[#D6A75D] outline-none transition-all"
                        />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        {filteredViajes.length} {language === 'es' ? 'destinos disponibles' : 'destinations available'}
                    </p>
                </div>

                {/* Lista de Destinos */}
                <div className="overflow-y-auto max-h-[60vh]">
                    {filteredViajes.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <FiMapPin className="mx-auto text-gray-300 mb-3" size={48} />
                            <p className="text-gray-600">
                                {language === 'es' 
                                    ? 'No se encontraron destinos' 
                                    : 'No destinations found'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredViajes.map((viaje) => (
                                <button
                                    key={viaje.id}
                                    onClick={() => {
                                        onSelectService(viaje.id);
                                        onClose();
                                    }}
                                    className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-[#D6A75D]/20 group-hover:text-[#D6A75D] transition-colors">
                                            <FiMapPin size={24} />
                                        </div>

                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#D6A75D] transition-colors">
                                                {getLocalizedText(viaje.nombre, language)}
                                            </h3>
                                            <p className="text-sm text-gray-600 line-clamp-1">
                                                {getLocalizedText(viaje.descripcion, language)}
                                            </p>
                                            {viaje.duracion && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                    <FiClock size={12} />
                                                    <span>{viaje.duracion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <FiChevronRight 
                                        className="text-gray-400 group-hover:text-[#D6A75D] group-hover:translate-x-1 transition-all" 
                                        size={24} 
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}





