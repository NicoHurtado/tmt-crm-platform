'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    FiArrowLeft,
    FiLoader,
    FiCheckCircle,
    FiX,
    FiSave,
    FiEdit2,
    FiUser,
    FiClock,
    FiMapPin,
    FiDollarSign,
    FiMail,
    FiPhone,
    FiCalendar,
    FiUsers,
    FiTruck,
    FiTrash2,
    FiExternalLink,
    FiCheck,
} from 'react-icons/fi';
import { EstadoReserva, TipoDocumento } from '@prisma/client';
import { getStateLabel, getStateBadge, getAvailableTransitions } from '@/lib/state-transitions';
import { getLocalizedText } from '@/types/multi-language';
import { formatReservationDate } from '@/lib/date-utils';
import { getDatos } from '@/types/reserva-datos';
import { getConfiguracion } from '@/types/servicio-config';

// Read-only field display
function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-400 italic">—</span>}</p>
        </div>
    );
}

// Section card with edit toggle
function SectionCard({
    title,
    icon: Icon,
    editing,
    onEdit,
    onSave,
    onCancel,
    saving,
    children,
}: {
    title: string;
    icon: React.ElementType;
    editing: boolean;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                <div className="flex items-center gap-2.5">
                    <Icon size={14} className="text-[#D6A75D]" />
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h2>
                </div>
                {editing ? (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D6A75D] hover:bg-[#c49450] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? <FiLoader size={11} className="animate-spin" /> : <FiCheck size={11} />}
                            Guardar
                        </button>
                        <button
                            onClick={onCancel}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-gray-500 hover:text-gray-700 text-xs rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <FiX size={11} /> Cancelar
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-[#D6A75D] text-xs rounded-lg hover:bg-[#D6A75D]/5 transition-colors"
                    >
                        <FiEdit2 size={11} /> Editar
                    </button>
                )}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

export default function AdminReservaDetails({ params }: { params: { id: string } }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = params;

    const [reserva, setReserva] = useState<any>(null);
    const [conductores, setConductores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [vehiculos, setVehiculos] = useState<any[]>([]);

    // Section editing states
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [sectionSaving, setSectionSaving] = useState(false);

    // Estado management
    const [selectedEstado, setSelectedEstado] = useState<string>('');
    const [estadoSaving, setEstadoSaving] = useState(false);

    // Conductor management
    const [selectedConductor, setSelectedConductor] = useState('');
    const [conductorSaving, setConductorSaving] = useState(false);

    // Form states (populated on load, editable when section is active)
    const [quotePrice, setQuotePrice] = useState<number>(0);
    const [fecha, setFecha] = useState('');
    const [hora, setHora] = useState('');
    const [numeroPasajeros, setNumeroPasajeros] = useState(1);
    const [vehiculoId, setVehiculoId] = useState('');
    const [municipio, setMunicipio] = useState('');
    const [numeroVuelo, setNumeroVuelo] = useState('');
    const [lugarRecogida, setLugarRecogida] = useState('');
    const [notas, setNotas] = useState('');
    const [aeropuertoNombre, setAeropuertoNombre] = useState('');
    const [nombreCliente, setNombreCliente] = useState('');
    const [emailCliente, setEmailCliente] = useState('');
    const [whatsappCliente, setWhatsappCliente] = useState('');
    const [idioma, setIdioma] = useState('ES');
    const [asistentes, setAsistentes] = useState<any[]>([]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/admin/login');
    }, [status, router]);

    const populateForm = (data: any) => {
        setSelectedEstado(data.estado);
        setSelectedConductor(data.conductorId || '');
        setQuotePrice(data.precioTotal || 0);
        setNombreCliente(data.nombreCliente || '');
        setEmailCliente(data.emailCliente || '');
        setWhatsappCliente(data.whatsappCliente || '');
        setIdioma(data.idioma || 'ES');
        setFecha(data.fecha ? new Date(data.fecha).toISOString().split('T')[0] : '');
        setHora(data.hora || '');
        setNumeroPasajeros(data.numeroPasajeros || 1);
        setVehiculoId(data.vehiculoId || '');
        setMunicipio(data.municipio || '');
        const rd = getDatos(data.datos);
        setNumeroVuelo((rd.numeroVuelo as string) || '');
        setLugarRecogida((rd.lugarRecogida as string) || '');
        setNotas(data.notas || '');
        setAeropuertoNombre((rd.aeropuertoNombre as string) || '');
        if (data.asistentes?.length > 0) {
            setAsistentes(data.asistentes.map((a: any) => ({
                id: a.id,
                nombre: a.nombre || '',
                tipoDocumento: a.tipoDocumento || 'PASAPORTE',
                numeroDocumento: a.numeroDocumento || '',
                email: a.email || '',
                telefono: a.telefono || '',
            })));
        }
    };

    const fetchData = useCallback(async () => {
        try {
            const resReserva = await fetch(`/api/reservas/by-id/${id}`);
            if (!resReserva.ok) throw new Error('Error fetching reserva');
            const dataReserva = await resReserva.json();
            setReserva(dataReserva);
            populateForm(dataReserva);

            const resConductores = await fetch('/api/conductores?activo=true');
            if (resConductores.ok) {
                const dataConductores = await resConductores.json();
                setConductores(dataConductores.data || []);
            }

            const resVehiculos = await fetch('/api/vehiculos');
            if (resVehiculos.ok) {
                const dataVehiculos = await resVehiculos.json();
                setVehiculos(dataVehiculos.data || dataVehiculos || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (status === 'authenticated') fetchData();
    }, [status, fetchData]);

    const putReserva = async (body: any) => {
        const res = await fetch(`/api/reservas/by-id/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Error updating reserva');
        const data = await res.json();
        setReserva(data.data);
        return data.data;
    };

    const handleSaveEstado = async () => {
        setEstadoSaving(true);
        try {
            await putReserva({ estado: selectedEstado });
        } catch {
            alert('Error al guardar el estado');
        } finally {
            setEstadoSaving(false);
        }
    };

    const handleSaveConductor = async () => {
        setConductorSaving(true);
        try {
            await putReserva({ conductorId: selectedConductor || null });
        } catch {
            alert('Error al asignar el conductor');
        } finally {
            setConductorSaving(false);
        }
    };

    const handleSaveSection = async (section: string) => {
        setSectionSaving(true);
        try {
            let body: any = {};
            if (section === 'cliente') {
                body = { nombreCliente, emailCliente, whatsappCliente, idioma };
            } else if (section === 'servicio') {
                body = {
                    fecha, hora,
                    numeroPasajeros: Number(numeroPasajeros),
                    vehiculoId: vehiculoId || null,
                    municipio, numeroVuelo, lugarRecogida, notas, aeropuertoNombre,
                };
                if (reserva.estado === 'CONFIRMED_UNASSIGNED' && selectedEstado === 'PENDING_PAYMENT') {
                    body.precioTotal = quotePrice;
                    body.precioBase = quotePrice;
                }
            } else if (section === 'pasajeros') {
                body = {
                    asistentes: asistentes.map((a) => ({
                        id: a.id,
                        nombre: a.nombre,
                        tipoDocumento: a.tipoDocumento,
                        numeroDocumento: a.numeroDocumento,
                        email: a.email || null,
                        telefono: a.telefono || null,
                    })),
                };
            }
            await putReserva(body);
            setEditingSection(null);
        } catch {
            alert('Error al guardar los cambios');
        } finally {
            setSectionSaving(false);
        }
    };

    const cancelSection = (section: string) => {
        // Reset to current reserva values
        if (section === 'cliente') {
            setNombreCliente(reserva.nombreCliente || '');
            setEmailCliente(reserva.emailCliente || '');
            setWhatsappCliente(reserva.whatsappCliente || '');
            setIdioma(reserva.idioma || 'ES');
        } else if (section === 'servicio') {
            setFecha(reserva.fecha ? new Date(reserva.fecha).toISOString().split('T')[0] : '');
            setHora(reserva.hora || '');
            setNumeroPasajeros(reserva.numeroPasajeros || 1);
            setVehiculoId(reserva.vehiculoId || '');
            setMunicipio(reserva.municipio || '');
            const rd = getDatos(reserva.datos);
            setNumeroVuelo((rd.numeroVuelo as string) || '');
            setLugarRecogida((rd.lugarRecogida as string) || '');
            setNotas(reserva.notas || '');
            setAeropuertoNombre((rd.aeropuertoNombre as string) || '');
        } else if (section === 'pasajeros') {
            setAsistentes(reserva.asistentes?.map((a: any) => ({
                id: a.id,
                nombre: a.nombre || '',
                tipoDocumento: a.tipoDocumento || 'PASAPORTE',
                numeroDocumento: a.numeroDocumento || '',
                email: a.email || '',
                telefono: a.telefono || '',
            })) || []);
        }
        setEditingSection(null);
    };

    const handleDelete = async () => {
        if (!confirm(`¿Eliminar permanentemente la reserva #${reserva?.codigo}? Esta acción no se puede deshacer.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/reservas/by-id/${id}/delete`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                router.push('/admin/dashboard/reservas');
            } else {
                alert(data.error || 'No se pudo eliminar la reserva');
            }
        } catch {
            alert('Error al conectar con el servidor');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <FiLoader className="animate-spin text-3xl text-[#D6A75D]" />
            </div>
        );
    }

    if (!reserva) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-800 mb-3">Reserva no encontrada</h1>
                    <button onClick={() => router.back()} className="text-[#D6A75D] hover:underline text-sm">Volver</button>
                </div>
            </div>
        );
    }

    const metodoPago = reserva.metodoPago === 'EFECTIVO' ? 'EFECTIVO' : 'TARJETA';
    const estadoBold = reserva.estadoPago === 'APROBADO' ? 'PAGADO' : 'PENDIENTE';
    const estadoChanged = selectedEstado !== reserva.estado;
    const conductorChanged = selectedConductor !== (reserva.conductorId || '');
    const rd = getDatos(reserva.datos);

    const destinoLabel = (() => {
        if (rd.aeropuertoTipo === 'HACIA') return rd.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' ? 'Aeropuerto JMC' : 'Aeropuerto Olaya Herrera';
        if (rd.aeropuertoTipo === 'DESDE') return (rd.lugarRecogida as string) || 'Tu Hotel/Residencia';
        return reserva.servicio?.destinoAutoFill ||
            (typeof reserva.servicio?.nombre === 'string' ? reserva.servicio.nombre : reserva.servicio?.nombre?.['es']) ||
            'No especificado';
    })();

    const origenLabel = (() => {
        if (rd.aeropuertoTipo === 'DESDE') return rd.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' ? 'Aeropuerto JMC' : 'Aeropuerto Olaya Herrera';
        return (rd.lugarRecogida as string) || '—';
    })();

    return (
        <div className="min-h-screen bg-[#F0F2F5]">
            {/* Top bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <FiArrowLeft size={18} className="text-gray-500" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-lg font-bold text-gray-900">Reserva #{reserva.codigo}</h1>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getStateBadge(reserva.estado)}`}>
                                    {getStateLabel(reserva.estado)}
                                </span>
                                {reserva.metodoPago && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${metodoPago === 'EFECTIVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {metodoPago === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Creada el {new Date(reserva.createdAt).toLocaleString('es-CO')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`/tracking/${reserva.codigo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <FiExternalLink size={12} /> Ver tracking
                        </a>
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {deleting ? <FiLoader size={12} className="animate-spin" /> : <FiTrash2 size={12} />}
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-3 space-y-5">

                        {/* Client Info */}
                        <SectionCard
                            title="Información del Cliente"
                            icon={FiUser}
                            editing={editingSection === 'cliente'}
                            onEdit={() => setEditingSection('cliente')}
                            onSave={() => handleSaveSection('cliente')}
                            onCancel={() => cancelSection('cliente')}
                            saving={sectionSaving}
                        >
                            {editingSection === 'cliente' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={nombreCliente}
                                            onChange={(e) => setNombreCliente(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={emailCliente}
                                            onChange={(e) => setEmailCliente(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">WhatsApp</label>
                                        <input
                                            type="text"
                                            value={whatsappCliente}
                                            onChange={(e) => setWhatsappCliente(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Idioma</label>
                                        <select
                                            value={idioma}
                                            onChange={(e) => setIdioma(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        >
                                            <option value="ES">Español</option>
                                            <option value="EN">Inglés</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                                    <Field label="Nombre" value={reserva.nombreCliente} />
                                    <Field label="Email" value={
                                        <a href={`mailto:${reserva.emailCliente}`} className="text-[#D6A75D] hover:underline flex items-center gap-1">
                                            <FiMail size={11} /> {reserva.emailCliente}
                                        </a>
                                    } />
                                    <Field label="WhatsApp" value={
                                        <a href={`https://wa.me/${reserva.whatsappCliente?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                                            <FiPhone size={11} /> {reserva.whatsappCliente}
                                        </a>
                                    } />
                                    <Field label="Idioma" value={reserva.idioma === 'EN' ? 'Inglés' : 'Español'} />
                                </div>
                            )}
                        </SectionCard>

                        {/* Service Details */}
                        <SectionCard
                            title="Detalles del Servicio"
                            icon={FiMapPin}
                            editing={editingSection === 'servicio'}
                            onEdit={() => setEditingSection('servicio')}
                            onSave={() => handleSaveSection('servicio')}
                            onCancel={() => cancelSection('servicio')}
                            saving={sectionSaving}
                        >
                            {editingSection === 'servicio' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Servicio</label>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {reserva.servicio?.nombre ? getLocalizedText(reserva.servicio.nombre, 'ES') : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            value={fecha}
                                            onChange={(e) => setFecha(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Hora</label>
                                        <input
                                            type="time"
                                            value={hora}
                                            onChange={(e) => setHora(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Pasajeros</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={numeroPasajeros}
                                            onChange={(e) => setNumeroPasajeros(Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Municipio</label>
                                        <input
                                            type="text"
                                            value={municipio}
                                            onChange={(e) => setMunicipio(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            {rd.aeropuertoTipo === 'DESDE' ? 'Origen (Aeropuerto)' : 'Lugar de Recogida'}
                                        </label>
                                        {rd.aeropuertoTipo === 'DESDE' ? (
                                            <select
                                                value={aeropuertoNombre}
                                                onChange={(e) => setAeropuertoNombre(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                            >
                                                <option value="">Seleccionar</option>
                                                <option value="JOSE_MARIA_CORDOVA">Aeropuerto JMC</option>
                                                <option value="OLAYA_HERRERA">Aeropuerto Olaya Herrera</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={lugarRecogida}
                                                onChange={(e) => setLugarRecogida(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Vehículo</label>
                                        <select
                                            value={vehiculoId}
                                            onChange={(e) => setVehiculoId(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                        >
                                            <option value="">Sin asignar</option>
                                            {vehiculos.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.nombre} ({v.pasajerosMax} pax)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {reserva.servicio?.esAeropuerto && (
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Número de Vuelo</label>
                                            <input
                                                type="text"
                                                value={numeroVuelo}
                                                onChange={(e) => setNumeroVuelo(e.target.value)}
                                                placeholder="Ej: AV9364"
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                            />
                                        </div>
                                    )}
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Notas</label>
                                        <textarea
                                            value={notas}
                                            onChange={(e) => setNotas(e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                        <div className="col-span-2 md:col-span-3">
                                            <Field label="Servicio" value={
                                                <span className="font-semibold">
                                                    {reserva.servicio?.nombre ? getLocalizedText(reserva.servicio.nombre, 'ES') : 'N/A'}
                                                </span>
                                            } />
                                        </div>
                                        <Field label="Fecha" value={reserva.fecha ? formatReservationDate(reserva.fecha, 'es-CO', 'long') : '—'} />
                                        <Field label="Hora" value={reserva.hora} />
                                        <Field label="Pasajeros" value={`${reserva.numeroPasajeros} persona(s)`} />
                                        <Field label="Origen" value={origenLabel} />
                                        <Field label="Destino" value={destinoLabel} />
                                        {reserva.municipio && (
                                            <Field label="Municipio" value={reserva.municipio === 'OTRO' && reserva.otroMunicipio ? reserva.otroMunicipio : reserva.municipio?.replace(/_/g, ' ')} />
                                        )}
                                        {reserva.vehiculo && (
                                            <Field label="Vehículo" value={reserva.vehiculo.nombre} />
                                        )}
                                        {reserva.servicio?.esAeropuerto && (
                                            <Field label="Nro. Vuelo" value={(rd.numeroVuelo as string) || <span className="text-gray-400 italic">No especificado</span>} />
                                        )}
                                        {getDatos(reserva.datos).cantidadHoras && (
                                            <Field label="Duración" value={`${getDatos(reserva.datos).cantidadHoras} horas`} />
                                        )}
                                    </div>
                                    {reserva.notas && (
                                        <div className="pt-3 border-t border-gray-100">
                                            <Field label="Notas" value={reserva.notas} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </SectionCard>

                        {/* Pasajeros */}
                        {asistentes.length > 0 && (
                            <SectionCard
                                title={`Pasajeros (${asistentes.length})`}
                                icon={FiUsers}
                                editing={editingSection === 'pasajeros'}
                                onEdit={() => setEditingSection('pasajeros')}
                                onSave={() => handleSaveSection('pasajeros')}
                                onCancel={() => cancelSection('pasajeros')}
                                saving={sectionSaving}
                            >
                                {editingSection === 'pasajeros' ? (
                                    <div className="space-y-4">
                                        {asistentes.map((asistente, index) => (
                                            <div key={asistente.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pasajero {index + 1}</p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <div className="col-span-2">
                                                        <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                                                        <input
                                                            type="text"
                                                            value={asistente.nombre}
                                                            onChange={(e) => {
                                                                const u = [...asistentes];
                                                                u[index] = { ...u[index], nombre: e.target.value };
                                                                setAsistentes(u);
                                                            }}
                                                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Tipo Doc.</label>
                                                        <select
                                                            value={asistente.tipoDocumento}
                                                            onChange={(e) => {
                                                                const u = [...asistentes];
                                                                u[index] = { ...u[index], tipoDocumento: e.target.value };
                                                                setAsistentes(u);
                                                            }}
                                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                                        >
                                                            <option value="PASAPORTE">Pasaporte</option>
                                                            <option value="CC">CC</option>
                                                            <option value="CE">CE</option>
                                                            <option value="TI">TI</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Nro. Documento</label>
                                                        <input
                                                            type="text"
                                                            value={asistente.numeroDocumento}
                                                            onChange={(e) => {
                                                                const u = [...asistentes];
                                                                u[index] = { ...u[index], numeroDocumento: e.target.value };
                                                                setAsistentes(u);
                                                            }}
                                                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Email (opcional)</label>
                                                        <input
                                                            type="email"
                                                            value={asistente.email}
                                                            onChange={(e) => {
                                                                const u = [...asistentes];
                                                                u[index] = { ...u[index], email: e.target.value };
                                                                setAsistentes(u);
                                                            }}
                                                            placeholder="correo@ejemplo.com"
                                                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Teléfono (opcional)</label>
                                                        <input
                                                            type="text"
                                                            value={asistente.telefono}
                                                            onChange={(e) => {
                                                                const u = [...asistentes];
                                                                u[index] = { ...u[index], telefono: e.target.value };
                                                                setAsistentes(u);
                                                            }}
                                                            placeholder="+57 300 000 0000"
                                                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">#</th>
                                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Nombre</th>
                                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Tipo Doc</th>
                                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Nro. Documento</th>
                                                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Email</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reserva.asistentes?.map((a: any, i: number) => (
                                                    <tr key={a.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                                                        <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                                                        <td className="py-2.5 px-3 font-medium text-gray-900">{a.nombre}</td>
                                                        <td className="py-2.5 px-3 text-gray-600">{a.tipoDocumento}</td>
                                                        <td className="py-2.5 px-3 font-mono text-gray-700">{a.numeroDocumento}</td>
                                                        <td className="py-2.5 px-3 text-gray-500">{a.email || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </SectionCard>
                        )}

                        {/* Pricing */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                                <FiDollarSign size={14} className="text-[#D6A75D]" />
                                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cotización y Pagos</h2>
                            </div>
                            <div className="p-5">
                                {reserva.estado === 'PENDING_PAYMENT' ? (
                                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-4">
                                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Establecer Precio</p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={quotePrice}
                                                onChange={(e) => setQuotePrice(Number(e.target.value))}
                                                className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-300 outline-none bg-white"
                                            />
                                            <span className="text-xs text-amber-700 font-medium">COP</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Precio Base</span>
                                            <span className="font-medium">${Number(reserva.precioBase).toLocaleString('es-CO')}</span>
                                        </div>
                                        {reserva.precioAdicionales > 0 && (
                                            <>
                                                <div className="flex justify-between text-sm font-medium text-gray-700 border-t border-gray-100 pt-2">
                                                    <span>Adicionales</span>
                                                    <span>${Number(reserva.precioAdicionales).toLocaleString('es-CO')}</span>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
                                                    {(() => {
                                                        const items: JSX.Element[] = [];
                                                        try {
                                                            const dynamicFields = getConfiguracion(reserva.servicio?.configuracion).camposCustom;
                                                            const datosCampos = getDatos(reserva.datos);
                                                            if (dynamicFields.length && reserva.datos) {
                                                                dynamicFields.forEach((field: any) => {
                                                                    const fieldKey = field.clave || field.key || field.id || field.name;
                                                                    if (!fieldKey) return;
                                                                    const value = datosCampos[fieldKey];
                                                                    if (value === undefined || value === null) return;
                                                                    const tipo = field.tipo ? field.tipo.toUpperCase() : '';
                                                                    const label = field.etiqueta?.es || field.label || fieldKey;
                                                                    if (field.tienePrecio === false) return;
                                                                    let itemPrice = 0;
                                                                    let displayValue = '';
                                                                    if (tipo === 'SWITCH' && value === true) {
                                                                        itemPrice = Number(field.precio || field.precioUnitario || 0);
                                                                        displayValue = '1 unidad';
                                                                    } else if (tipo === 'COUNTER' && Number(value) > 0) {
                                                                        const cantidad = Number(value);
                                                                        itemPrice = cantidad * Number(field.precioUnitario || 0);
                                                                        displayValue = `${cantidad} × $${Number(field.precioUnitario || 0).toLocaleString('es-CO')}`;
                                                                    } else if (tipo === 'SELECT' && field.opciones) {
                                                                        const opt = field.opciones.find((o: any) => o.valor === value);
                                                                        if (opt?.precio) {
                                                                            itemPrice = Number(opt.precio);
                                                                            displayValue = opt.etiqueta?.es || opt.label || value;
                                                                        }
                                                                    }
                                                                    if (itemPrice > 0) {
                                                                        items.push(
                                                                            <div key={`dyn-${fieldKey}`} className="flex justify-between items-center text-xs">
                                                                                <div>
                                                                                    <span className="text-gray-700 font-medium">{label}</span>
                                                                                    <span className="text-gray-400 ml-1">{displayValue}</span>
                                                                                </div>
                                                                                <span className="text-gray-700 font-semibold">${itemPrice.toLocaleString('es-CO')}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                });
                                                            }
                                                        } catch { /* ignore */ }
                                                        if (reserva.adicionalesSeleccionados?.length) {
                                                            reserva.adicionalesSeleccionados.forEach((sel: any) => {
                                                                const nombre = sel.adicional?.nombre || 'Adicional';
                                                                const cantidad = sel.cantidad || 1;
                                                                const precioUnitario = sel.precioUnitario || sel.adicional?.precio || 0;
                                                                const total = Number(precioUnitario) * Number(cantidad);
                                                                if (total > 0) {
                                                                    items.push(
                                                                        <div key={`rel-${sel.id}`} className="flex justify-between items-center text-xs">
                                                                            <div>
                                                                                <span className="text-gray-700 font-medium">{nombre}</span>
                                                                                <span className="text-gray-400 ml-1">{cantidad} × ${Number(precioUnitario).toLocaleString('es-CO')}</span>
                                                                            </div>
                                                                            <span className="text-gray-700 font-semibold">${total.toLocaleString('es-CO')}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            });
                                                        }
                                                        return items.length > 0 ? <>{items}</> : null;
                                                    })()}
                                                </div>
                                            </>
                                        )}
                                        {reserva.recargoNocturno > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Recargo Nocturno</span>
                                                <span className="font-medium">${Number(reserva.recargoNocturno).toLocaleString('es-CO')}</span>
                                            </div>
                                        )}
                                        {reserva.tarifaMunicipio > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Tarifa Municipio</span>
                                                <span className="font-medium">${Number(reserva.tarifaMunicipio).toLocaleString('es-CO')}</span>
                                            </div>
                                        )}
                                        {reserva.descuentoAliado > 0 && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span>Descuento Aliado</span>
                                                <span className="font-medium">-${Number(reserva.descuentoAliado).toLocaleString('es-CO')}</span>
                                            </div>
                                        )}
                                        {Number(reserva.comisionBold || 0) > 0 && (
                                            <div className="flex justify-between text-sm text-orange-600">
                                                <span>Comisión Bold (6%)</span>
                                                <span className="font-medium">${Number(reserva.comisionBold).toLocaleString('es-CO')}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-bold pt-3 border-t border-gray-200 text-base">
                                            <span>Total</span>
                                            <span className="text-[#D6A75D]">${Number(reserva.precioTotal).toLocaleString('es-CO')} COP</span>
                                        </div>
                                        {reserva.esReservaAliado && Number(reserva.comisionAliado) > 0 && (
                                            <div className="flex justify-between text-xs text-blue-600 pt-2 border-t border-dashed border-gray-200">
                                                <span>Comisión Aliado ({reserva.aliado?.nombre})</span>
                                                <span>${Number(reserva.comisionAliado).toLocaleString('es-CO')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wide">Método de Pago</p>
                                        <p className={`text-sm font-bold mt-0.5 ${metodoPago === 'TARJETA' ? 'text-blue-700' : 'text-green-700'}`}>
                                            {metodoPago === 'TARJETA' ? 'Tarjeta (Bold)' : 'Efectivo'}
                                        </p>
                                    </div>
                                    {metodoPago === 'TARJETA' && (
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${estadoBold === 'PAGADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {estadoBold}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right Column ── */}
                    <div className="space-y-4">

                        {/* Estado Management */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                                <div className="w-2 h-2 rounded-full bg-[#D6A75D]" />
                                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Estado</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <select
                                    value={selectedEstado}
                                    onChange={(e) => setSelectedEstado(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                >
                                    {Object.values(EstadoReserva).map((estado) => (
                                        <option key={estado} value={estado}>
                                            {getStateLabel(estado)}
                                        </option>
                                    ))}
                                </select>
                                {estadoChanged && (
                                    <button
                                        onClick={handleSaveEstado}
                                        disabled={estadoSaving}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-[#D6A75D] hover:bg-[#c49450] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {estadoSaving ? <FiLoader size={13} className="animate-spin" /> : <FiCheck size={13} />}
                                        Guardar Estado
                                    </button>
                                )}
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Cambiar el estado envía automáticamente el correo de notificación al cliente.
                                </p>
                            </div>
                        </div>

                        {/* Conductor Assignment */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                                <FiTruck size={14} className="text-[#D6A75D]" />
                                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Asignación</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                {reserva.conductor && !conductorChanged && (
                                    <div className="bg-[#D6A75D]/5 rounded-lg p-3 border border-[#D6A75D]/20">
                                        <p className="text-xs text-gray-500 mb-0.5">Conductor actual</p>
                                        <p className="text-sm font-bold text-gray-900">{reserva.conductor.nombre}</p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5">Cambiar conductor</label>
                                    <select
                                        value={selectedConductor}
                                        onChange={(e) => setSelectedConductor(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                    >
                                        <option value="">Sin asignar</option>
                                        {conductores.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre} {c.disponible ? '✓' : '·'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {conductorChanged && (
                                    <button
                                        onClick={handleSaveConductor}
                                        disabled={conductorSaving}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-[#D6A75D] hover:bg-[#c49450] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {conductorSaving ? <FiLoader size={13} className="animate-spin" /> : <FiCheck size={13} />}
                                        Asignar Conductor
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Ally Info */}
                        {reserva.aliado && (
                            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-blue-100 bg-blue-50">
                                    <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wide">Reserva de Aliado</h2>
                                </div>
                                <div className="p-4 space-y-2">
                                    <Field label="Aliado" value={reserva.aliado.nombre} />
                                    <Field label="Tipo" value={reserva.aliado.tipo} />
                                    <Field label="Código" value={<span className="font-mono text-xs">{reserva.aliado.codigo}</span>} />
                                </div>
                            </div>
                        )}

                        {/* Meta */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
                                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Información</h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <Field label="Código" value={<span className="font-mono font-bold">{reserva.codigo}</span>} />
                                <Field label="Creada" value={new Date(reserva.createdAt).toLocaleString('es-CO')} />
                                <Field label="Actualizada" value={new Date(reserva.updatedAt).toLocaleString('es-CO')} />
                                {reserva.googleCalendarEventId && (
                                    <Field label="Calendario" value={<span className="text-xs text-green-600 font-medium">Sincronizado</span>} />
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
