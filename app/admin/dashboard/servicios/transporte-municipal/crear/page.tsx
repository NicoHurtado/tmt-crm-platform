'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiSave, FiPlus, FiX } from 'react-icons/fi';
import Link from 'next/link';
import DynamicFieldBuilder from '@/components/admin/DynamicFieldBuilder';
import { DynamicField } from '@/types/dynamic-fields';

interface Vehiculo {
    id: string;
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
    imagen: string;
}


export default function CrearViajeMunicipalPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

    // Información Básica
    const [nombreES, setNombreES] = useState('');
    const [nombreEN, setNombreEN] = useState('');
    const [descripcionES, setDescripcionES] = useState('');
    const [descripcionEN, setDescripcionEN] = useState('');
    const [duracion, setDuracion] = useState('');
    
    // Qué Incluye
    const [incluyeES, setIncluyeES] = useState<string[]>(['']);
    const [incluyeEN, setIncluyeEN] = useState<string[]>(['']);

    // Vehículos y Precios
    const [vehiculosSeleccionados, setVehiculosSeleccionados] = useState<
        { vehiculoId: string; precio: number }[]
    >([]);

    // Campos Dinámicos (Opcionales)
    const [camposPersonalizados, setCamposPersonalizados] = useState<DynamicField[]>([]);

    useEffect(() => {
        fetchVehiculos();
    }, []);

    const fetchVehiculos = async () => {
        try {
            const res = await fetch('/api/admin/vehiculos');
            const data = await res.json();
            if (data.success) {
                setVehiculos(data.data);
            }
        } catch (error) {
            console.error('Error fetching vehicles:', error);
        }
    };

    // Handlers para "Incluye" ES
    const handleAddIncluyeES = () => {
        setIncluyeES([...incluyeES, '']);
    };

    const handleRemoveIncluyeES = (index: number) => {
        setIncluyeES(incluyeES.filter((_, i) => i !== index));
    };

    const handleIncluyeChangeES = (index: number, value: string) => {
        const updated = [...incluyeES];
        updated[index] = value;
        setIncluyeES(updated);
    };

    // Handlers para "Incluye" EN
    const handleAddIncluyeEN = () => {
        setIncluyeEN([...incluyeEN, '']);
    };

    const handleRemoveIncluyeEN = (index: number) => {
        setIncluyeEN(incluyeEN.filter((_, i) => i !== index));
    };

    const handleIncluyeChangeEN = (index: number, value: string) => {
        const updated = [...incluyeEN];
        updated[index] = value;
        setIncluyeEN(updated);
    };

    // Handlers para Vehículos
    const handleVehiculoToggle = (vehiculoId: string) => {
        const exists = vehiculosSeleccionados.find((v) => v.vehiculoId === vehiculoId);
        if (exists) {
            setVehiculosSeleccionados(
                vehiculosSeleccionados.filter((v) => v.vehiculoId !== vehiculoId)
            );
        } else {
            setVehiculosSeleccionados([
                ...vehiculosSeleccionados,
                { vehiculoId, precio: 0 },
            ]);
        }
    };

    const handleVehiculoPrecioChange = (vehiculoId: string, precio: number) => {
        setVehiculosSeleccionados(
            vehiculosSeleccionados.map((v) =>
                v.vehiculoId === vehiculoId ? { ...v, precio } : v
            )
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validaciones
        if (!nombreES || !nombreEN) {
            alert('Por favor completa el nombre del destino en ambos idiomas');
            return;
        }

        if (!descripcionES || !descripcionEN) {
            alert('Por favor completa la descripción en ambos idiomas');
            return;
        }

        if (vehiculosSeleccionados.length === 0) {
            alert('Por favor selecciona al menos un vehículo');
            return;
        }

        // Verificar que todos los vehículos tengan precio
        const vehiculosSinPrecio = vehiculosSeleccionados.filter((v) => v.precio <= 0);
        if (vehiculosSinPrecio.length > 0) {
            alert('Por favor asigna un precio a todos los vehículos seleccionados');
            return;
        }

        setLoading(true);

        try {
            const payload = {
                esMunicipal: true,
                
                // Información bilingüe
                nombre: { es: nombreES, en: nombreEN },
                descripcion: { es: descripcionES, en: descripcionEN },
                incluye: {
                    es: incluyeES.filter((item) => item.trim() !== ''),
                    en: incluyeEN.filter((item) => item.trim() !== ''),
                },
                
                // Imagen y duración
                imagen: '/antioquia.jpg', // Imagen por defecto para todos los viajes municipales
                duracion,
                
                // Precio base (usamos el menor precio de vehículo)
                precioBase: Math.min(...vehiculosSeleccionados.map((v) => v.precio)),
                
                // Vehículos
                vehiculosPermitidos: vehiculosSeleccionados,
                
                // Campos dinámicos opcionales
                camposPersonalizados,
                
                // Configuración específica
                esAeropuerto: false,
                esPorHoras: false,
                aplicaRecargoNocturno: false,
                destinoAutoFill: nombreES, // El destino es el nombre del viaje
                activo: true,
            };

            const res = await fetch('/api/admin/servicios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                alert('Viaje municipal creado exitosamente');
                router.push('/admin/dashboard/servicios/transporte-municipal');
            } else {
                alert(data.error || 'Error al crear viaje');
            }
        } catch (error) {
            console.error('Error creating viaje:', error);
            alert('Error al crear viaje');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/admin/dashboard/servicios/transporte-municipal"
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <FiArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Crear Viaje Municipal</h1>
                        <p className="text-gray-600">Configura un nuevo destino de transporte municipal</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Información Básica */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Información del Destino</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nombre del Destino (Español) *
                                </label>
                                <input
                                    type="text"
                                    value={nombreES}
                                    onChange={(e) => setNombreES(e.target.value)}
                                    placeholder="Ej: Fredonia"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Destination Name (English) *
                                </label>
                                <input
                                    type="text"
                                    value={nombreEN}
                                    onChange={(e) => setNombreEN(e.target.value)}
                                    placeholder="Ex: Fredonia"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Descripción (Español) *
                                </label>
                                <textarea
                                    value={descripcionES}
                                    onChange={(e) => setDescripcionES(e.target.value)}
                                    placeholder="Describe el viaje..."
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description (English) *
                                </label>
                                <textarea
                                    value={descripcionEN}
                                    onChange={(e) => setDescripcionEN(e.target.value)}
                                    placeholder="Describe the trip..."
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Duración Estimada (Opcional)
                            </label>
                            <input
                                type="text"
                                value={duracion}
                                onChange={(e) => setDuracion(e.target.value)}
                                placeholder="Ej: 2 horas"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                            />
                        </div>
                    </div>


                    {/* Qué Incluye */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">¿Qué Incluye?</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Español */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Español
                                </label>
                                {incluyeES.map((item, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={item}
                                            onChange={(e) => handleIncluyeChangeES(index, e.target.value)}
                                            placeholder="Ej: Transporte privado"
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                        />
                                        {incluyeES.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIncluyeES(index)}
                                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                            >
                                                <FiX />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddIncluyeES}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <FiPlus /> Agregar Item
                                </button>
                            </div>

                            {/* English */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    English
                                </label>
                                {incluyeEN.map((item, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={item}
                                            onChange={(e) => handleIncluyeChangeEN(index, e.target.value)}
                                            placeholder="Ex: Private transport"
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                        />
                                        {incluyeEN.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIncluyeEN(index)}
                                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                            >
                                                <FiX />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddIncluyeEN}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <FiPlus /> Add Item
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Vehículos y Precios */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Vehículos Disponibles *</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Selecciona los vehículos que estarán disponibles y asigna el precio para cada uno
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehiculos.map((vehiculo) => {
                                const isSelected = vehiculosSeleccionados.find(
                                    (v) => v.vehiculoId === vehiculo.id
                                );

                                return (
                                    <div
                                        key={vehiculo.id}
                                        className={`border-2 rounded-lg p-4 transition-all ${
                                            isSelected
                                                ? 'border-[#D6A75D] bg-yellow-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!isSelected}
                                                onChange={() => handleVehiculoToggle(vehiculo.id)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <h3 className="font-bold text-gray-900">{vehiculo.nombre}</h3>
                                                <p className="text-sm text-gray-600">
                                                    Capacidad: {vehiculo.capacidadMinima}-{vehiculo.capacidadMaxima}{' '}
                                                    pasajeros
                                                </p>
                                                {isSelected && (
                                                    <div className="mt-3">
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            Precio (COP)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={isSelected.precio}
                                                            onChange={(e) =>
                                                                handleVehiculoPrecioChange(
                                                                    vehiculo.id,
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Campos Dinámicos (Opcionales) */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Campos Adicionales (Opcional)</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Agrega campos personalizados si necesitas información adicional del cliente
                        </p>
                        <DynamicFieldBuilder
                            fields={camposPersonalizados}
                            onChange={setCamposPersonalizados}
                        />
                    </div>

                    {/* Botones */}
                    <div className="flex gap-4">
                        <Link
                            href="/admin/dashboard/servicios/transporte-municipal"
                            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-center transition-colors"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <FiSave />
                                    Crear Viaje Municipal
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

