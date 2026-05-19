'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiMapPin, FiCheckCircle, FiXCircle, FiSearch } from 'react-icons/fi';
import Link from 'next/link';
import { getLocalizedText } from '@/types/multi-language';

interface ViajeMunicipal {
    id: string;
    nombre: { es: string; en: string };
    descripcion: { es: string; en: string };
    activo: boolean;
    imagen: string;
    vehiculosPermitidos: {
        id: string;
        precio: number;
        vehiculo: {
            id: string;
            nombre: string;
        };
    }[];
    tarifasPorMunicipio: any;
    _count: {
        reservas: number;
    };
}

export default function TransporteMunicipalPage() {
    const router = useRouter();
    const [viajes, setViajes] = useState<ViajeMunicipal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchViajes();
    }, []);

    const fetchViajes = async () => {
        try {
            setLoading(true);
            // Traer todos los servicios municipales sin límite
            const res = await fetch('/api/admin/servicios?esMunicipal=true&limit=1000');
            const data = await res.json();

            if (data.success) {
                setViajes(data.data);
            }
        } catch (error) {
            console.error('Error fetching viajes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/servicios/${id}/toggle`, {
                method: 'PATCH',
            });

            const data = await res.json();

            if (data.success) {
                setViajes(
                    viajes.map((v) =>
                        v.id === id ? { ...v, activo: data.data.activo } : v
                    )
                );
            }
        } catch (error) {
            console.error('Error toggling viaje:', error);
            alert('Error al cambiar estado del viaje');
        }
    };

    const handleDelete = async (id: string, nombre: any) => {
        const nombreES = getLocalizedText(nombre, 'ES');
        if (!confirm(`¿Estás seguro de eliminar el viaje a "${nombreES}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/servicios/${id}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (data.success) {
                setViajes(viajes.filter((v) => v.id !== id));
                alert('Viaje eliminado exitosamente');
            } else {
                alert(data.error || 'Error al eliminar viaje');
            }
        } catch (error) {
            console.error('Error deleting viaje:', error);
            alert('Error al eliminar viaje');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D6A75D]"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Transporte Municipal</h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona los destinos disponibles para transporte municipal
                    </p>
                </div>
                <Link
                    href="/admin/dashboard/servicios/transporte-municipal/crear"
                    className="flex items-center gap-2 px-6 py-3 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg transition-colors"
                >
                    <FiPlus size={20} />
                    Crear Nuevo Viaje
                </Link>
            </div>

            {/* Buscador */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por destino..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent transition-all"
                    />
                </div>
                {searchTerm && (
                    <p className="mt-2 text-sm text-gray-600">
                        Mostrando {viajes.filter((v) => 
                            getLocalizedText(v.nombre, 'ES').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            getLocalizedText(v.descripcion, 'ES').toLowerCase().includes(searchTerm.toLowerCase())
                        ).length} de {viajes.length} resultados
                    </p>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Viajes Activos</p>
                            <p className="text-3xl font-bold text-green-600">
                                {viajes.filter((v) => v.activo).length}
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <FiToggleRight className="text-green-600" size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Viajes */}
            {(() => {
                // Filtrar viajes según el término de búsqueda
                const filteredViajes = viajes.filter((v) =>
                    getLocalizedText(v.nombre, 'ES').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    getLocalizedText(v.descripcion, 'ES').toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (viajes.length === 0) {
                    return (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                            <FiMapPin className="mx-auto text-gray-400 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                No hay viajes municipales creados
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Crea tu primer viaje municipal para empezar a recibir reservas
                            </p>
                            <Link
                                href="/admin/dashboard/servicios/transporte-municipal/crear"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg transition-colors"
                            >
                                <FiPlus size={20} />
                                Crear Primer Viaje
                            </Link>
                        </div>
                    );
                }

                if (filteredViajes.length === 0) {
                    return (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                            <FiSearch className="mx-auto text-gray-400 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                No se encontraron resultados
                            </h3>
                            <p className="text-gray-600 mb-4">
                                No hay viajes que coincidan con &quot;{searchTerm}&quot;
                            </p>
                            <button
                                onClick={() => setSearchTerm('')}
                                className="px-6 py-3 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg transition-colors"
                            >
                                Limpiar búsqueda
                            </button>
                        </div>
                    );
                }

                return (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Destino
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Descripción
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Vehículos
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredViajes.map((viaje) => (
                                    <tr key={viaje.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-100 rounded-lg">
                                                    <FiMapPin className="text-gray-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">
                                                        {getLocalizedText(viaje.nombre, 'ES')}
                                                    </p>
                                                    {getLocalizedText(viaje.nombre, 'EN') !== getLocalizedText(viaje.nombre, 'ES') && (
                                                        <p className="text-xs text-gray-500">
                                                            {getLocalizedText(viaje.nombre, 'EN')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600 line-clamp-2 max-w-md">
                                                {getLocalizedText(viaje.descripcion, 'ES')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                                {viaje.vehiculosPermitidos.length}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                                                    viaje.activo
                                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                                        : 'bg-red-100 text-red-700 border border-red-300'
                                                }`}
                                            >
                                                {viaje.activo ? (
                                                    <>
                                                        <FiCheckCircle size={14} className="text-green-600" />
                                                        Activo
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiXCircle size={14} className="text-red-600" />
                                                        Inactivo
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/dashboard/servicios/${viaje.id}/editar`}
                                                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <FiEdit2 size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleToggleActive(viaje.id)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        viaje.activo
                                                            ? 'bg-green-100 hover:bg-green-200 text-green-600'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                    }`}
                                                    title={viaje.activo ? 'Desactivar' : 'Activar'}
                                                >
                                                    {viaje.activo ? (
                                                        <FiToggleRight size={18} className="text-green-600" />
                                                    ) : (
                                                        <FiToggleLeft size={18} className="text-gray-600" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(viaje.id, viaje.nombre)}
                                                    className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}

