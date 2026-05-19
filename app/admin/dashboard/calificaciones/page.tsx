'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiStar, FiEye, FiTrash2, FiGlobe, FiLock } from 'react-icons/fi';

export default function CalificacionesPage() {
    const router = useRouter();
    const [calificaciones, setCalificaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCalificaciones();
    }, []);

    const fetchCalificaciones = async () => {
        try {
            const res = await fetch('/api/calificaciones');
            if (res.ok) {
                const data = await res.json();
                setCalificaciones(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching calificaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePublico = async (id: string, currentValue: boolean) => {
        try {
            const res = await fetch(`/api/calificaciones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ esPublica: !currentValue }),
            });

            if (res.ok) {
                // Update local state
                setCalificaciones(calificaciones.map(cal =>
                    cal.id === id ? { ...cal, esPublica: !currentValue } : cal
                ));
            }
        } catch (error) {
            console.error('Error toggling public:', error);
        }
    };

    const eliminarCalificacion = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta calificación?')) return;

        try {
            const res = await fetch(`/api/calificaciones/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setCalificaciones(calificaciones.filter(cal => cal.id !== id));
            }
        } catch (error) {
            console.error('Error deleting calificacion:', error);
        }
    };

    const toggleDestacar = async (id: string, currentValue: boolean) => {
        const featuredCount = calificaciones.filter(c => c.destacada).length;

        if (!currentValue && featuredCount >= 3) {
            if (!confirm('Ya hay 3 reseñas destacadas. ¿Deseas reemplazar la más antigua con esta?')) {
                return;
            }
        }

        try {
            const res = await fetch(`/api/calificaciones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destacada: !currentValue }),
            });

            if (res.ok) {
                // Refresh all calificaciones to get updated order
                fetchCalificaciones();
            }
        } catch (error) {
            console.error('Error toggling destacada:', error);
        }
    };

    const renderStars = (estrellas: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <FiStar
                key={i}
                className={`inline ${i < estrellas ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                size={16}
            />
        ));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-black text-white py-6 shadow-lg">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold">Calificaciones</h1>
                    <p className="text-gray-400">Gestión de reviews de clientes</p>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                    ← Volver al Dashboard
                </button>

                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold">
                            Total: {calificaciones.length} calificaciones
                        </h2>
                        <p className="text-sm text-gray-600">
                            Públicas: {calificaciones.filter(c => c.esPublica).length} |
                            Privadas: {calificaciones.filter(c => !c.esPublica).length} |
                            <span className="font-semibold text-[#D6A75D]">
                                {' '}Destacadas: {calificaciones.filter(c => c.destacada).length}/3
                            </span>
                        </p>
                    </div>

                    {calificaciones.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No hay calificaciones aún
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-4 font-semibold">Estrellas</th>
                                        <th className="text-left p-4 font-semibold">Cliente</th>
                                        <th className="text-left p-4 font-semibold">Servicio</th>
                                        <th className="text-left p-4 font-semibold">Comentario</th>
                                        <th className="text-left p-4 font-semibold">Fecha</th>
                                        <th className="text-left p-4 font-semibold">Público</th>
                                        <th className="text-left p-4 font-semibold">Destacada</th>
                                        <th className="text-left p-4 font-semibold">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {calificaciones.map((cal) => (
                                        <tr key={cal.id} className={`border-b hover:bg-gray-50 ${cal.destacada ? 'bg-yellow-50 border-l-4 border-l-[#D6A75D]' : ''}`}>
                                            <td className="p-4">
                                                {renderStars(cal.estrellas)}
                                            </td>
                                            <td className="p-4">{cal.nombreCliente}</td>
                                            <td className="p-4">
                                                {(() => {
                                                    const nombre = cal.servicio?.nombre;
                                                    if (!nombre) return 'N/A';
                                                    if (typeof nombre === 'string') return nombre;
                                                    // Handle JSON object {es: "...", en: "..."}
                                                    return nombre.es || nombre.en || 'N/A';
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                <div className="max-w-xs truncate">
                                                    {cal.comentario || <span className="text-gray-400 italic">Sin comentario</span>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {new Date(cal.createdAt).toLocaleDateString('es-CO')}
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => togglePublico(cal.id, cal.esPublica)}
                                                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${cal.esPublica
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {cal.esPublica ? (
                                                        <>
                                                            <FiGlobe size={14} />
                                                            Público
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiLock size={14} />
                                                            Privado
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => toggleDestacar(cal.id, cal.destacada)}
                                                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${cal.destacada
                                                        ? 'bg-[#D6A75D] text-white hover:bg-[#C09650]'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {cal.destacada ? (
                                                        <>
                                                            ⭐ #{cal.ordenDestacada}
                                                        </>
                                                    ) : (
                                                        'Destacar'
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => alert(`Comentario completo:\n\n${cal.comentario || 'Sin comentario'}`)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Ver completo"
                                                    >
                                                        <FiEye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => eliminarCalificacion(cal.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded"
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
                    )}
                </div>

                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                        <strong>💡 Nota:</strong> Las calificaciones públicas aparecen automáticamente
                        en la sección de testimonios de la landing page. Las privadas solo son visibles aquí.
                    </p>
                </div>
            </main>
        </div>
    );
}
