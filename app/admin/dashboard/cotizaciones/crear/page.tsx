'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiLoader, FiChevronDown, FiChevronUp, FiMapPin, FiTrash2, FiCopy, FiCheck, FiShoppingBag } from 'react-icons/fi';
import QuoteWizard, { QuoteItem, ContactoInicial } from '@/components/admin/QuoteWizard';
import { formatPrice } from '@/lib/pricing';
import { getLocalizedText } from '@/types/multi-language';

export default function CreateQuotePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [municipalExpanded, setMunicipalExpanded] = useState(false);
    const [trasladosExpanded, setTrasladosExpanded] = useState(false);
    const [aliados, setAliados] = useState<Array<{ id: string; nombre: string }>>([]);
    const [aliadoId, setAliadoId] = useState<string | null>(null);
    const [clientePaga, setClientePaga] = useState(true);
    // Cotización en curso con varios servicios: se envía al cliente en UN solo correo.
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [generando, setGenerando] = useState(false);
    const [errorGenerar, setErrorGenerar] = useState('');
    const [resultado, setResultado] = useState<{ codigo: string; link: string; servicios: number } | null>(null);
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/admin/login');
        }
    }, [status, router]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchServices();
            fetchAliados();
        }
    }, [status]);

    const fetchAliados = async () => {
        try {
            const res = await fetch('/api/aliados');
            if (res.ok) {
                const data = await res.json();
                setAliados(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching aliados:', error);
        }
    };

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/servicios');
            if (res.ok) {
                const data = await res.json();
                setServices(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectService = (service: any) => {
        setResultado(null);
        setSelectedService(service);
        setWizardOpen(true);
    };

    const cerrarWizard = () => {
        setWizardOpen(false);
        setSelectedService(null);
    };

    // Lo que no cambia entre servicios de la misma cotización: datos del cliente y método de pago.
    const primero = items[0]?.payload;
    const contactoInicial: ContactoInicial | null = primero ? {
        nombreCliente: primero.nombreCliente,
        whatsappCliente: primero.whatsappCliente,
        emailCliente: primero.emailCliente,
        tipoDocumentoCliente: primero.tipoDocumentoCliente ?? primero.asistentes?.[0]?.tipoDocumento,
        numeroDocumentoCliente: primero.numeroDocumentoCliente ?? primero.asistentes?.[0]?.numeroDocumento,
    } : null;
    const metodoPagoFijo: 'TARJETA' | 'EFECTIVO' | null = primero ? primero.metodoPago : null;

    const handleAddToQuote = (item: QuoteItem) => {
        setItems(prev => [...prev, item]);
        cerrarWizard();
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** Crea la cotización: un servicio = reserva (RES…), varios = pedido (PED…) con un solo correo. */
    const generarCotizacion = async (lista: QuoteItem[]): Promise<string> => {
        const body = lista.length === 1
            ? lista[0].payload
            : {
                items: lista.map(it => it.payload),
                metodoPago: lista[0].payload.metodoPago,
                aliadoId: aliadoId || null,
                clientePaga,
            };
        const res = await fetch('/api/admin/cotizaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear cotización');
        setItems([]);
        return data.data.codigo as string;
    };

    const generarDesdePanel = async () => {
        setGenerando(true);
        setErrorGenerar('');
        try {
            const n = items.length;
            const codigo = await generarCotizacion(items);
            setResultado({ codigo, link: `${window.location.origin}/tracking/${codigo}`, servicios: n });
        } catch (e: any) {
            setErrorGenerar(e.message || 'Error al crear la cotización');
        } finally {
            setGenerando(false);
        }
    };

    const totalItems = items.reduce((s, it) => s + it.total, 0);

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <FiLoader className="animate-spin text-4xl text-[#D6A75D]" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    // Separar servicios municipales, traslados y otros servicios
    const municipalServices = services.filter(s => s.esMunicipal);
    const trasladoServices = services.filter(s => !s.esMunicipal && s.esTraslado && !s.esAeropuerto);
    const otherServices = services.filter(s => !s.esMunicipal && !(s.esTraslado && !s.esAeropuerto));

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Crear Cotización</h1>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            Crea una cotización con precio personalizado y genera un link para compartir
                        </p>
                    </div>
                </div>
            </header>

            <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
                {/* Configuración de la cotización */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Aliado selector */}
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Aliado <span className="text-gray-400">(opcional)</span>
                            </label>
                            <select
                                value={aliadoId || ''}
                                onChange={(e) => setAliadoId(e.target.value || null)}
                                disabled={items.length > 0}
                                title={items.length > 0 ? 'Vacía la cotización en curso para cambiar el aliado' : undefined}
                                className="disabled:bg-gray-100 disabled:cursor-not-allowed w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            >
                                <option value="">Sin aliado (cotización directa)</option>
                                {aliados.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {/* clientePaga toggle */}
                        <div className="flex items-center gap-3 sm:pt-6">
                            <label className="text-sm font-medium text-gray-700">¿El cliente paga?</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={clientePaga}
                                    onChange={(e) => setClientePaga(e.target.checked)}
                                    disabled={items.length > 0}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-neutral-200 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                            <span className={`text-xs font-semibold ${clientePaga ? 'text-green-600' : 'text-red-600'}`}>
                                {clientePaga ? 'COBRAR' : 'NO COBRAR'}
                            </span>
                        </div>
                    </div>
                </div>

                {resultado && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-6 space-y-3">
                        <div className="flex items-center gap-2">
                            <FiCheck className="text-green-600 text-xl" />
                            <h2 className="text-lg font-bold text-gray-900">
                                Cotización generada {resultado.servicios > 1 ? `(${resultado.servicios} servicios)` : ''} · <span className="font-mono text-[#8a6a33]">{resultado.codigo}</span>
                            </h2>
                        </div>
                        <p className="text-sm text-gray-700">Se envió un solo correo al cliente con todos los servicios. También puedes compartirle este link:</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input readOnly value={resultado.link} className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-mono" />
                            <button
                                onClick={() => { navigator.clipboard.writeText(resultado.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
                                className="px-5 py-2.5 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg flex items-center justify-center gap-2"
                            >
                                {copiado ? <><FiCheck /> Copiado</> : <><FiCopy /> Copiar</>}
                            </button>
                        </div>
                    </div>
                )}

                {items.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border-2 border-[#D6A75D] p-6 mb-6">
                        <div className="flex items-center gap-2 mb-1">
                            <FiShoppingBag className="text-[#D6A75D]" />
                            <h2 className="text-lg font-semibold text-gray-900">
                                Cotización en curso · {items.length} servicio{items.length !== 1 ? 's' : ''}
                            </h2>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Cliente: <span className="font-medium text-gray-800">{primero?.nombreCliente}</span> · {primero?.emailCliente} ·{' '}
                            {clientePaga ? (metodoPagoFijo === 'TARJETA' ? 'Pago con tarjeta' : 'Pago en efectivo') : 'Sin cobro'}
                        </p>
                        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                            {items.map((it, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-3">
                                    <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold flex items-center justify-center text-gray-600">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{it.servicioNombre}</p>
                                        <p className="text-xs text-gray-500">{it.fecha} · {it.hora} · {it.numeroPasajeros} pasajero{it.numeroPasajeros !== 1 ? 's' : ''}</p>
                                    </div>
                                    <span className="font-semibold text-gray-900">{formatPrice(it.total)}</span>
                                    <button
                                        onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                                        className="p-2 text-gray-400 hover:text-red-600"
                                        title="Quitar de la cotización"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-between items-center mt-4 font-bold text-gray-900">
                            <span>Total de la cotización</span>
                            <span className="text-xl text-[#D6A75D]">{formatPrice(totalItems)}</span>
                        </div>
                        {errorGenerar && <p className="text-sm text-red-600 mt-3">{errorGenerar}</p>}
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                            <p className="flex-1 text-sm text-gray-600 self-center">
                                Elige otro servicio abajo para añadirlo, o genera la cotización y el cliente recibirá un solo correo.
                            </p>
                            <button
                                onClick={() => { if (confirm('¿Vaciar la cotización en curso?')) setItems([]); }}
                                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Vaciar
                            </button>
                            <button
                                onClick={generarDesdePanel}
                                disabled={generando}
                                className="px-6 py-2.5 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg disabled:opacity-50"
                            >
                                {generando ? 'Generando...' : `Generar cotización (${items.length})`}
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {items.length > 0 ? 'Añadir otro servicio a la cotización' : 'Selecciona un Servicio'}
                    </h2>

                    <div className="space-y-4">
                        {/* Otros Servicios (Tours, Aeropuerto, etc.) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {otherServices.map((service) => (
                                <button
                                    key={service.id}
                                    onClick={() => handleSelectService(service)}
                                    className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-[#D6A75D] hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden group-hover:ring-2 group-hover:ring-[#D6A75D] transition-all">
                                            {service.imagen && (
                                                <Image
                                                    src={service.imagen}
                                                    alt={getLocalizedText(service.nombre, 'ES')}
                                                    fill
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-[#D6A75D] transition-colors truncate">
                                                {getLocalizedText(service.nombre, 'ES')}
                                            </h3>
                                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                                                {getLocalizedText(service.descripcion, 'ES')}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Traslados Agrupados */}
                        {trasladoServices.length > 0 && (
                            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setTrasladosExpanded(!trasladosExpanded)}
                                    className="w-full p-4 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-amber-200 rounded-lg flex items-center justify-center group-hover:ring-2 group-hover:ring-amber-400 transition-all">
                                            <FiMapPin className="text-amber-700 text-2xl" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                                                Traslados
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {trasladoServices.length} traslado{trasladoServices.length !== 1 ? 's' : ''} disponible{trasladoServices.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-gray-600 group-hover:text-amber-700 transition-colors">
                                        {trasladosExpanded ? <FiChevronUp size={24} /> : <FiChevronDown size={24} />}
                                    </div>
                                </button>

                                {trasladosExpanded && (
                                    <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {trasladoServices.map((service) => (
                                                <button
                                                    key={service.id}
                                                    onClick={() => handleSelectService(service)}
                                                    className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-[#D6A75D] hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden group-hover:ring-2 group-hover:ring-[#D6A75D] transition-all">
                                                            {service.imagen && (
                                                                <Image
                                                                    src={service.imagen}
                                                                    alt={getLocalizedText(service.nombre, 'ES')}
                                                                    fill
                                                                    style={{ objectFit: 'cover' }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-gray-900 group-hover:text-[#D6A75D] transition-colors text-sm truncate">
                                                                {getLocalizedText(service.nombre, 'ES')}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Servicios Municipales Agrupados */}
                        {municipalServices.length > 0 && (
                            <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                                {/* Header del grupo */}
                                <button
                                    onClick={() => setMunicipalExpanded(!municipalExpanded)}
                                    className="w-full p-4 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                                            <FiMapPin className="text-blue-700 text-2xl" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                                Transporte Municipal
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {municipalServices.length} municipios disponibles
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-gray-600 group-hover:text-blue-700 transition-colors">
                                        {municipalExpanded ? (
                                            <FiChevronUp size={24} />
                                        ) : (
                                            <FiChevronDown size={24} />
                                        )}
                                    </div>
                                </button>

                                {/* Lista de municipios (expandible) */}
                                {municipalExpanded && (
                                    <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {municipalServices.map((service) => (
                                                <button
                                                    key={service.id}
                                                    onClick={() => handleSelectService(service)}
                                                    className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg overflow-hidden group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                                                            {service.imagen && (
                                                                <Image
                                                                    src={service.imagen}
                                                                    alt={getLocalizedText(service.nombre, 'ES')}
                                                                    fill
                                                                    style={{ objectFit: 'cover' }}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-sm truncate">
                                                                {getLocalizedText(service.nombre, 'ES')}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Quote Wizard Modal */}
            {selectedService && (
                <QuoteWizard
                    service={selectedService}
                    isOpen={wizardOpen}
                    onClose={cerrarWizard}
                    aliadoId={aliadoId}
                    clientePaga={clientePaga}
                    itemsPrevios={items}
                    onAddToQuote={handleAddToQuote}
                    onGenerate={generarCotizacion}
                    contactoInicial={contactoInicial}
                    metodoPagoFijo={clientePaga ? metodoPagoFijo : null}
                />
            )}
        </div>
    );
}
