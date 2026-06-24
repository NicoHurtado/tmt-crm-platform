'use client';

import { useState, useEffect, useMemo } from 'react';
import { FiX, FiAlertCircle, FiCopy, FiCheck, FiDollarSign, FiCreditCard, FiEdit2 } from 'react-icons/fi';
import Step0ServiceInfo from '../reservas/wizard/Step0ServiceInfo';
import Step1TripDetails from '../reservas/wizard/Step1TripDetails';
import Step2ContactInfo from '../reservas/wizard/Step2ContactInfo';
import Step3Notes from '../reservas/wizard/Step3Notes';
import { ReservationFormData } from '@/types/reservation';
import { Idioma, Municipio, TipoDocumento } from '@prisma/client';
import { getLocalizedText, getLocalizedArray } from '@/types/multi-language';
import { formatPrice } from '@/lib/pricing';
import { getMissingBuiltinFields } from '@/lib/service-fields';

interface Service {
    id: string;
    nombre: string;
    descripcion: string;
    imagen: string;
    duracion: string | null;
    incluye: string[];
    precioBase: number;
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esAeropuerto: boolean;
    esPorHoras: boolean;
    esCompartido: boolean;
    esMunicipal: boolean;
    esTraslado?: boolean;
    tipoTarifa?: 'POR_PERSONA' | null;
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    adicionales: any[];
    vehiculosPermitidos?: any[];
}

interface QuoteWizardProps {
    service: Service;
    isOpen: boolean;
    onClose: () => void;
    aliadoId?: string | null;
    clientePaga?: boolean;
}

function BreakdownRow({ label, value, dimmed }: { label: string; value: number; dimmed?: boolean }) {
    return (
        <div className={`flex justify-between text-sm ${dimmed ? 'text-gray-500' : 'text-gray-700'}`}>
            <span>{label}</span>
            <span className="font-medium">{formatPrice(value)}</span>
        </div>
    );
}

export default function QuoteWizard({ service, isOpen, onClose, aliadoId, clientePaga }: QuoteWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [maxStepReached, setMaxStepReached] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [formData, setFormData] = useState<ReservationFormData>({
        idioma: Idioma.ES,
        fecha: null,
        hora: '',
        municipio: '',
        numeroPasajeros: 0,
        nombreCliente: '',
        whatsappCliente: '',
        emailCliente: '',
        asistentes: [{ nombre: '', tipoDocumento: TipoDocumento.CC, numeroDocumento: '', email: '', telefono: '' }],
        precioBase: 0,
        precioAdicionales: 0,
        recargoNocturno: 0,
        tarifaMunicipio: 0,
        descuentoAliado: 0,
        precioTotal: 0,
        datosDinamicos: {},
        aeropuertoNombre: 'JOSE_MARIA_CORDOVA',
        cantidadHoras: service.esPorHoras ? 4 : undefined,
    });
    const [precioPersonalizado, setPrecioPersonalizado] = useState<string>('');
    const [metodoPago, setMetodoPago] = useState<'TARJETA' | 'EFECTIVO'>('TARJETA');
    const [loading, setLoading] = useState(false);
    const [quoteLink, setQuoteLink] = useState<string>('');
    const [reservationCode, setReservationCode] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'interno' | 'tercero'>('tercero');
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    // Pricing del aliado seleccionado (misma fuente que el wizard de reservas):
    // precios y comisión POR VEHÍCULO viven en PrecioVehiculoAliado. Se inyectan en
    // Step1TripDetails para que la sugerencia auto-calculada coincida exactamente con
    // lo que cobraría el flujo real (independiente o aliado, todos los tipos de servicio).
    const [preciosPersonalizados, setPreciosPersonalizados] = useState<any>(null);
    const [aliadoTipo, setAliadoTipo] = useState<string | null>(null);
    // Override de comisión por-persona configurado para este (aliado, servicio), si existe.
    const [comisionPorPersonaOverride, setComisionPorPersonaOverride] = useState<{ tipo: string | null; valor: number | null }>({ tipo: null, valor: null });

    useEffect(() => {
        if (!isOpen || !aliadoId) {
            setPreciosPersonalizados(null);
            setAliadoTipo(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const [resSrv, resAliado] = await Promise.all([
                    fetch(`/api/aliados/${aliadoId}/servicios`, { cache: 'no-store' }),
                    fetch(`/api/aliados/${aliadoId}`, { cache: 'no-store' }),
                ]);
                const dataSrv = await resSrv.json();
                const dataAliado = await resAliado.json();
                if (cancelled) return;
                const pricingMap: any = {};
                (dataSrv.data || []).forEach((sa: any) => {
                    pricingMap[sa.servicioId] = {
                        vehiculos: sa.vehiculos || [],
                        sobrescribirRecargoNocturno: sa.sobrescribirRecargoNocturno,
                        aplicaRecargoNocturno: sa.aplicaRecargoNocturno,
                        recargoNocturnoInicio: sa.recargoNocturnoInicio,
                        recargoNocturnoFin: sa.recargoNocturnoFin,
                        montoRecargoNocturno: sa.montoRecargoNocturno,
                    };
                });
                setPreciosPersonalizados(pricingMap);
                setAliadoTipo(dataAliado?.data?.tipo ?? null);
                const saThis = (dataSrv.data || []).find((sa: any) => sa.servicioId === service.id);
                setComisionPorPersonaOverride({
                    tipo: saThis?.comisionPorPersonaAliadoTipo ?? null,
                    valor: saThis?.comisionPorPersonaAliadoValor ?? null,
                });
            } catch (e) {
                if (!cancelled) {
                    setPreciosPersonalizados(null);
                    setAliadoTipo(null);
                    setComisionPorPersonaOverride({ tipo: null, valor: null });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, aliadoId]);

    // ── PRICE BREAKDOWN ──────────────────────────────────────────────────────
    // Subtotal comes from formData (calculated in Step1TripDetails)
    const tarifaMunicipioConfig = (formData as unknown as Record<string, unknown>).tarifaMunicipioConfig as number || 0;
    const subtotal = useMemo(() => {
        return (
            (formData.precioBase || 0) +
            (formData.precioAdicionales || 0) +
            (formData.recargoNocturno || 0) +
            (formData.tarifaMunicipio || 0) +
            tarifaMunicipioConfig
        );
    }, [formData.precioBase, formData.precioAdicionales, formData.recargoNocturno,
        formData.tarifaMunicipio, tarifaMunicipioConfig]);

    // La comisión del aliado la calcula Step1TripDetails con la misma lógica que el flujo
    // real (por vehículo para tour/compartido/aeropuerto, ±10% o override para por persona).
    // Para "por persona" la comisión ya viene plegada en precioBase y comisionAliado = 0.
    const comisionAliado = Number(formData.comisionAliado) || 0;

    const subtotalConComision = subtotal + comisionAliado;
    const comisionBold = metodoPago === 'TARJETA' ? Math.round(subtotalConComision * 0.06) : 0;
    const totalCalculado = subtotalConComision + comisionBold;

    // If admin enters a manual price, that IS the final total (no Bold added on top)
    const precioOverride = precioPersonalizado !== '' ? Number(precioPersonalizado) : null;
    const precioFinal = precioOverride && precioOverride > 0 ? precioOverride : totalCalculado;

    // Parse dynamic fields for named breakdown rows
    const dynamicFields = (() => {
        try {
            const raw = service.camposPersonalizados;
            if (!raw) return [];
            return Array.isArray(raw) ? raw : JSON.parse(raw as string);
        } catch {
            return [];
        }
    })();

    const getDynamicLabel = (field: any) => {
        if (field.etiqueta && typeof field.etiqueta === 'object') {
            return field.etiqueta['es'] || field.etiqueta['en'] || field.label;
        }
        return field.label || field.clave || 'Campo';
    };

    // Process service data
    const processedService = {
        ...service,
        nombre: getLocalizedText(service.nombre, 'ES'),
        descripcion: getLocalizedText(service.descripcion, 'ES'),
        incluye: getLocalizedArray(service.incluye, 'ES'),
    };

    if (!isOpen) return null;

    const showError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(''), 5000);
    };

    const validateStep = (step: number): boolean => {
        if (step === 0) return true;

        if (step === 1) {
            // Reglas especiales que no se derivan de la simple presencia de un campo.
            if (formData.municipio === Municipio.OTRO && !(formData as any).municipioConfigId && !formData.otroMunicipio) {
                showError('Por favor especifica el municipio');
                return false;
            }
            if (service.esPorHoras && (!formData.cantidadHoras || formData.cantidadHoras < 4)) {
                showError('Por favor ingresa una cantidad válida de horas (mínimo 4)');
                return false;
            }

            // Validación declarativa: misma fuente de verdad que el wizard público (reservas).
            // Cubre todos los tipos de servicio (tour normal, compartido, por persona, aeropuerto,
            // traslado/municipal, por horas) sin lógica duplicada que se desincronice.
            const missing = getMissingBuiltinFields(service as any, formData as Record<string, any>);
            if (missing.length > 0) {
                showError(`Por favor completa: ${missing[0].labelEs}`);
                return false;
            }
            return true;
        }

        if (step === 2) {
            if (!formData.nombreCliente || !formData.whatsappCliente || !formData.emailCliente) {
                showError('Por favor completa todos los campos obligatorios');
                return false;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.emailCliente)) {
                showError('Por favor ingresa un email válido');
                return false;
            }
            const whatsappClean = formData.whatsappCliente.replace(/\D/g, '');
            if (whatsappClean.length < 10) {
                showError('Por favor ingresa un número de WhatsApp válido (mínimo 10 dígitos)');
                return false;
            }
            return true;
        }

        if (step === 3) return true;

        if (step === 4) {
            // Si hay precio personalizado, reemplaza al calculado: solo validamos que sea > 0
            // y no exigimos que el cálculo automático haya podido resolverse.
            if (precioPersonalizado !== '') {
                if (Number(precioPersonalizado) <= 0) {
                    showError('El precio personalizado debe ser mayor a 0');
                    return false;
                }
                return true;
            }
            if (totalCalculado <= 0) {
                showError('No se pudo calcular el precio. Verifica los datos del viaje.');
                return false;
            }
            return true;
        }

        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 5) {
                const nextStep = currentStep + 1;
                setCurrentStep(nextStep);
                setMaxStepReached(prev => Math.max(prev, nextStep));
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleClose = () => {
        setCurrentStep(0);
        setQuoteLink('');
        setPrecioPersonalizado('');
        onClose();
    };

    const updateFormData = (updates: Partial<ReservationFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));

        // Track selected vehicle when vehiculoId changes
        if (updates.vehiculoId && service.vehiculosPermitidos) {
            // vehiculosPermitidos contains objects with nested vehiculo property
            const vehicleData = service.vehiculosPermitidos.find((v: any) => v.vehiculo?.id === updates.vehiculoId);
            if (vehicleData && vehicleData.vehiculo) {
                setSelectedVehicle(vehicleData.vehiculo);
            }
        }
    };

    const handleGenerateQuote = async () => {
        if (!validateStep(4)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/cotizaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    fecha: formData.fecha ? formData.fecha.toISOString().split('T')[0] : null,
                    servicioId: service.id,
                    // Breakdown calculado (para que la API lo use)
                    comisionAliado,
                    // Override manual (null si el admin no modificó)
                    precioPersonalizado: precioOverride && precioOverride > 0 ? precioOverride : null,
                    metodoPago: clientePaga === false ? 'EFECTIVO' : metodoPago,
                    aliadoId: aliadoId || null,
                    clientePaga: clientePaga !== undefined ? clientePaga : true,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al crear cotización');
            }

            // Usar el link de tracking directamente en lugar del de cotización
            const trackingLink = `${window.location.origin}/tracking/${data.data.codigo}`;
            setQuoteLink(trackingLink);
            setReservationCode(data.data.codigo);
            setCurrentStep(5);

        } catch (error: any) {
            showError(error.message || 'Error al crear la cotización');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(quoteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            {/* Error Notification */}
            {errorMessage && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-top duration-300">
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-4 flex items-start gap-3 max-w-md">
                        <div className="flex-shrink-0">
                            <FiAlertCircle className="text-red-500 text-2xl" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-800 mb-1">Campos Incompletos</h3>
                            <p className="text-red-700 text-sm">{errorMessage}</p>
                        </div>
                        <button
                            onClick={() => setErrorMessage('')}
                            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-2 shadow-md"
                >
                    <FiX size={24} />
                </button>

                {/* Progress indicator */}
                {currentStep < 5 && (
                    <div className="bg-white border-b px-8 py-4 rounded-t-2xl flex-shrink-0">
                        <div className="flex items-center justify-center mb-3">
                            {[0, 1, 2, 3, 4].map((step) => {
                                const isClickable = step <= maxStepReached;
                                return (
                                    <div key={step} className="flex items-center">
                                        <div
                                            onClick={() => isClickable && setCurrentStep(step)}
                                            className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all ${step <= currentStep
                                                ? 'bg-[#D6A75D] text-black shadow-md scale-110'
                                                : 'bg-gray-200 text-gray-500'
                                                } ${isClickable ? 'cursor-pointer hover:bg-[#C5964A] hover:text-black' : 'cursor-not-allowed'}`}
                                        >
                                            {step + 1}
                                        </div>
                                        {step < 4 && (
                                            <div className={`h-1 w-8 md:w-16 mx-1 md:mx-2 rounded-full transition-all ${step < currentStep ? 'bg-[#D6A75D]' : 'bg-gray-200'
                                                }`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-sm text-gray-600 text-center font-medium">
                            {currentStep === 0 && 'Información del Servicio'}
                            {currentStep === 1 && 'Detalles del Viaje'}
                            {currentStep === 2 && 'Información de Contacto'}
                            {currentStep === 3 && 'Notas Adicionales'}
                            {currentStep === 4 && 'Precio Personalizado'}
                        </p>
                    </div>
                )}

                {/* Step content - scrollable */}
                <div className="flex-1 overflow-y-auto p-8">
                    {currentStep === 0 && (
                        <Step0ServiceInfo
                            service={processedService}
                            onNext={handleNext}
                            onBack={handleClose}
                        />
                    )}

                    {currentStep === 1 && (
                        <Step1TripDetails
                            service={{
                                ...service,
                                nombre: processedService.nombre,
                                comisionPorPersonaAliadoTipo: comisionPorPersonaOverride.tipo,
                                comisionPorPersonaAliadoValor: comisionPorPersonaOverride.valor,
                            } as any}
                            formData={formData}
                            updateFormData={updateFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                            preciosPersonalizados={preciosPersonalizados}
                            aliadoTipo={aliadoTipo as any}
                            aliadoNombre={null}
                        />
                    )}

                    {currentStep === 2 && (
                        <Step2ContactInfo
                            formData={formData}
                            updateFormData={updateFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                            isAlly={true}
                        />
                    )}

                    {currentStep === 3 && (
                        <Step3Notes
                            formData={formData}
                            updateFormData={updateFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                        />
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Precio y Método de Pago</h2>
                                <p className="text-gray-600">
                                    Revisa el desglose calculado y ajusta el precio si es necesario
                                </p>
                            </div>

                            {/* Desglose de precio auto-calculado */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-2">
                                <h3 className="font-semibold text-gray-800 mb-3">Desglose calculado</h3>


                                {dynamicFields.length > 0 && formData.datosDinamicos && dynamicFields.map((field: any) => {
                                    const fieldKey = field.key || field.id || field.name || field.clave;
                                    if (!fieldKey) return null;
                                    const value = formData.datosDinamicos![fieldKey];
                                    const tipo = field.tipo ? field.tipo.toLowerCase() : '';
                                    const label = getDynamicLabel(field);
                                    if (tipo === 'switch' && value === true) {
                                        const precio = field.precio || field.precioUnitario;
                                        if (precio) return <BreakdownRow key={fieldKey} label={label} value={Number(precio)} />;
                                    }
                                    if (tipo === 'counter' && Number(value) > 0 && field.precioUnitario) {
                                        return <BreakdownRow key={fieldKey} label={`${label} (×${value})`} value={Number(value) * Number(field.precioUnitario)} />;
                                    }
                                    return null;
                                })}
                                {(formData.recargoNocturno || 0) > 0 && (
                                    <BreakdownRow label="Recargo nocturno" value={formData.recargoNocturno || 0} />
                                )}
                                {(formData.tarifaMunicipio || 0) > 0 && (
                                    <BreakdownRow label={`Tarifa municipio (${formData.municipio})`} value={formData.tarifaMunicipio || 0} />
                                )}
                                {((formData as any).tarifaMunicipioConfig || 0) > 0 && (
                                    <BreakdownRow label="Recargo municipio dinámico" value={(formData as any).tarifaMunicipioConfig || 0} />
                                )}
                                {comisionAliado > 0 && (
                                    <BreakdownRow label="Comisión aliado" value={comisionAliado} />
                                )}

                                {/* Separator */}
                                <div className="border-t border-gray-300 my-2" />

                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-medium">{formatPrice(subtotalConComision)}</span>
                                </div>

                                {metodoPago === 'TARJETA' && (
                                    <BreakdownRow label="Comisión tarjeta (6%)" value={comisionBold} dimmed />
                                )}

                                {/* Total line */}
                                <div className="border-t border-gray-400 pt-2 flex justify-between font-bold text-gray-900">
                                    <span>Total calculado</span>
                                    <span className="text-lg text-[#D6A75D]">{formatPrice(totalCalculado)}</span>
                                </div>
                            </div>

                            {/* Precio personalizado (opcional) */}
                            <div className="border border-dashed border-amber-400 rounded-xl p-5 bg-amber-50/40">
                                <div className="flex items-center gap-2 mb-3">
                                    <FiEdit2 size={16} className="text-amber-600" />
                                    <label className="text-sm font-semibold text-gray-700">
                                        Precio total personalizado{' '}
                                        <span className="text-gray-400 font-normal">(opcional — deja vacío para usar el calculado)</span>
                                    </label>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={precioPersonalizado}
                                        onChange={(e) => setPrecioPersonalizado(e.target.value)}
                                        placeholder={String(totalCalculado)}
                                        min="1"
                                        step="1000"
                                        className="w-full pl-8 pr-4 py-3 text-xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none bg-white"
                                    />
                                </div>
                                {precioOverride && precioOverride > 0 && (
                                    <p className="text-xs text-amber-700 mt-2">
                                        El cliente pagará exactamente {formatPrice(precioOverride)} (este valor reemplaza el calculado, sin agregar más cargos).
                                    </p>
                                )}
                            </div>

                            {/* Total final destacado */}
                            <div className="bg-black text-white rounded-xl p-4 flex justify-between items-center">
                                <span className="font-semibold">
                                    {clientePaga !== false ? 'Total que pagará el cliente' : 'Total del servicio'}
                                </span>
                                <span className="text-2xl font-bold text-[#D6A75D]">{formatPrice(precioFinal)}</span>
                            </div>

                            {/* Método de Pago */}
                            {clientePaga !== false ? (
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-gray-700">Método de Pago</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMetodoPago('EFECTIVO')}
                                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                metodoPago === 'EFECTIVO'
                                                    ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                                                    : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${metodoPago === 'EFECTIVO' ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    <FiDollarSign size={22} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">Efectivo</p>
                                                    <p className="text-xs text-gray-500">Sin recargo adicional</p>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setMetodoPago('TARJETA')}
                                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                metodoPago === 'TARJETA'
                                                    ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${metodoPago === 'TARJETA' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    <FiCreditCard size={22} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">Tarjeta (en línea)</p>
                                                    <p className="text-xs text-gray-500">
                                                        {precioOverride && precioOverride > 0
                                                            ? 'El 6% ya está incluido en el precio personalizado'
                                                            : '+6% recargo sobre el subtotal'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                                    <FiCheck size={20} className="text-gray-500 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-700 text-sm">Sin cobro al cliente</p>
                                        <p className="text-xs text-gray-500">La reserva se confirmará de inmediato sin requerir pago.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FiCheck className="text-green-600 text-4xl" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Reserva Generada</h2>
                                <p className="text-gray-600">Código: <span className="font-mono font-bold text-[#D6A75D]">{reservationCode}</span></p>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 border-b border-gray-200">
                                <button
                                    onClick={() => setActiveTab('interno')}
                                    className={`flex-1 py-3 px-4 font-semibold transition-all ${activeTab === 'interno'
                                        ? 'border-b-2 border-[#D6A75D] text-[#D6A75D]'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Uso Interno
                                </button>
                                <button
                                    onClick={() => setActiveTab('tercero')}
                                    className={`flex-1 py-3 px-4 font-semibold transition-all ${activeTab === 'tercero'
                                        ? 'border-b-2 border-[#D6A75D] text-[#D6A75D]'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Para Tercero
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="mt-6">
                                {activeTab === 'interno' ? (
                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center space-y-4">
                                        <div className="text-blue-600 text-5xl mb-2">✓</div>
                                        <h3 className="text-xl font-bold text-gray-900">Puedes cerrar este aviso</h3>
                                        <p className="text-gray-700">
                                            La reserva quedó guardada y la puedes ver en el panel de reservas
                                        </p>
                                        <button
                                            onClick={handleClose}
                                            className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 space-y-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                                            Link para Compartir
                                        </label>
                                        <p className="text-sm text-gray-600 mb-3">
                                            Comparte este link con tu cliente. Podrá ver todos los detalles de la reserva y realizar el pago.
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={quoteLink}
                                                readOnly
                                                className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm font-mono"
                                            />
                                            <button
                                                onClick={copyToClipboard}
                                                className="px-6 py-3 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold rounded-lg transition-all flex items-center gap-2"
                                            >
                                                {copied ? (
                                                    <>
                                                        <FiCheck size={20} />
                                                        Copiado
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiCopy size={20} />
                                                        Copiar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleClose}
                                            className="w-full mt-4 px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-all"
                                        >
                                            Crear Nueva Cotización
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Footer with Navigation Buttons */}
                {currentStep < 5 && (
                    <div className="border-t bg-white px-8 py-4 rounded-b-2xl flex-shrink-0">
                        {/* NO mostrar precio en Step 1 para cotizaciones */}
                        <div className="flex gap-4">
                            <button
                                onClick={currentStep === 0 ? handleClose : handleBack}
                                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={currentStep === 4 ? handleGenerateQuote : handleNext}
                                disabled={currentStep === 4 && loading}
                                className="flex-1 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
                            >
                                {currentStep === 4
                                    ? (loading ? 'Generando...' : (clientePaga !== false ? 'Generar' : 'Reservar de una vez'))
                                    : 'Continuar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
