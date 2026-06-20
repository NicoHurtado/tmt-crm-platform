'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiX, FiAlertCircle } from 'react-icons/fi';
import Step0ServiceInfo from './wizard/Step0ServiceInfo';
import Step1TripDetails from './wizard/Step1TripDetails';
import Step2ContactInfo from './wizard/Step2ContactInfo';
import Step3Notes from './wizard/Step3Notes';
import Step4Summary from './wizard/Step4Summary';
import Step5Confirmation from './wizard/Step5Confirmation';
import { ReservationFormData } from '@/types/reservation';
import { Idioma, Municipio, TipoDocumento } from '@prisma/client';
import { getLocalizedText, getLocalizedArray } from '@/types/multi-language';
import { useLanguage, t } from '@/lib/i18n';
import { formatPrice } from '@/lib/pricing';
import { getMissingBuiltinFields } from '@/lib/service-fields';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface Service {
    id: string;
    nombre: string;
    descripcion: string;
    imagen: string;
    duracion: string | null;
    incluye: string[];
    aplicaRecargoNocturno: boolean;
    recargoNocturnoInicio: string | null;
    recargoNocturnoFin: string | null;
    montoRecargoNocturno: number | null;
    esAeropuerto: boolean;
    esPorHoras: boolean;
    esCompartido: boolean;
    esMunicipal: boolean;
    /** Logística del tour compartido (JSON desde el admin) */
    infoTourCompartido?: unknown;
    destinoAutoFill: string | null;
    camposPersonalizados: any[];
    vehiculosPermitidos?: any[];
    /** Categoría de tarifa. 'POR_PERSONA' => precio por persona en tramos (1/2/3+). */
    tipoTarifa?: 'POR_PERSONA' | null;
    /** Precios por persona (solo cuando tipoTarifa === 'POR_PERSONA'). */
    preciosPorPersona?: { p1: number; p2: number; p3: number } | null;
}

interface ReservationWizardProps {
    service: Service;
    isOpen: boolean;
    onClose: () => void;
    initialStep?: number;
    aliadoId?: string | null;
    aliadoTipo?: string | null;
    aliadoNombre?: string | null;
    preciosPersonalizados?: any;
    clientePaga?: boolean;
    isStaffFlow?: boolean;
}

export default function ReservationWizard({ service, isOpen, onClose, initialStep = 0, aliadoId, aliadoTipo, aliadoNombre, preciosPersonalizados, clientePaga: clientePagaProp, isStaffFlow = false }: ReservationWizardProps) {
    const { language } = useLanguage();
    const [currentStep, setCurrentStep] = useState(0);
    const [maxStepReached, setMaxStepReached] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    // Internal clientePaga state — managed inside wizard when aliadoId is set
    const [clientePaga, setClientePaga] = useState<boolean>(clientePagaProp !== undefined ? clientePagaProp : true);
    const aliadoNombreNormalizado = (aliadoNombre || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const emailPredeterminadoAliado = aliadoNombreNormalizado.includes('medellin florece')
        ? 'medellinflorece1@gmail.com'
        : '';
    const [formData, setFormData] = useState<ReservationFormData>({
        idioma: language.toUpperCase() === 'EN' ? Idioma.EN : Idioma.ES,
        fecha: null,
        hora: '',
        municipio: '',
        numeroPasajeros: 0,
        nombreCliente: '',
        whatsappCliente: '',
        emailCliente: emailPredeterminadoAliado,
        asistentes: [{ nombre: '', tipoDocumento: TipoDocumento.PASAPORTE, numeroDocumento: '', email: emailPredeterminadoAliado, telefono: '' }],
        precioBase: 0,
        precioAdicionales: 0,
        recargoNocturno: 0,
        tarifaMunicipio: 0,
        descuentoAliado: 0,
        precioTotal: 0,
        datosDinamicos: {},
        aeropuertoNombre: 'JOSE_MARIA_CORDOVA' as const,
        cantidadHoras: service.esPorHoras ? 4 : undefined, // Default 4 hours for hourly services
    });
    const [reservationCode, setReservationCode] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [cartItemCount, setCartItemCount] = useState(0);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'TARJETA' | 'EFECTIVO' | null>(null);
    const router = useRouter();

    // Update language in form data when context changes
    useEffect(() => {
        setFormData(prev => ({ ...prev, idioma: language.toUpperCase() === 'EN' ? Idioma.EN : Idioma.ES }));
    }, [language]);

    // Check cart item count on mount and when modal opens
    useEffect(() => {
        const updateCartCount = () => {
            try {
                const cart = localStorage.getItem('medellin-travel-cart');
                if (cart) {
                    const cartItems = JSON.parse(cart);
                    setCartItemCount(Array.isArray(cartItems) ? cartItems.length : 0);
                } else {
                    setCartItemCount(0);
                }
            } catch (error) {
                console.error('Error loading cart count:', error);
                setCartItemCount(0);
            }
        };

        if (isOpen) {
            updateCartCount();
        }

        // Listen for cart updates
        const handleCartUpdate = () => {
            updateCartCount();
        };

        window.addEventListener('cartUpdated', handleCartUpdate);
        return () => {
            window.removeEventListener('cartUpdated', handleCartUpdate);
        };
    }, [isOpen]);

    // Reset payment method when modal opens or initial preference changes
    useEffect(() => {
        if (isOpen) {
            setSelectedPaymentMethod(null);
            setCurrentStep(initialStep);
            setMaxStepReached(initialStep);
        }
    }, [isOpen, initialStep]);

    // Process service data to get localized text
    const processedService = {
        ...service,
        nombre: getLocalizedText(service.nombre, language),
        descripcion: getLocalizedText(service.descripcion, language),
        incluye: getLocalizedArray(service.incluye, language),
    };

    if (!isOpen) return null;

    // Helper function to show error
    const showError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(''), 5000); // Auto-hide after 5 seconds
    };

    const validateStep = (step: number): boolean => {
        // Step 0: Service Info - Always valid (just informational)
        if (step === 0) return true;

        // Step 1: Trip Details
        if (step === 1) {
            // Special case: municipio OTRO requires specifying which municipality
            if (formData.municipio === Municipio.OTRO && !formData.otroMunicipio && !formData.municipioConfigId) {
                showError(language === 'es' ? 'Por favor especifica el municipio' : 'Please specify the municipality');
                return false;
            }

            // For hourly services enforce minimum hours (can't be derived from campo definition alone)
            if (service.esPorHoras && (!formData.cantidadHoras || formData.cantidadHoras < 4)) {
                showError(language === 'es' ? 'Por favor ingresa una cantidad válida de horas (mínimo 4)' : 'Please enter a valid number of hours (minimum 4)');
                return false;
            }

            // Declarative validation: check all required built-in fields
            const missingCampos = getMissingBuiltinFields(service, formData as Record<string, any>);
            if (missingCampos.length > 0) {
                const first = missingCampos[0];
                showError(language === 'es'
                    ? `Por favor completa: ${first.labelEs}`
                    : `Please complete: ${first.labelEn}`);
                return false;
            }

            return true;
        }

        // Step 2: Contact Info
        if (step === 2) {
            // Required: nombreCliente, whatsappCliente, emailCliente
            if (!formData.nombreCliente || !formData.whatsappCliente || !formData.emailCliente) {
                showError(language === 'es' ? 'Por favor completa todos los campos obligatorios' : 'Please complete all required fields');
                return false;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.emailCliente)) {
                showError(language === 'es' ? 'Por favor ingresa un email válido' : 'Please enter a valid email');
                return false;
            }

            // Validate WhatsApp (should be numbers only, at least 10 digits)
            const whatsappClean = formData.whatsappCliente.replace(/\D/g, '');
            if (whatsappClean.length < 10) {
                showError(language === 'es' ? 'Por favor ingresa un número de WhatsApp válido (mínimo 10 dígitos)' : 'Please enter a valid WhatsApp number (minimum 10 digits)');
                return false;
            }

            // Validate document for contact person (required)
            if (!formData.numeroDocumentoCliente || formData.numeroDocumentoCliente.trim().length < 4) {
                showError(language === 'es' ? 'Por favor ingresa tu número de documento' : 'Please enter your document number');
                return false;
            }

            // Solo el representante es obligatorio para: aeropuerto, aliados, tours
            // compartidos y tours por persona. Los demás pasajeros son opcionales.
            if (service.esAeropuerto || !!aliadoId || service.esCompartido || service.tipoTarifa === 'POR_PERSONA') {
                return true;
            }

            // Para otros servicios, todos los pasajeros son obligatorios
            const requiredPassengers = formData.numeroPasajeros || 1;
            if (formData.asistentes.length < requiredPassengers) {
                showError(language === 'es'
                    ? `Por favor completa los datos de los ${requiredPassengers} pasajeros`
                    : `Please complete details for all ${requiredPassengers} passengers`);
                return false;
            }

            // Validate each required passenger
            for (let i = 0; i < requiredPassengers; i++) {
                const asistente = formData.asistentes[i];
                if (!asistente || !asistente.nombre || asistente.nombre.trim().length < 2 ||
                    !asistente.numeroDocumento || asistente.numeroDocumento.trim().length < 4) {
                    showError(language === 'es'
                        ? `Por favor completa los datos del pasajero ${i + 1}`
                        : `Please complete details for passenger ${i + 1}`);
                    return false;
                }
            }

            return true;
        }

        // Step 3: Notes - Always valid (optional)
        if (step === 3) return true;

        // Step 4: Summary - Always valid (just confirmation)
        if (step === 4) return true;

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
        onClose();
    };

    const updateFormData = (updates: Partial<ReservationFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleConfirmReservation = async (metodoPagoOverride?: 'TARJETA' | 'EFECTIVO') => {
        const metodo = metodoPagoOverride ?? selectedPaymentMethod;
        if (!metodo) {
            showError(language === 'es' ? 'Selecciona un método de pago para continuar' : 'Select a payment method to continue');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/reservas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    fecha: formData.fecha ? formData.fecha.toISOString().split('T')[0] : null, // Convert to YYYY-MM-DD
                    servicioId: service.id,
                    aliadoId: aliadoId || null,
                    esReservaAliado: !!aliadoId,
                    clientePaga: clientePaga !== undefined ? clientePaga : true,
                    metodoPago: metodo,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al crear reserva');
            }

            // Redirigir a la página de tracking
            setReservationCode(data.data.codigo);
            router.refresh();
            router.push(`/tracking/${data.data.codigo}`);
        } catch (error: any) {
            showError(error.message || (language === 'es' ? 'Error al crear la reserva' : 'Error creating reservation'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = () => {
        if (!selectedPaymentMethod) {
            showError(language === 'es' ? 'Selecciona un método de pago para continuar' : 'Select a payment method to continue');
            return;
        }

        try {
            // Crear item del carrito con toda la información del formulario
            const cartItem = {
                id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                servicioId: service.id,
                servicioNombre: processedService.nombre,
                servicioImagen: service.imagen,
                ...formData,
                fecha: formData.fecha ? formData.fecha.toISOString().split('T')[0] : null,
                aliadoId: aliadoId || null,
                esReservaAliado: !!aliadoId,
                clientePaga: clientePaga !== undefined ? clientePaga : true,
                metodoPago: selectedPaymentMethod,
            };

            // Obtener carrito actual del localStorage
            const existingCart = localStorage.getItem('medellin-travel-cart');
            const cart = existingCart ? JSON.parse(existingCart) : [];

            // Agregar nuevo item
            cart.push(cartItem);

            // Guardar en localStorage
            localStorage.setItem('medellin-travel-cart', JSON.stringify(cart));

            // Disparar evento para actualizar el contador del carrito
            window.dispatchEvent(new Event('cartUpdated'));

            toast.success(language === 'es' ? 'Servicio agregado al carrito' : 'Service added to cart');

            // Cerrar el modal
            handleClose();
        } catch (error) {
            console.error('Error adding to cart:', error);
            showError(language === 'es' ? 'Error al agregar al carrito' : 'Error adding to cart');
        }
    };

    const handleProceedToPayment = async () => {
        if (!selectedPaymentMethod) {
            showError(language === 'es' ? 'Selecciona un método de pago para continuar' : 'Select a payment method to continue');
            return;
        }

        setLoading(true);
        try {
            // Crear item del servicio actual
            const currentItem = {
                id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                servicioId: service.id,
                servicioNombre: processedService.nombre,
                servicioImagen: service.imagen,
                ...formData,
                fecha: formData.fecha ? formData.fecha.toISOString().split('T')[0] : null,
                aliadoId: aliadoId || null,
                esReservaAliado: !!aliadoId,
                clientePaga: clientePaga !== undefined ? clientePaga : true,
                metodoPago: selectedPaymentMethod,
            };

            // Obtener items del carrito
            const existingCart = localStorage.getItem('medellin-travel-cart');
            const cartItems = existingCart ? JSON.parse(existingCart) : [];

            // Combinar carrito existente + servicio actual
            const allItems = [...cartItems, currentItem];

            // Crear el pedido con todos los servicios
            const response = await fetch('/api/pedido', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cartItems: allItems,
                    idioma: formData.idioma || 'ES',
                    metodoPago: selectedPaymentMethod,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al crear el pedido');
            }

            const { data: pedido } = await response.json();

            // Limpiar el carrito
            localStorage.removeItem('medellin-travel-cart');
            window.dispatchEvent(new Event('cartUpdated'));

            // Redirigir a la página de tracking del pedido
            router.refresh();
            router.push(`/tracking/${pedido.codigo}`);
        } catch (error: any) {
            showError(error.message || (language === 'es' ? 'Error al procesar el pedido' : 'Error processing order'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            {/* Error Notification */}
            {errorMessage && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-top duration-300 w-[calc(100%-2rem)] max-w-md">
                    <div className="bg-white border border-red-200 rounded-2xl shadow-xl p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <FiAlertCircle className="text-red-500" size={16} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm mb-0.5">
                                {language === 'es' ? 'Campos incompletos' : 'Incomplete fields'}
                            </h3>
                            <p className="text-gray-600 text-sm">{errorMessage}</p>
                        </div>
                        <button
                            onClick={() => setErrorMessage('')}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col relative overflow-hidden">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full p-2"
                >
                    <FiX size={18} />
                </button>

                {/* Staff-only clientePaga toggle — visible only in staff portal flow */}
                {isStaffFlow && (
                    <div className="flex items-center justify-center gap-3 px-6 py-2.5 bg-neutral-50 border-b border-neutral-100">
                        <span className="text-xs text-neutral-500">
                            {language === 'es' ? '¿El cliente paga?' : 'Does client pay?'}
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <span className={`text-xs font-semibold ${clientePaga ? 'text-green-600' : 'text-red-500'}`}>
                                {clientePaga
                                    ? (language === 'es' ? 'Sí, cobrar' : 'Yes, charge')
                                    : (language === 'es' ? 'No cobrar' : 'No charge')}
                            </span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={clientePaga}
                                    onChange={(e) => setClientePaga(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                            </div>
                        </label>
                    </div>
                )}

                {/* Progress indicator */}
                {currentStep < 5 && (() => {
                    const stepLabels = language === 'es'
                        ? ['Servicio', 'Tu viaje', 'Contacto', 'Notas', 'Resumen']
                        : ['Service', 'Your trip', 'Contact', 'Notes', 'Summary'];
                    return (
                        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
                            <div className="flex items-start justify-center gap-0">
                                {[0, 1, 2, 3, 4].map((step) => {
                                    const isClickable = step <= maxStepReached;
                                    const isDone = step < currentStep;
                                    const isActive = step === currentStep;
                                    return (
                                        <div key={step} className="flex items-start">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div
                                                    onClick={() => isClickable && setCurrentStep(step)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                                                        ${isActive ? 'bg-[#1a1a1a] text-white shadow-md' : isDone ? 'bg-[#D6A75D] text-black' : 'bg-gray-100 text-gray-400'}
                                                        ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    {isDone ? '✓' : step + 1}
                                                </div>
                                                <span className={`text-[10px] font-medium hidden sm:block ${isActive ? 'text-gray-900' : isDone ? 'text-[#D6A75D]' : 'text-gray-400'}`}>
                                                    {stepLabels[step]}
                                                </span>
                                            </div>
                                            {step < 4 && (
                                                <div className={`h-px w-8 sm:w-12 md:w-16 mt-4 mx-1 transition-all duration-300 ${step < currentStep ? 'bg-[#D6A75D]' : 'bg-gray-200'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Step content - scrollable */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    {currentStep === 0 && (
                        <Step0ServiceInfo
                            service={processedService}
                            onNext={handleNext}
                            onBack={handleClose}
                        />
                    )}

                    {currentStep === 1 && (
                        <Step1TripDetails
                            service={{ ...service, nombre: processedService.nombre }}
                            formData={formData}
                            updateFormData={updateFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                            preciosPersonalizados={preciosPersonalizados}
                            aliadoTipo={aliadoTipo}
                            aliadoNombre={aliadoNombre}
                        />
                    )}
                    {currentStep === 2 && (
                        <Step2ContactInfo
                            formData={formData}
                            updateFormData={updateFormData}
                            onNext={handleNext}
                            onBack={handleBack}
                            esAeropuerto={service.esAeropuerto}
                            isAlly={!!aliadoId}
                            pasajerosOpcionales={service.esCompartido || service.tipoTarifa === 'POR_PERSONA'}
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
                        <Step4Summary
                            service={processedService}
                            formData={formData}
                            onConfirm={handleConfirmReservation}
                            onBack={handleBack}
                            loading={loading}
                            selectedPaymentMethod={selectedPaymentMethod}
                            onPaymentMethodChange={setSelectedPaymentMethod}
                            clientePaga={clientePaga}
                            preciosPersonalizados={preciosPersonalizados}
                        />
                    )}
                    {currentStep === 5 && (
                        <Step5Confirmation
                            reservationCode={reservationCode}
                            isAlly={!!aliadoId}
                            onClose={handleClose}
                        />
                    )}
                </div>

                {/* Sticky Footer with Navigation Buttons */}
                {currentStep < 5 && (
                    <div className="border-t border-gray-100 bg-white px-6 sm:px-8 py-4 flex-shrink-0">
                        {/* Price Strip (Only Step 1) */}
                        {currentStep === 1 && formData.municipio !== Municipio.OTRO && formData.numeroPasajeros > 0 && (
                            <div className="flex justify-between items-center mb-3 px-1">
                                <span className="text-sm text-gray-500">
                                    {t('reservas.paso1_cotizacion', language)}
                                </span>
                                <span className="text-xl font-bold text-gray-900">
                                    {formatPrice(formData.precioTotal)}
                                </span>
                            </div>
                        )}

                        {/* Step 4: Dynamic buttons based on cart state */}
                        {currentStep === 4 ? (
                            <div className="space-y-3">
                                {!clientePaga ? (
                                    <button
                                        onClick={() => { handleConfirmReservation('EFECTIVO'); }}
                                        disabled={loading}
                                        className="w-full bg-[#D6A75D] hover:bg-[#C5964A] text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50 text-sm tracking-wide"
                                    >
                                        {loading ? t('comunes.cargando', language) : (language === 'es' ? 'Reservar de una vez' : 'Book immediately')}
                                    </button>
                                ) : selectedPaymentMethod ? (
                                    <>
                                        {cartItemCount > 0 ? (
                                            <button
                                                onClick={handleProceedToPayment}
                                                disabled={loading}
                                                className="w-full bg-[#D6A75D] hover:bg-[#C5964A] text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50 text-sm tracking-wide"
                                            >
                                                {loading
                                                    ? t('comunes.cargando', language)
                                                    : (language === 'es' ? `Proceder al pago · ${cartItemCount + 1} servicios` : `Proceed to payment · ${cartItemCount + 1} services`)}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { handleConfirmReservation(); }}
                                                disabled={loading}
                                                className="w-full bg-[#D6A75D] hover:bg-[#C5964A] text-white font-semibold py-3.5 px-6 rounded-xl transition-all disabled:opacity-50 text-sm tracking-wide"
                                            >
                                                {loading ? t('comunes.cargando', language) : t('reservas.paso4_confirmar', language)}
                                            </button>
                                        )}

                                        <div className="relative flex items-center gap-3 py-1">
                                            <div className="flex-1 h-px bg-gray-100" />
                                            <span className="text-xs text-gray-400 shrink-0">
                                                {language === 'es' ? 'o' : 'or'}
                                            </span>
                                            <div className="flex-1 h-px bg-gray-100" />
                                        </div>

                                        <button
                                            onClick={handleAddToCart}
                                            disabled={loading}
                                            className="w-full bg-white hover:bg-gray-50 text-gray-600 font-medium py-2.5 px-6 rounded-xl border border-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                        >
                                            <ShoppingCart size={15} className="text-gray-400" />
                                            {language === 'es' ? 'Agregar al carrito y seguir eligiendo' : 'Add to cart and keep choosing'}
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {language === 'es'
                                            ? 'Selecciona un método de pago para continuar.'
                                            : 'Select a payment method to continue.'}
                                    </div>
                                )}
                                <button
                                    onClick={handleBack}
                                    className="w-full px-6 py-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                                >
                                    {t('reservas.paso0_volver', language)}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={currentStep === 0 ? handleClose : handleBack}
                                    className="px-5 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                                >
                                    {t('reservas.paso0_volver', language)}
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="flex-1 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-bold py-3 px-6 rounded-xl transition-all"
                                >
                                    {t('reservas.paso0_continuar', language)}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
