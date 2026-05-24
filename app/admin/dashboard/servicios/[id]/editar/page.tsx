'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Save, Plus, X, Languages } from 'lucide-react';
import Link from 'next/link';
import ImageUploader from '@/components/admin/ImageUploader';
import { getLocalizedText, getLocalizedArray } from '@/types/multi-language';
import { TimeInput } from '@/components/ui';
import { Switch } from '@/components/ui/switch';
import DynamicFieldBuilder from '@/components/admin/DynamicFieldBuilder';
import { DynamicField } from '@/types/dynamic-fields';
import { InfoTourCompartidoEditor } from '@/components/admin/InfoTourCompartidoEditor';
import {
    EMPTY_INFO_TOUR_COMPARTIDO,
    infoTourCompartidoForAdminForm,
    type InfoTourCompartidoShape,
} from '@/lib/info-tour-compartido';

interface Vehiculo {
    id: string;
    nombre: string;
    capacidadMinima: number;
    capacidadMaxima: number;
    imagen: string;
}

export default function EditarServicioPage() {
    const router = useRouter();
    const params = useParams();
    const servicioId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

    // Basic Info - Multi-language
    const [nombreES, setNombreES] = useState('');
    const [nombreEN, setNombreEN] = useState('');
    const [descripcionES, setDescripcionES] = useState('');
    const [descripcionEN, setDescripcionEN] = useState('');
    const [imagen, setImagen] = useState('');
    const [duracion, setDuracion] = useState('');
    const [incluyeES, setIncluyeES] = useState<string[]>(['']);
    const [incluyeEN, setIncluyeEN] = useState<string[]>(['']);

    // Night Surcharge
    const [aplicaRecargoNocturno, setAplicaRecargoNocturno] = useState(false);
    const [recargoNocturnoInicio, setRecargoNocturnoInicio] = useState('22:00');
    const [recargoNocturnoFin, setRecargoNocturnoFin] = useState('06:00');
    const [montoRecargoNocturno, setMontoRecargoNocturno] = useState(0);

    // Module flags
    const [esAeropuerto, setEsAeropuerto] = useState(false);
    const [esTraslado, setEsTraslado] = useState(false);
    const [esPorHoras, setEsPorHoras] = useState(false);
    const [esCompartido, setEsCompartido] = useState(false);
    const [infoTourCompartido, setInfoTourCompartido] = useState<InfoTourCompartidoShape>(() => ({
        ...EMPTY_INFO_TOUR_COMPARTIDO,
    }));
    const [esMunicipal, setEsMunicipal] = useState(false);
    const [destinoAutoFill, setDestinoAutoFill] = useState('');

    // Display order in public catalog
    const [orden, setOrden] = useState(999);

    // Dynamic custom fields shown in the reservation wizard
    const [camposPersonalizados, setCamposPersonalizados] = useState<DynamicField[]>([]);

    // Guides
    const [guiaEspanolDisponible, setGuiaEspanolDisponible] = useState(false);
    const [precioGuiaEspanol, setPrecioGuiaEspanol] = useState<number | null>(null);
    const [guiaInglesDisponible, setGuiaInglesDisponible] = useState(false);
    const [precioGuiaIngles, setPrecioGuiaIngles] = useState<number | null>(null);

    // Vehicles — each selected vehicle has its own service price
    const [vehiculosSeleccionados, setVehiculosSeleccionados] = useState<
        { vehiculoId: string; precio: number }[]
    >([]);

    useEffect(() => {
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

        const fetchServicio = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/admin/servicios/${servicioId}`);
                const data = await res.json();

                if (data.success) {
                    const servicio = data.data;

                    setNombreES(getLocalizedText(servicio.nombre, 'ES'));
                    setNombreEN(getLocalizedText(servicio.nombre, 'EN'));
                    setDescripcionES(getLocalizedText(servicio.descripcion, 'ES'));
                    setDescripcionEN(getLocalizedText(servicio.descripcion, 'EN'));
                    setImagen(servicio.imagen);
                    setDuracion(servicio.duracion || '');

                    const incluyeArrayES = getLocalizedArray(servicio.incluye, 'ES');
                    const incluyeArrayEN = getLocalizedArray(servicio.incluye, 'EN');
                    setIncluyeES(incluyeArrayES.length > 0 ? incluyeArrayES : ['']);
                    setIncluyeEN(incluyeArrayEN.length > 0 ? incluyeArrayEN : ['']);

                    setAplicaRecargoNocturno(servicio.aplicaRecargoNocturno);
                    setRecargoNocturnoInicio(servicio.recargoNocturnoInicio || '22:00');
                    setRecargoNocturnoFin(servicio.recargoNocturnoFin || '06:00');
                    setMontoRecargoNocturno(Number(servicio.montoRecargoNocturno || 0));

                    setEsAeropuerto(servicio.esAeropuerto || false);
                    setEsTraslado(servicio.esTraslado || false);
                    setEsPorHoras(servicio.esPorHoras || false);
                    setEsCompartido(servicio.esCompartido || false);
                    setInfoTourCompartido(infoTourCompartidoForAdminForm(servicio.infoTourCompartido));
                    setEsMunicipal(servicio.esMunicipal || false);
                    setDestinoAutoFill(servicio.destinoAutoFill || '');
                    setOrden(servicio.orden ?? 999);

                    // Load custom fields
                    if (Array.isArray(servicio.camposPersonalizados) && servicio.camposPersonalizados.length > 0) {
                        setCamposPersonalizados(servicio.camposPersonalizados as DynamicField[]);
                    }

                    setGuiaEspanolDisponible(servicio.guiaEspanolDisponible || false);
                    setPrecioGuiaEspanol(servicio.precioGuiaEspanol ? Number(servicio.precioGuiaEspanol) : null);
                    setGuiaInglesDisponible(servicio.guiaInglesDisponible || false);
                    setPrecioGuiaIngles(servicio.precioGuiaIngles ? Number(servicio.precioGuiaIngles) : null);

                    setVehiculosSeleccionados(
                        servicio.vehiculosPermitidos.map((v: any) => ({
                            vehiculoId: v.vehiculoId,
                            precio: Number(v.precio ?? 0),
                        }))
                    );
                } else {
                    alert('Error al cargar el servicio');
                    router.push('/admin/dashboard/servicios');
                }
            } catch (error) {
                console.error('Error fetching service:', error);
                alert('Error al cargar el servicio');
                router.push('/admin/dashboard/servicios');
            } finally {
                setLoading(false);
            }
        };

        fetchVehiculos();
        fetchServicio();
    }, [servicioId, router]);

    const handleAddIncluyeES = () => setIncluyeES([...incluyeES, '']);
    const handleRemoveIncluyeES = (index: number) => setIncluyeES(incluyeES.filter((_, i) => i !== index));
    const handleIncluyeChangeES = (index: number, value: string) => {
        const updated = [...incluyeES];
        updated[index] = value;
        setIncluyeES(updated);
    };

    const handleAddIncluyeEN = () => setIncluyeEN([...incluyeEN, '']);
    const handleRemoveIncluyeEN = (index: number) => setIncluyeEN(incluyeEN.filter((_, i) => i !== index));
    const handleIncluyeChangeEN = (index: number, value: string) => {
        const updated = [...incluyeEN];
        updated[index] = value;
        setIncluyeEN(updated);
    };

    const handleVehiculoToggle = (vehiculoId: string) => {
        const exists = vehiculosSeleccionados.find((v) => v.vehiculoId === vehiculoId);
        if (exists) {
            setVehiculosSeleccionados(vehiculosSeleccionados.filter((v) => v.vehiculoId !== vehiculoId));
        } else {
            setVehiculosSeleccionados([...vehiculosSeleccionados, { vehiculoId, precio: 0 }]);
        }
    };

    const handleVehiculoPrecioChange = (vehiculoId: string, precio: number) => {
        setVehiculosSeleccionados(vehiculosSeleccionados.map((v) =>
            v.vehiculoId === vehiculoId ? { ...v, precio } : v
        ));
    };

    const sortedVehiculos = [...vehiculos].sort((a, b) => a.capacidadMinima - b.capacidadMinima);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nombreES || !nombreEN || !descripcionES || !descripcionEN) {
            alert('Por favor completa todos los campos requeridos en ambos idiomas');
            return;
        }

        if (!imagen) {
            alert('Por favor sube una imagen del servicio. Recuerda hacer clic en el boton "Subir" despues de seleccionar el archivo.');
            return;
        }

        if (!esCompartido && vehiculosSeleccionados.length === 0) {
            alert('Debes seleccionar al menos un vehiculo');
            return;
        }

        const sinPrecio = vehiculosSeleccionados.find((v) => !v.precio || v.precio <= 0);
        if (sinPrecio) {
            alert('Cada vehículo seleccionado debe tener un precio mayor a 0');
            return;
        }

        setSaving(true);

        try {
            const res = await fetch(`/api/admin/servicios/${servicioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: { es: nombreES, en: nombreEN },
                    descripcion: { es: descripcionES, en: descripcionEN },
                    imagen,
                    duracion: duracion || null,
                    incluye: {
                        es: incluyeES.filter((i) => i.trim() !== ''),
                        en: incluyeEN.filter((i) => i.trim() !== '')
                    },
                    aplicaRecargoNocturno,
                    recargoNocturnoInicio: aplicaRecargoNocturno ? recargoNocturnoInicio : null,
                    recargoNocturnoFin: aplicaRecargoNocturno ? recargoNocturnoFin : null,
                    montoRecargoNocturno: aplicaRecargoNocturno ? montoRecargoNocturno : null,
                    esAeropuerto,
                    esTraslado,
                    esPorHoras,
                    esCompartido,
                    esMunicipal,
                    destinoAutoFill: destinoAutoFill || null,
                    infoTourCompartido: esCompartido ? infoTourCompartido : null,
                    guiaEspanolDisponible,
                    precioGuiaEspanol: guiaEspanolDisponible ? precioGuiaEspanol : null,
                    guiaInglesDisponible,
                    precioGuiaIngles: guiaInglesDisponible ? precioGuiaIngles : null,
                    orden,
                    camposPersonalizados,
                    vehiculos: vehiculosSeleccionados.map((v) => ({ vehiculoId: v.vehiculoId, precio: v.precio })),
                }),
            });

            const data = await res.json();

            if (data.success) {
                alert('Servicio actualizado exitosamente');
                router.push('/admin/dashboard/servicios');
            } else {
                alert(data.error || 'Error al actualizar servicio');
            }
        } catch (error) {
            console.error('Error updating service:', error);
            alert('Error al actualizar servicio');
        } finally {
            setSaving(false);
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
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/admin/dashboard/servicios"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Editar Servicio</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Modifica la configuracion del servicio
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ─── SECTION 1: Basic Information ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-base font-semibold text-gray-900">Informacion Basica</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Completa la informacion en ambos idiomas (Espanol e Ingles)
                        </p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Nombre */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Nombre del Servicio <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                                        <span className="text-xs">ES</span> Espanol
                                    </label>
                                    <input
                                        type="text"
                                        value={nombreES}
                                        onChange={(e) => setNombreES(e.target.value)}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        placeholder="ej: Tour Guatape Premium"
                                    />
                                </div>
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                                        <span className="text-xs">EN</span> English
                                    </label>
                                    <input
                                        type="text"
                                        value={nombreEN}
                                        onChange={(e) => setNombreEN(e.target.value)}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        placeholder="ex: Guatape Premium Tour"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Descripcion */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Descripcion <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                                        <span className="text-xs">ES</span> Espanol
                                    </label>
                                    <textarea
                                        value={descripcionES}
                                        onChange={(e) => setDescripcionES(e.target.value)}
                                        required
                                        rows={4}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors resize-none"
                                        placeholder="Describe el servicio..."
                                    />
                                </div>
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                                        <span className="text-xs">EN</span> English
                                    </label>
                                    <textarea
                                        value={descripcionEN}
                                        onChange={(e) => setDescripcionEN(e.target.value)}
                                        required
                                        rows={4}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors resize-none"
                                        placeholder="Describe the service..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Image + Duration row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ImageUploader
                                currentImageUrl={imagen}
                                onImageUploaded={(url) => setImagen(url)}
                                label="Imagen del Servicio *"
                            />
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Duracion (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={duracion}
                                        onChange={(e) => setDuracion(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        placeholder="ej: 8 horas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Auto-rellenar destino (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={destinoAutoFill}
                                        onChange={(e) => setDestinoAutoFill(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        placeholder="ej: Guatape"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Posición en catálogo de reservas
                                    </label>
                                    <input
                                        type="number"
                                        value={orden}
                                        onChange={(e) => setOrden(Number(e.target.value))}
                                        min="1"
                                        max="999"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">1 = primero, 999 = al final</p>
                                </div>
                            </div>
                        </div>

                        {/* What's Included */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Que incluye
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                                        <span className="text-xs">ES</span> Espanol
                                    </label>
                                    <div className="space-y-2">
                                        {incluyeES.map((item, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={item}
                                                    onChange={(e) => handleIncluyeChangeES(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                                    placeholder="ej: Transporte privado"
                                                />
                                                {incluyeES.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveIncluyeES(index)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={handleAddIncluyeES}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[#D6A75D] hover:text-[#C5964A] transition-colors"
                                        >
                                            <Plus size={14} /> Agregar item
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                                        <span className="text-xs">EN</span> English
                                    </label>
                                    <div className="space-y-2">
                                        {incluyeEN.map((item, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={item}
                                                    onChange={(e) => handleIncluyeChangeEN(index, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                                    placeholder="ex: Private transport"
                                                />
                                                {incluyeEN.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveIncluyeEN(index)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={handleAddIncluyeEN}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-[#D6A75D] hover:text-[#C5964A] transition-colors"
                                        >
                                            <Plus size={14} /> Add item
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── SECTION 2: Service Modules ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-base font-semibold text-gray-900">Modulos del Servicio</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Activa los modulos que aplican a este servicio
                        </p>
                    </div>

                    <div className="p-6 space-y-3">
                        {/* Aeropuerto */}
                        <div
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${esAeropuerto ? 'border-[#D6A75D] bg-[#D6A75D]/5' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setEsAeropuerto(!esAeropuerto)}
                        >
                            <Switch checked={esAeropuerto} onClick={(e) => { e.stopPropagation(); setEsAeropuerto(!esAeropuerto); }} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Transporte Aeropuerto</p>
                                <p className="text-xs text-gray-500 mt-0.5">Activa campos de dirección de vuelo, nombre del aeropuerto, número de vuelo y hora de recogida.</p>
                            </div>
                        </div>

                        {/* Traslado */}
                        <div
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${esTraslado ? 'border-[#D6A75D] bg-[#D6A75D]/5' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setEsTraslado(!esTraslado)}
                        >
                            <Switch checked={esTraslado} onClick={(e) => { e.stopPropagation(); setEsTraslado(!esTraslado); }} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Traslado</p>
                                <p className="text-xs text-gray-500 mt-0.5">Activa selección de dirección (desde mi ubicación / desde el destino) y municipio de origen.</p>
                            </div>
                        </div>

                        {/* Por Horas */}
                        <div
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${esPorHoras ? 'border-[#D6A75D] bg-[#D6A75D]/5' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setEsPorHoras(!esPorHoras)}
                        >
                            <Switch checked={esPorHoras} onClick={(e) => { e.stopPropagation(); setEsPorHoras(!esPorHoras); }} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Servicio por Horas</p>
                                <p className="text-xs text-gray-500 mt-0.5">Activa selección de número de horas y hora de inicio. El precio se calcula como precio base × horas.</p>
                            </div>
                        </div>

                        {/* Compartido */}
                        <div
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${esCompartido ? 'border-[#D6A75D] bg-[#D6A75D]/5' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setEsCompartido(!esCompartido)}
                        >
                            <Switch checked={esCompartido} onClick={(e) => { e.stopPropagation(); setEsCompartido(!esCompartido); }} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Servicio Compartido</p>
                                <p className="text-xs text-gray-500 mt-0.5">Activa capacidad total, cupos disponibles y precio por persona. No requiere asignación de vehículo individual.</p>
                            </div>
                        </div>

                        {/* Municipal */}
                        <div
                            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${esMunicipal ? 'border-[#D6A75D] bg-[#D6A75D]/5' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setEsMunicipal(!esMunicipal)}
                        >
                            <Switch checked={esMunicipal} onClick={(e) => { e.stopPropagation(); setEsMunicipal(!esMunicipal); }} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Transporte Municipal</p>
                                <p className="text-xs text-gray-500 mt-0.5">Agrupa este servicio en la sección de Transporte Municipal. Las tarifas por ubicación se configuran en la pestaña "Tarifas por Ubicación".</p>
                            </div>
                        </div>
                    </div>
                </section>

                {esCompartido && (
                    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-base font-semibold text-gray-900">Información del tour compartido</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Punto de encuentro, hora y notas que verá el cliente al reservar
                            </p>
                        </div>
                        <div className="p-6">
                            <InfoTourCompartidoEditor value={infoTourCompartido} onChange={setInfoTourCompartido} />
                        </div>
                    </section>
                )}

                {/* ─── SECTION 3: Night Surcharge ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-base font-semibold text-gray-900">Recargo Nocturno</h2>
                    </div>

                    <div className="p-6">
                        <div
                            className="flex items-center gap-3 cursor-pointer w-fit"
                            onClick={() => setAplicaRecargoNocturno(!aplicaRecargoNocturno)}
                        >
                            <Switch
                                checked={aplicaRecargoNocturno}
                                onCheckedChange={setAplicaRecargoNocturno}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm font-medium text-gray-700">Aplicar recargo nocturno</span>
                        </div>

                        {aplicaRecargoNocturno && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Hora inicio
                                    </label>
                                    <TimeInput
                                        value={recargoNocturnoInicio}
                                        onChange={(value) => setRecargoNocturnoInicio(value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Hora fin
                                    </label>
                                    <TimeInput
                                        value={recargoNocturnoFin}
                                        onChange={(value) => setRecargoNocturnoFin(value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Monto recargo (COP)
                                    </label>
                                    <input
                                        type="number"
                                        value={montoRecargoNocturno}
                                        onChange={(e) => setMontoRecargoNocturno(Number(e.target.value))}
                                        min="0"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ─── SECTION 4: Guides ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <Languages size={18} className="text-gray-600" />
                            <h2 className="text-base font-semibold text-gray-900">Guias</h2>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Habilita guias para este servicio y define su precio adicional
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Spanish Guide */}
                        <div className={`rounded-lg border-2 p-4 transition-all ${
                            guiaEspanolDisponible
                                ? 'border-[#D6A75D] bg-[#D6A75D]/5'
                                : 'border-gray-200'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div
                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                    onClick={() => setGuiaEspanolDisponible(!guiaEspanolDisponible)}
                                >
                                    <Switch
                                        checked={guiaEspanolDisponible}
                                        onCheckedChange={setGuiaEspanolDisponible}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Guia en Espanol</p>
                                        <p className="text-xs text-gray-500">Habilitar opcion de guia en espanol</p>
                                    </div>
                                </div>
                                {guiaEspanolDisponible && (
                                    <div className="w-44">
                                        <label className="block text-xs text-gray-500 mb-1">Precio adicional (COP)</label>
                                        <input
                                            type="number"
                                            value={precioGuiaEspanol ?? ''}
                                            onChange={(e) => setPrecioGuiaEspanol(e.target.value ? Number(e.target.value) : null)}
                                            min="0"
                                            placeholder="0 = gratis"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* English Guide */}
                        <div className={`rounded-lg border-2 p-4 transition-all ${
                            guiaInglesDisponible
                                ? 'border-[#D6A75D] bg-[#D6A75D]/5'
                                : 'border-gray-200'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div
                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                    onClick={() => setGuiaInglesDisponible(!guiaInglesDisponible)}
                                >
                                    <Switch
                                        checked={guiaInglesDisponible}
                                        onCheckedChange={setGuiaInglesDisponible}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Guia en Ingles</p>
                                        <p className="text-xs text-gray-500">Habilitar opcion de guia en ingles</p>
                                    </div>
                                </div>
                                {guiaInglesDisponible && (
                                    <div className="w-44">
                                        <label className="block text-xs text-gray-500 mb-1">Precio adicional (COP)</label>
                                        <input
                                            type="number"
                                            value={precioGuiaIngles ?? ''}
                                            onChange={(e) => setPrecioGuiaIngles(e.target.value ? Number(e.target.value) : null)}
                                            min="0"
                                            placeholder="0 = gratis"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── SECTION 5: Vehicles ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-base font-semibold text-gray-900">Vehiculos</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Selecciona los vehiculos disponibles para este servicio
                        </p>
                        <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            <strong>Nota:</strong> Este precio aplica <strong>solo</strong> a reservas directas (clientes independientes que llegan a la web sin código ni link de aliado). Para configurar los precios de aliados, ve a <strong>Aliados → Configuración de precios y servicios</strong>. Los precios de aliados son independientes y no se sincronizan con este.
                        </p>
                    </div>

                    <div className="p-6">
                        {sortedVehiculos.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                No hay vehiculos registrados.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedVehiculos.map((vehiculo) => {
                                    const isSelected = vehiculosSeleccionados.find(
                                        (v) => v.vehiculoId === vehiculo.id
                                    );

                                    return (
                                        <div
                                            key={vehiculo.id}
                                            className={`rounded-lg border-2 p-4 transition-all ${
                                                isSelected
                                                    ? 'border-[#D6A75D] bg-[#D6A75D]/5'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={!!isSelected}
                                                    onChange={() => handleVehiculoToggle(vehiculo.id)}
                                                    className="w-4 h-4 text-[#D6A75D] border-gray-300 rounded focus:ring-[#D6A75D] cursor-pointer"
                                                />

                                                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                    <Image
                                                        src={vehiculo.imagen || 'https://res.cloudinary.com/dnv8wdclp/image/upload/v1779368602/tmt/servicios/gasahtldulliounqtmot.jpg'}
                                                        alt={vehiculo.nombre}
                                                        fill
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-semibold text-gray-900">{vehiculo.nombre}</h3>
                                                    <p className="text-xs text-gray-500">
                                                        Capacidad: {vehiculo.capacidadMinima} - {vehiculo.capacidadMaxima} pasajeros
                                                    </p>
                                                </div>

                                                {isSelected && (
                                                    <div className="w-44">
                                                        <label className="block text-xs text-gray-500 mb-1">Precio (COP)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={isSelected.precio || ''}
                                                            onChange={(e) => handleVehiculoPrecioChange(vehiculo.id, Number(e.target.value) || 0)}
                                                            placeholder="0"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] transition-colors"
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* ─── SECTION: Campos Adicionales en el Wizard de Reservas ─── */}
                <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-base font-semibold text-gray-900">Campos Adicionales en el Formulario</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Campos extra que aparecen en el wizard de reservas (ej: número de vuelo, poster, opciones especiales).
                            Si no hay campos aquí, no aparecerá ningún campo adicional.
                        </p>
                    </div>
                    <div className="p-6">
                        <DynamicFieldBuilder
                            fields={camposPersonalizados}
                            onChange={setCamposPersonalizados}
                        />
                    </div>
                </section>

                {/* ─── Submit ─── */}
                <div className="flex items-center justify-between pt-2 pb-8">
                    <Link
                        href="/admin/dashboard/servicios"
                        className="px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D6A75D] text-black text-sm font-semibold rounded-lg hover:bg-[#C5964A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black"></div>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save size={16} /> Guardar Cambios
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
