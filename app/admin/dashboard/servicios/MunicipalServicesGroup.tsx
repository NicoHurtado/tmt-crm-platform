import { useState } from 'react';
import { FiChevronDown, FiChevronRight, FiSearch, FiToggleLeft, FiToggleRight, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Image from 'next/image';
import Link from 'next/link';
import { getLocalizedText } from '@/types/multi-language';

interface Servicio {
    id: string;
    nombre: string;
    descripcion: string;
    imagen: string;
    activo: boolean;
    precioBase: number;
    esAeropuerto: boolean;
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    vehiculosPermitidos: {
        id: string;
        precio: number;
        vehiculo: {
            id: string;
            nombre: string;
        };
    }[];
    _count: {
        reservas: number;
    };
}

interface MunicipalServicesGroupProps {
    servicios: Servicio[];
    onToggle: (id: string) => void;
    onDelete: (id: string, nombre: any) => void;
}

export default function MunicipalServicesGroup({
    servicios,
    onToggle,
    onDelete,
}: MunicipalServicesGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredServicios = servicios.filter((servicio) =>
        getLocalizedText(servicio.nombre, 'ES')
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

    if (servicios.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm mb-4 border border-gray-200 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        {isExpanded ? <FiChevronDown size={24} /> : <FiChevronRight size={24} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Transporte Municipal</h3>
                        <p className="text-sm text-gray-500">
                            {servicios.length} destinos disponibles
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                    {/* Search */}
                    <div className="mb-4 relative max-w-md">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar pueblo o municipio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent bg-white"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {filteredServicios.map((servicio) => (
                            <div
                                key={servicio.id}
                                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                                        <Image
                                            src={servicio.imagen || '/placeholder.jpg'}
                                            alt={getLocalizedText(servicio.nombre, 'ES')}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 truncate">
                                                    {getLocalizedText(servicio.nombre, 'ES')}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {servicio.destinoAutoFill && (
                                                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">
                                                            {servicio.destinoAutoFill}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500">
                                                        ${Number(servicio.precioBase).toLocaleString('es-CO')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggle(servicio.id);
                                                    }}
                                                    className={`p-1.5 rounded transition-colors ${servicio.activo
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-gray-400 hover:bg-gray-50'
                                                        }`}
                                                    title={servicio.activo ? 'Desactivar' : 'Activar'}
                                                >
                                                    {servicio.activo ? (
                                                        <FiToggleRight size={20} />
                                                    ) : (
                                                        <FiToggleLeft size={20} />
                                                    )}
                                                </button>
                                                <Link
                                                    href={`/admin/dashboard/servicios/${servicio.id}/editar`}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={16} />
                                                </Link>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(servicio.id, servicio.nombre);
                                                    }}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredServicios.length === 0 && (
                            <p className="text-center text-gray-500 py-4">
                                No se encontraron municipios con ese nombre
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
