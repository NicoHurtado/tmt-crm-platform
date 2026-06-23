'use client';

import { useState, useEffect } from 'react';
import { ReservationFormData } from '@/types/reservation';
import { Municipio, Idioma } from '@prisma/client';
import { calculateTotalPrice, isNightSurchargeApplicable, formatPrice } from '@/lib/pricing';
import { FiAlertCircle, FiCheck, FiUsers, FiUser } from 'react-icons/fi';
import { Plane } from 'lucide-react';
import Image from 'next/image';
import DynamicFields from './DynamicFields';
import { DynamicFieldValues } from '@/types/dynamic-fields';
import { useLanguage, t } from '@/lib/i18n';
import { DateInput, TimeInput } from '@/components/ui';
import { SharedTourLogisticsCard } from '@/components/reservas/SharedTourLogisticsCard';
import { normalizeInfoTourCompartido } from '@/lib/info-tour-compartido';
import { precioTramoPorPersona, totalPorPersona, comisionPorPersona } from '@/types/servicio-config';

/**
 * La comisión por persona se calcula con `comisionPorPersona` de
 * '@/types/servicio-config', que respeta el override configurado por aliado y
 * cae al ±10% automático (HOTEL/AIRBNB +10%, AGENCIA −10%) cuando no hay override.
 */

/** Convierte "7:50 AM", "7:50am", "07:50", "7:50" → "07:50" (HH:MM 24h). */
function parseSalidaToHora(salida: string): string {
    const match = salida.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!match) return '';
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3]?.toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

interface Step1Props {
    service: any;
    formData: ReservationFormData;
    updateFormData: (updates: Partial<ReservationFormData>) => void;
    onNext: () => void;
    onBack: () => void;
    preciosPersonalizados?: any;
    aliadoTipo?: string | null;
    aliadoNombre?: string | null;
}

export default function Step1TripDetails({ service, formData, updateFormData, onNext, onBack, preciosPersonalizados, aliadoTipo, aliadoNombre }: Step1Props) {
    const { language } = useLanguage();
    const [showNightSurcharge, setShowNightSurcharge] = useState(false);
    const [dynamicPrice, setDynamicPrice] = useState(0);
    const [isLanguageOpen, setIsLanguageOpen] = useState(false);
    const [isMunicipalityOpen, setIsMunicipalityOpen] = useState(false);
    const [isAirportOpen, setIsAirportOpen] = useState(false);
    const [isMunicipioConfigOpen, setIsMunicipioConfigOpen] = useState(false);
    const [municipiosConfig, setMunicipiosConfig] = useState<{ id: string; nombreES: string; nombreEN: string; recargo: number }[]>([]);

    const dynamicFields = service.camposPersonalizados || [];

    // 🏨 Check if this is a hotel reservation
    const isHotel = aliadoTipo === 'HOTEL';
    const hotelName = aliadoNombre || '';

    // 🎟️ Tour con precio por persona (formulario ágil con dirección de recogida)
    const isTourPersona = service.tipoTarifa === 'POR_PERSONA';
    const preciosPorPersona = service.preciosPorPersona ?? null;
    // Override de comisión por persona configurado para este aliado (null = ±10% automático).
    const comisionPorPersonaOverride = {
        tipo: service.comisionPorPersonaAliadoTipo ?? null,
        valor: service.comisionPorPersonaAliadoValor ?? null,
    };

    // 🚗 Check if this is a traslado or municipal transport service (but NOT airport service)
    const isTraslado = !service.esAeropuerto && (
        service.esTraslado === true ||
        service.esMunicipal === true
    );

    // Extract municipality name from service name or destinoAutoFill
    const getMunicipalityFromServiceName = () => {
        if (!isTraslado) return '';

        // For municipal transport, use destinoAutoFill if available
        if (service.esMunicipal && service.destinoAutoFill) {
            return service.destinoAutoFill;
        }

        let nombreServicio = '';
        if (typeof service.nombre === 'string') {
            nombreServicio = service.nombre;
        } else if (typeof service.nombre === 'object') {
            nombreServicio = service.nombre?.ES || service.nombre?.es || '';
        }

        return nombreServicio.replace(/^Traslado\s+/i, '').trim();
    };

    const municipalityName = getMunicipalityFromServiceName();

    // Initialize datosDinamicos if not exists
    useEffect(() => {
        if (!formData.datosDinamicos && dynamicFields.length > 0) {
            const initialData: DynamicFieldValues = {};
            // Initialize with default values based on field type
            // The DynamicFieldRenderer will handle defaults
            updateFormData({ datosDinamicos: initialData });
        }
    }, [dynamicFields.length, formData.datosDinamicos, updateFormData]);

    // Fetch dynamic municipalities
    useEffect(() => {
        fetch('/api/municipios')
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setMunicipiosConfig(data.data);
            })
            .catch(() => {});
    }, []);

    // 🏨 Auto-fill lugarRecogida for hotels (but not for traslados)
    useEffect(() => {
        // Don't auto-fill if it's a traslado service - traslados have their own logic
        if (isTraslado) return;

        if (isHotel && hotelName && formData.lugarRecogida !== hotelName) {
            updateFormData({ lugarRecogida: hotelName });
        }
    }, [isHotel, hotelName, formData.lugarRecogida, updateFormData, isTraslado]);

    // 🚗 Auto-fill fields for traslados based on direction (only on direction change)
    useEffect(() => {
        if (!isTraslado || !formData.trasladoTipo) return;

        if (formData.trasladoTipo === 'DESDE_UBICACION') {
            // From my location to municipality
            if (aliadoNombre) {
                // If from ally: auto-fill origin with ally name
                updateFormData({
                    lugarRecogida: aliadoNombre,
                    trasladoDestino: municipalityName
                });
            } else {
                // If independent: leave origin empty, set destination
                updateFormData({
                    lugarRecogida: '',
                    trasladoDestino: municipalityName
                });
            }
        } else if (formData.trasladoTipo === 'DESDE_MUNICIPIO') {
            // From municipality to my location
            // Origin: municipality name (editable for details)
            // Destination: empty (user fills their destination)
            updateFormData({
                lugarRecogida: municipalityName,
                trasladoDestino: ''
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.trasladoTipo]); // Only run when trasladoTipo changes

    // Get available vehicles — precio viene de ServicioVehiculo.precio
    // En modo aliado se incluye también la comisión por vehículo
    // Para aeropuerto Olaya Herrera se usa el precio/comisión alterno si está
    // configurado (con fallback al de José María Córdova / por defecto).
    const usarPrecioOlaya = !!service.esAeropuerto && formData.aeropuertoNombre === 'OLAYA_HERRERA';
    const availableVehicles = (() => {
        let vehicles: any[] = [];
        // 1. Aliado-specific: aliado endpoint expone vehiculos[].precioServicio + comisión
        const aliadoVehiculos = preciosPersonalizados?.[service.id]?.vehiculos;
        if (aliadoVehiculos?.length > 0) {
            vehicles = aliadoVehiculos
                .filter((v: any) => v.activo !== false)
                .map((v: any) => {
                    const precio = usarPrecioOlaya && v.precioServicioOlaya != null
                        ? Number(v.precioServicioOlaya)
                        : Number(v.precioServicio ?? 0);
                    const tipoComision = usarPrecioOlaya && v.tipoComisionOlaya != null
                        ? v.tipoComisionOlaya
                        : (v.tipoComision ?? 'PORCENTAJE');
                    const comisionValor = usarPrecioOlaya && v.comisionValorOlaya != null
                        ? Number(v.comisionValorOlaya)
                        : Number(v.comisionValor ?? 0);
                    return {
                        id: v.vehiculoId,
                        nombre: v.nombre,
                        capacidadMinima: v.capacidadMinima,
                        capacidadMaxima: v.capacidadMaxima,
                        precio,
                        imagen: v.imagen ?? null,
                        tipoComision,
                        comisionValor,
                    };
                });
        }
        // 2. Public service: vehiculosPermitidos[].precio + .vehiculo
        else if (service.vehiculosPermitidos?.length > 0) {
            vehicles = service.vehiculosPermitidos.map((sv: any) => ({
                id: sv.vehiculo?.id ?? sv.vehiculoId ?? sv.id,
                nombre: sv.vehiculo?.nombre ?? sv.nombre,
                capacidadMinima: sv.vehiculo?.capacidadMinima ?? sv.capacidadMinima,
                capacidadMaxima: sv.vehiculo?.capacidadMaxima ?? sv.capacidadMaxima,
                imagen: sv.vehiculo?.imagen ?? sv.imagen ?? null,
                precio: usarPrecioOlaya && sv.precioOlaya != null
                    ? Number(sv.precioOlaya)
                    : Number(sv.precio ?? 0),
                tipoComision: 'PORCENTAJE',
                comisionValor: 0,
            }));
        }

        return vehicles.sort((a: any, b: any) => (a.capacidadMaxima || 0) - (b.capacidadMaxima || 0));
    })();

    // Show all available vehicles
    const validVehicles = availableVehicles;

    // Find recommended vehicle (smallest capacity that fits)
    const recommendedVehicle = formData.numeroPasajeros > 0
        ? availableVehicles
            .filter((v: any) => v.capacidadMaxima >= formData.numeroPasajeros)
            .sort((a: any, b: any) => a.capacidadMaxima - b.capacidadMaxima)[0]
        : null;

    // Auto-select the smallest fitting vehicle whenever passenger count changes
    useEffect(() => {
        if (recommendedVehicle && formData.numeroPasajeros > 0) {
            if (formData.vehiculoId !== recommendedVehicle.id) {
                updateFormData({ vehiculoId: recommendedVehicle.id });
            }
        }
    }, [formData.numeroPasajeros, recommendedVehicle?.id]);




    // Calculate price whenever relevant fields change
    useEffect(() => {
        // Determine night surcharge configuration
        // Priority: hotel-specific config > service default
        let aplicaRecargo = service.aplicaRecargoNocturno;
        let montoRecargo = service.montoRecargoNocturno;
        let horaInicioRecargo = service.recargoNocturnoInicio;
        let horaFinRecargo = service.recargoNocturnoFin;

        // ─── TOUR POR PERSONA: precio por tramos (1/2/3+) + ajuste silencioso por tipo de aliado ───
        // El ±10% (hotel/airbnb +10%, agencia −10%) se pliega en el precio mostrado para que el
        // cliente NO vea una línea de "comisión". La comisión real se calcula y guarda en el servidor
        // (POST /api/reservas) para que aparezca en el CRM.
        if (isTourPersona) {
            const total = totalPorPersona(preciosPorPersona, formData.numeroPasajeros || 0);
            const comision = comisionPorPersona(total, aliadoTipo, comisionPorPersonaOverride);
            const totalConComision = total + comision;
            const updates: Partial<ReservationFormData> = {
                precioBase: totalConComision,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                precioAdicionales: 0,
                comisionAliado: 0, // silencioso: no se muestra al cliente
                precioTotal: totalConComision,
            };
            if (formData.municipio !== null) updates.municipio = null as any;
            updateFormData(updates);
            return;
        }

        // ─── SHARED TOUR PRICING + FIXED VALUES FROM ADMIN CONFIG ───
        const isSharedTourPricing = service.esCompartido;
        if (isSharedTourPricing) {
            const pricePerPerson = availableVehicles[0]?.precio ?? 0;
            const totalShared = pricePerPerson * formData.numeroPasajeros;

            // Read meeting point and departure time from admin config — no hardcoding
            const info = normalizeInfoTourCompartido(service.infoTourCompartido);
            const lugarFijo = info.encuentro.es || info.encuentro.en || '';
            const horaFija = parseSalidaToHora(info.salida.es || info.salida.en || '');

            // Destination: prefer destinoAutoFill set in admin, fallback to name extraction
            const destinoNombre = service.destinoAutoFill ||
                (typeof service.nombre === 'object'
                    ? ((service.nombre?.es || service.nombre?.ES || '')
                        .match(/tour\s+compartido\s+(.+)/i)?.[1]?.trim() || '')
                    : '');

            const updates: Partial<ReservationFormData> = {
                precioBase: totalShared,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                precioAdicionales: 0,
                precioTotal: totalShared,
            };

            // Only update if value differs (prevent render loop)
            if (horaFija && formData.hora !== horaFija) updates.hora = horaFija;
            if (lugarFijo && formData.lugarRecogida !== lugarFijo) updates.lugarRecogida = lugarFijo;
            if (destinoNombre && formData.trasladoDestino !== destinoNombre) updates.trasladoDestino = destinoNombre;
            if (formData.municipio !== null) updates.municipio = null as any;

            updateFormData(updates);
            return;
        }

        // Check if hotel has override configuration
        const hotelConfig = preciosPersonalizados?.[service.id];

        if (hotelConfig?.sobrescribirRecargoNocturno) {
            aplicaRecargo = hotelConfig.aplicaRecargoNocturno ?? false;
            montoRecargo = hotelConfig.montoRecargoNocturno;
            horaInicioRecargo = hotelConfig.recargoNocturnoInicio;
            horaFinRecargo = hotelConfig.recargoNocturnoFin;
        }

        const nightSurcharge = aplicaRecargo &&
            isNightSurchargeApplicable(formData.hora, horaInicioRecargo, horaFinRecargo)
            ? Number(montoRecargo || 0)
            : 0;

        setShowNightSurcharge(nightSurcharge > 0);

        // ─── SHARED TOUR: precio base × pasajeros ───
        if (service.esCompartido) {
            const precioPorPersona = availableVehicles[0]?.precio ?? 0;
            const pasajeros = formData.numeroPasajeros || 0;
            const totalCompartido = precioPorPersona * pasajeros;
            updateFormData({
                precioBase: precioPorPersona,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                precioAdicionales: 0,
                precioTotal: totalCompartido,
            });
            return;
        }

        // Base price = ServicioVehiculo.precio para el vehículo seleccionado
        const selectedVehicle = availableVehicles.find((v: any) => v.id === formData.vehiculoId);
        let basePrice = selectedVehicle ? Number(selectedVehicle.precio ?? 0) : 0;

        // For hourly services, multiply by number of hours
        if (service.esPorHoras && formData.cantidadHoras) {
            basePrice = basePrice * formData.cantidadHoras;
        }

        // Recargo de municipio — viene exclusivamente de MunicipioConfig
        const selectedMunicipioConfig = formData.municipioConfigId
            ? municipiosConfig.find((m) => m.id === formData.municipioConfigId)
            : null;
        const tarifaMunicipioConfigValue = selectedMunicipioConfig ? Number(selectedMunicipioConfig.recargo) : 0;

        const pricing = calculateTotalPrice({
            basePrice,
            vehiclePrice: 0,
            municipality: Municipio.OTRO,
            nightSurcharge,
            additionals: 0,
        });

        // Subtotal antes de comisión aliado
        const subtotalConDinamico = pricing.total + dynamicPrice + tarifaMunicipioConfigValue;

        // Comisión del aliado por vehículo (si aplica)
        let comisionAliado = 0;
        if (selectedVehicle && (selectedVehicle.comisionValor ?? 0) > 0) {
            comisionAliado = selectedVehicle.tipoComision === 'FIJO'
                ? Number(selectedVehicle.comisionValor)
                : Math.round(subtotalConDinamico * (Number(selectedVehicle.comisionValor) / 100));
        }

        const totalFinal = subtotalConDinamico + comisionAliado;

        // Si es "Otro municipio" sin config dinámica, no hay precio calculable
        if (formData.municipio === Municipio.OTRO && !formData.municipioConfigId) {
            updateFormData({
                precioBase: 0,
                recargoNocturno: 0,
                tarifaMunicipio: 0,
                precioAdicionales: dynamicPrice,
                comisionAliado: 0,
                precioTotal: 0,
            });
            return;
        }

        updateFormData({
            precioBase: basePrice,
            recargoNocturno: nightSurcharge,
            tarifaMunicipio: pricing.municipalityFee,
            precioAdicionales: dynamicPrice,
            tarifaMunicipioConfig: tarifaMunicipioConfigValue,
            comisionAliado,
            precioTotal: totalFinal,
        });
    }, [
        formData.hora,
        formData.municipio,
        formData.municipioConfigId,
        dynamicPrice,
        formData.datosDinamicos,
        formData.vehiculoId,
        formData.numeroPasajeros,
        formData.cantidadHoras,
        formData.aeropuertoNombre,
        availableVehicles,
        preciosPersonalizados,
        municipiosConfig,
        service.aplicaRecargoNocturno,
        service.montoRecargoNocturno,
        service.recargoNocturnoInicio,
        service.recargoNocturnoFin,
        service.id,
        service.nombre,
        service.esPorHoras,
        service.esCompartido,
        service.destinoAutoFill,
        service.infoTourCompartido,
        isTourPersona,
        preciosPorPersona,
        aliadoTipo,
        formData.lugarRecogida,
        formData.trasladoDestino,
        updateFormData
    ]);


    const isValid = () => {
        if (!formData.fecha || !formData.hora || !formData.municipio) {
            return false;
        }
        if (formData.municipio === Municipio.OTRO && !formData.municipioConfigId && !formData.otroMunicipio) {
            return false;
        }
        if (service.esPorHoras && (!formData.cantidadHoras || formData.cantidadHoras < 4)) {
            return false;
        }
        return formData.numeroPasajeros > 0;
    };

    // Shared tour validation
    const isSharedTour = service.esCompartido;
    if (isSharedTour) {
        const isValidShared = formData.fecha && formData.numeroPasajeros > 0 && formData.asistentes && formData.asistentes.length === formData.numeroPasajeros &&
            formData.asistentes.every(a => a.nombre && a.numeroDocumento);
        // We'll let validateStep in main wizard handle specific alerts, but local isValid logic needs to pass.
        // Actually Step 1 validation in main wizard just checks basic fields. We might need to make sure 'hora' and 'municipio' are set.
        // The pricing useEffect sets them.
    }

    const handleWhatsAppAssistance = () => {
        const message = encodeURIComponent(
            `Hola, necesito asistencia con el servicio: ${service.nombre}. Requiero múltiples recogidas o una petición personalizada.`
        );
        window.open(`https://wa.me/573106676736?text=${message}`, '_blank');
    };

    // Check if this is municipal transport
    const isTransporteMunicipal = service.esMunicipal;

    const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none transition-all bg-white text-gray-900 placeholder:text-gray-400";
    const readonlyClass = "w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none";
    const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
    const sectionClass = "space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-200";

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-900">{t('reservas.paso1_titulo', language)}</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                    {t('landing.paso2_titulo', language)}
                </p>
            </div>

            {/* 🚍 TRANSPORTE MUNICIPAL SECTION - Now handled by TRASLADO SECTION below */}


            {/* 🚍 SHARED TOUR SECTION */}
            {isSharedTour && (
                <div className="space-y-5">
                    <SharedTourLogisticsCard info={service.infoTourCompartido} language={language} />

                    {/* Date Selection */}
                    <div>
                        <label className={labelClass}>{language === 'es' ? 'Fecha' : 'Date'} *</label>
                        <DateInput
                            value={formData.fecha ? formData.fecha.toISOString().split('T')[0] : ''}
                            onChange={(dateStr) => {
                                if (!dateStr) {
                                    updateFormData({ fecha: null });
                                } else {
                                    const date = new Date(dateStr + 'T12:00:00Z');
                                    updateFormData({ fecha: date });
                                }
                            }}
                            required
                            className={inputClass}
                        />
                    </div>


                    {/* Passengers Count */}
                    <div>
                        <label className={labelClass}>{t('reservas.paso1_pasajeros', language)}</label>
                        <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white">
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                <FiUsers size={15} />
                                <span>{language === 'es' ? 'Pasajeros' : 'Passengers'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = Math.max(1, formData.numeroPasajeros - 1);
                                        const newAsistentes = [...(formData.asistentes || [])];
                                        if (newAsistentes.length > newVal) newAsistentes.length = newVal;
                                        updateFormData({ numeroPasajeros: newVal, asistentes: newAsistentes });
                                    }}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >−</button>
                                <span className="text-lg font-bold w-6 text-center text-gray-900">{formData.numeroPasajeros}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = formData.numeroPasajeros + 1;
                                        const newAsistentes = [...(formData.asistentes || [])];
                                        while (newAsistentes.length < newVal) {
                                            // @ts-ignore
                                            newAsistentes.push({ nombre: '', tipoDocumento: 'PASAPORTE', numeroDocumento: '', email: '', telefono: '' });
                                        }
                                        updateFormData({ numeroPasajeros: newVal, asistentes: newAsistentes });
                                    }}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >+</button>
                            </div>
                        </div>

                        {/* Price-per-person summary for shared tours */}
                        {service.esCompartido && formData.numeroPasajeros > 0 && availableVehicles[0] && (
                            <div className="mt-2 flex items-center justify-between px-1">
                                <span className="text-xs text-gray-400">
                                    {formData.numeroPasajeros} × {formatPrice(availableVehicles[0].precio)}
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                    = {formatPrice(availableVehicles[0].precio * formData.numeroPasajeros)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Participant details have been moved to Step 2 (Contact Info) */}

                </div>
            )}

            {/* 🎟️ TOUR POR PERSONA SECTION (formulario ágil con dirección de recogida) */}
            {isTourPersona && (
                <div className="space-y-5">
                    {/* Date Selection */}
                    <div>
                        <label className={labelClass}>{language === 'es' ? 'Fecha' : 'Date'} *</label>
                        <DateInput
                            value={formData.fecha ? formData.fecha.toISOString().split('T')[0] : ''}
                            onChange={(dateStr) => {
                                if (!dateStr) {
                                    updateFormData({ fecha: null });
                                } else {
                                    const date = new Date(dateStr + 'T12:00:00Z');
                                    updateFormData({ fecha: date });
                                }
                            }}
                            required
                            className={inputClass}
                        />
                    </div>

                    {/* Pickup address */}
                    <div>
                        <label className={labelClass}>{language === 'es' ? 'Dirección de recogida' : 'Pickup address'} *</label>
                        <input
                            type="text"
                            value={formData.lugarRecogida || ''}
                            onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                            placeholder={language === 'es' ? 'Hotel, dirección o punto de recogida' : 'Hotel, address or pickup point'}
                            className={inputClass}
                            required
                        />
                    </div>

                    {/* Passengers Count */}
                    <div>
                        <label className={labelClass}>{t('reservas.paso1_pasajeros', language)}</label>
                        <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white">
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                <FiUsers size={15} />
                                <span>{language === 'es' ? 'Pasajeros' : 'Passengers'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = Math.max(1, formData.numeroPasajeros - 1);
                                        const newAsistentes = [...(formData.asistentes || [])];
                                        if (newAsistentes.length > newVal) newAsistentes.length = newVal;
                                        updateFormData({ numeroPasajeros: newVal, asistentes: newAsistentes });
                                    }}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >−</button>
                                <span className="text-lg font-bold w-6 text-center text-gray-900">{formData.numeroPasajeros}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = formData.numeroPasajeros + 1;
                                        const newAsistentes = [...(formData.asistentes || [])];
                                        while (newAsistentes.length < newVal) {
                                            // @ts-ignore
                                            newAsistentes.push({ nombre: '', tipoDocumento: 'PASAPORTE', numeroDocumento: '', email: '', telefono: '' });
                                        }
                                        updateFormData({ numeroPasajeros: newVal, asistentes: newAsistentes });
                                    }}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >+</button>
                            </div>
                        </div>

                        {/* Per-person price summary */}
                        {formData.numeroPasajeros > 0 && preciosPorPersona && (() => {
                            const totalBase = totalPorPersona(preciosPorPersona, formData.numeroPasajeros);
                            const totalConComision = totalBase + comisionPorPersona(totalBase, aliadoTipo, comisionPorPersonaOverride);
                            const porPersona = Math.round(totalConComision / Math.max(1, formData.numeroPasajeros));
                            return (
                                <div className="mt-2 flex items-center justify-between px-1">
                                    <span className="text-xs text-gray-400">
                                        {formData.numeroPasajeros} × {formatPrice(porPersona)}
                                    </span>
                                    <span className="text-sm font-bold text-gray-900">
                                        = {formatPrice(totalConComision)}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Participant details have been moved to Step 2 (Contact Info) */}
                </div>
            )}

            {/* 🚗 TRASLADO SECTION (for Traslados and Municipal Transport) */}
            {isTraslado && !isSharedTour && (
                <div className={sectionClass}>
                    <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        {service.esMunicipal ? '🚍' : '🚗'}
                        {language === 'es'
                            ? (service.esMunicipal ? 'Detalles del Transporte' : 'Detalles del Traslado')
                            : (service.esMunicipal ? 'Transport Details' : 'Transfer Details')}
                    </h3>

                    {/* Direction Selection - Buttons */}
                    <div>
                        <label className={labelClass}>
                            {language === 'es' ? 'Dirección del Viaje' : 'Trip Direction'} *
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => updateFormData({ trasladoTipo: 'DESDE_UBICACION' })}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.trasladoTipo === 'DESDE_UBICACION'
                                    ? 'border-[#D6A75D] bg-[#D6A75D]/8'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.trasladoTipo === 'DESDE_UBICACION'
                                        ? 'border-[#D6A75D] bg-[#D6A75D]'
                                        : 'border-gray-300'}`}>
                                        {formData.trasladoTipo === 'DESDE_UBICACION' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {language === 'es' ? 'Desde mi Ubicación' : 'From my Location'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {language === 'es' ? `Hasta ${municipalityName}` : `To ${municipalityName}`}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => updateFormData({ trasladoTipo: 'DESDE_MUNICIPIO' })}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.trasladoTipo === 'DESDE_MUNICIPIO'
                                    ? 'border-[#D6A75D] bg-[#D6A75D]/8'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.trasladoTipo === 'DESDE_MUNICIPIO'
                                        ? 'border-[#D6A75D] bg-[#D6A75D]'
                                        : 'border-gray-300'}`}>
                                        {formData.trasladoTipo === 'DESDE_MUNICIPIO' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {language === 'es' ? `Desde ${municipalityName}` : `From ${municipalityName}`}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {language === 'es' ? 'Hasta mi Ubicación' : 'To my Location'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Origin/Destination based on direction */}
                    {formData.trasladoTipo && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Origin */}
                            <div>
                                <label className={labelClass}>
                                    {t('reservas.paso1_origen', language)} *
                                </label>
                                {formData.trasladoTipo === 'DESDE_UBICACION' && aliadoNombre ? (
                                    // From ally location - readonly
                                    <input
                                        type="text"
                                        value={aliadoNombre}
                                        readOnly
                                        className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                    />
                                ) : formData.trasladoTipo === 'DESDE_MUNICIPIO' ? (
                                    // From municipality - editable with default
                                    <input
                                        type="text"
                                        value={formData.lugarRecogida || ''}
                                        onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                                        placeholder={language === 'es' ? `Ej: ${municipalityName} - Parque Principal` : `E.g.: ${municipalityName} - Main Square`}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                    />
                                ) : (
                                    // From my location (no ally) - editable
                                    <input
                                        type="text"
                                        value={formData.lugarRecogida || ''}
                                        onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                                        placeholder={language === 'es' ? 'Ej: Hotel Dann Carlton, Parque Lleras, Mi Casa' : 'E.g.: Dann Carlton Hotel, Lleras Park, My Home'}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                    />
                                )}
                                {formData.trasladoTipo === 'DESDE_UBICACION' && !aliadoNombre && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {language === 'es'
                                            ? 'Ingresa tu dirección de origen o punto de encuentro'
                                            : 'Enter your origin address or meeting point'}
                                    </p>
                                )}
                                {formData.trasladoTipo === 'DESDE_MUNICIPIO' && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {language === 'es'
                                            ? 'Puedes agregar detalles como "Parque Principal" o una dirección específica'
                                            : 'You can add details like "Main Square" or a specific address'}
                                    </p>
                                )}
                            </div>

                            {/* Destination */}
                            <div>
                                <label className={labelClass}>
                                    {t('reservas.paso1_destino', language)} *
                                </label>
                                {formData.trasladoTipo === 'DESDE_UBICACION' ? (
                                    // To municipality - readonly
                                    <input
                                        type="text"
                                        value={municipalityName}
                                        readOnly
                                        className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                    />
                                ) : (
                                    // To my location - editable
                                    <input
                                        type="text"
                                        value={formData.trasladoDestino || ''}
                                        onChange={(e) => updateFormData({ trasladoDestino: e.target.value })}
                                        placeholder={language === 'es' ? 'Ej: Hotel X en Medellín, El Poblado' : 'E.g.: Hotel X in Medellín, El Poblado'}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🔥 AIRPORT SECTION - MOVED TO TOP */}
            {service.esAeropuerto && (
                <div className={sectionClass}>
                    <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Plane size={14} className="text-gray-500" />
                        {t('reservas.paso1_aeropuerto_seccion', language)}
                    </h3>

                    {/* Direction Selection - Buttons */}
                    <div>
                        <label className={labelClass}>
                            {t('reservas.paso1_aeropuerto_direccion', language)} *
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => updateFormData({ aeropuertoTipo: 'DESDE' })}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.aeropuertoTipo === 'DESDE'
                                    ? 'border-[#D6A75D] bg-[#D6A75D]/8'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.aeropuertoTipo === 'DESDE'
                                        ? 'border-[#D6A75D] bg-[#D6A75D]'
                                        : 'border-gray-300'}`}>
                                        {formData.aeropuertoTipo === 'DESDE' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {t('reservas.paso1_aeropuerto_desde', language)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {language === 'es' ? 'Llegada de vuelo' : 'Flight arrival'}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => updateFormData({ aeropuertoTipo: 'HACIA' })}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${formData.aeropuertoTipo === 'HACIA'
                                    ? 'border-[#D6A75D] bg-[#D6A75D]/8'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.aeropuertoTipo === 'HACIA'
                                        ? 'border-[#D6A75D] bg-[#D6A75D]'
                                        : 'border-gray-300'}`}>
                                        {formData.aeropuertoTipo === 'HACIA' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {t('reservas.paso1_aeropuerto_hacia', language)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {language === 'es' ? 'Salida de vuelo' : 'Flight departure'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Airport Selection */}
                    <div className="relative">
                        <label className={labelClass}>
                            {t('reservas.paso1_aeropuerto_seleccionar', language)} *
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsAirportOpen(!isAirportOpen)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none bg-white text-left flex justify-between items-center"
                            >
                                <span className="text-gray-900">
                                    {t(`aeropuerto.${formData.aeropuertoNombre || 'JOSE_MARIA_CORDOVA'}`, language)}
                                </span>
                                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isAirportOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isAirportOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateFormData({ aeropuertoNombre: 'JOSE_MARIA_CORDOVA' });
                                            setIsAirportOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${formData.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' || !formData.aeropuertoNombre ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                    >
                                        {t('aeropuerto.JOSE_MARIA_CORDOVA', language)}
                                        {(formData.aeropuertoNombre === 'JOSE_MARIA_CORDOVA' || !formData.aeropuertoNombre) && <FiCheck />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateFormData({ aeropuertoNombre: 'OLAYA_HERRERA' });
                                            setIsAirportOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${formData.aeropuertoNombre === 'OLAYA_HERRERA' ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                    >
                                        {t('aeropuerto.OLAYA_HERRERA', language)}
                                        {formData.aeropuertoNombre === 'OLAYA_HERRERA' && <FiCheck />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Origin/Destination - Auto-filled based on direction */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Origin */}
                        <div>
                            <label className={labelClass}>
                                {t('reservas.paso1_origen', language)} *
                            </label>
                            {formData.aeropuertoTipo === 'DESDE' ? (
                                <input
                                    type="text"
                                    value={t(`aeropuerto.${formData.aeropuertoNombre || 'JOSE_MARIA_CORDOVA'}`, language)}
                                    readOnly
                                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                />
                            ) : isHotel ? (
                                <input
                                    type="text"
                                    value={hotelName}
                                    readOnly
                                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={formData.lugarRecogida || ''}
                                    onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                                    placeholder={language === 'es' ? 'Ej: Hotel Dann Carlton, Parque Lleras' : 'E.g.: Dann Carlton Hotel, Lleras Park'}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                />
                            )}
                        </div>

                        {/* Destination */}
                        <div>
                            <label className={labelClass}>
                                {t('reservas.paso1_destino', language)} *
                            </label>
                            {formData.aeropuertoTipo === 'HACIA' ? (
                                <input
                                    type="text"
                                    value={t(`aeropuerto.${formData.aeropuertoNombre || 'JOSE_MARIA_CORDOVA'}`, language)}
                                    readOnly
                                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                />
                            ) : isHotel ? (
                                <input
                                    type="text"
                                    value={hotelName}
                                    readOnly
                                    className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={formData.lugarRecogida || ''}
                                    onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                                    placeholder={language === 'es' ? 'Ej: Hotel Dann Carlton, Parque Lleras' : 'E.g.: Dann Carlton Hotel, Lleras Park'}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                                />
                            )}
                        </div>
                    </div>

                    {/* Flight Number */}
                    <div>
                        <label className={labelClass}>
                            {t('reservas.paso1_numero_vuelo', language)}
                            {formData.aeropuertoTipo === 'DESDE' ? ' *' : ''}
                            {formData.aeropuertoTipo === 'HACIA' && <span className="text-gray-500 text-xs ml-1">({language === 'es' ? 'opcional' : 'optional'})</span>}
                        </label>
                        <input
                            type="text"
                            value={formData.numeroVuelo || ''}
                            onChange={(e) => updateFormData({ numeroVuelo: e.target.value })}
                            placeholder="Ej: AV123"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                        />
                    </div>
                </div>
            )}

            {/* Common Fields - Hidden for Tour Compartido y Tour por persona (tienen su propia sección) */}
            {!isSharedTour && !isTourPersona && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origen fijo para hoteles en servicios NO aeropuerto y NO traslado */}
                    {!service.esAeropuerto && !isTransporteMunicipal && !isTraslado && isHotel && (
                        <div className="md:col-span-2">
                            <label className={labelClass}>
                                {t('reservas.paso1_origen', language)} *
                            </label>
                            <input
                                type="text"
                                value={hotelName}
                                readOnly
                                className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                            />
                        </div>
                    )}

                    {/* Destino (Auto-fill or Select) - Only show if NOT airport service AND NOT municipal transport AND NOT traslado */}
                    {service.destinoAutoFill && !service.esAeropuerto && !isTransporteMunicipal && !isTraslado ? (
                        <div className="md:col-span-2">
                            <label className={labelClass}>
                                {language === 'es' ? 'Destino' : 'Destination'}
                            </label>
                            <input
                                type="text"
                                value={service.destinoAutoFill}
                                readOnly
                                className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                            />
                        </div>
                    ) : null}

                    {/* Lugar de Recogida - Only show if NOT airport service AND NOT hotel AND NOT municipal transport AND NOT traslado */}
                    {!service.esAeropuerto && !isHotel && !isTransporteMunicipal && !isTraslado && (
                        <div className="md:col-span-2">
                            <label className={labelClass}>
                                {t('reservas.paso1_lugar_recogida', language)} *
                            </label>
                            <input
                                type="text"
                                value={formData.lugarRecogida || ''}
                                onChange={(e) => updateFormData({ lugarRecogida: e.target.value })}
                                placeholder="Ej: Hotel Dann Carlton, Parque Lleras, etc."
                                disabled={isSharedTour}
                                className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none ${isSharedTour ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            />
                            {isSharedTour && (
                                <p className="text-sm text-gray-500 mt-1">
                                    {language === 'es' ? '📍 Punto de encuentro fijo para este tour compartido' : '📍 Fixed meeting point for this shared tour'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Municipio - Hidden for Shared Tours */}
                    {!isSharedTour && (
                        <div className="md:col-span-2 relative">
                            <label className={labelClass}>
                                {language === 'es' ? 'Municipio donde estás ubicado' : 'Municipality where you are located'} *
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsMunicipalityOpen(!isMunicipalityOpen)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none bg-white text-left flex justify-between items-center"
                                >
                                    <span className={formData.municipio ? 'text-gray-900' : 'text-gray-500'}>
                                        {formData.municipio ? (() => {
                                            if (formData.municipioConfigId) {
                                                const cfg = municipiosConfig.find((m) => m.id === formData.municipioConfigId);
                                                if (cfg) return language === 'es' ? cfg.nombreES : cfg.nombreEN;
                                            }
                                            // Fallback: "Otro" without a config
                                            return language === 'es' ? 'Otro' : 'Other';
                                        })() : (language === 'es' ? 'Seleccionar...' : 'Select...')}
                                    </span>
                                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isMunicipalityOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isMunicipalityOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {/* All municipalities come from admin config */}
                                        {municipiosConfig.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-400 text-center">
                                                {language === 'es' ? 'No hay municipios configurados' : 'No municipalities configured'}
                                            </div>
                                        )}
                                        {municipiosConfig.map((cfg) => {
                                            const label = language === 'es' ? cfg.nombreES : cfg.nombreEN;
                                            const isSelectedCfg = formData.municipioConfigId === cfg.id;
                                            return (
                                                <button
                                                    key={cfg.id}
                                                    type="button"
                                                    onClick={() => {
                                                        updateFormData({
                                                            municipio: Municipio.OTRO,
                                                            otroMunicipio: cfg.nombreES,
                                                            municipioConfigId: cfg.id,
                                                            tarifaMunicipioConfig: Number(cfg.recargo),
                                                        });
                                                        setIsMunicipalityOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${isSelectedCfg ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                                >
                                                    <span>
                                                        {label}
                                                        {Number(cfg.recargo) > 0 && (
                                                            <span className="ml-2 text-xs text-amber-600">
                                                                +${Number(cfg.recargo).toLocaleString('es-CO')}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isSelectedCfg && <FiCheck />}
                                                </button>
                                            );
                                        })}
                                        {/* Fallback: municipality not in the list */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                updateFormData({ municipio: Municipio.OTRO, municipioConfigId: null, tarifaMunicipioConfig: 0 });
                                                setIsMunicipalityOpen(false);
                                            }}
                                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-t border-gray-100 ${formData.municipio === Municipio.OTRO && !formData.municipioConfigId ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-500'}`}
                                        >
                                            <span>{language === 'es' ? `Otro (${t('reservas.paso1_requiere_cotizacion', language)})` : `Other (${t('reservas.paso1_requiere_cotizacion', language)})`}</span>
                                            {formData.municipio === Municipio.OTRO && !formData.municipioConfigId && <FiCheck />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Other Municipality — only for truly unspecified, not dynamic config entries */}
                    {formData.municipio === Municipio.OTRO && !formData.municipioConfigId && (
                        <div className="md:col-span-2">
                            <label className={labelClass}>
                                {t('reservas.paso1_municipio', language)} (Especificar) *
                            </label>
                            <input
                                type="text"
                                value={formData.otroMunicipio || ''}
                                onChange={(e) => updateFormData({ otroMunicipio: e.target.value })}
                                placeholder="Ej: Rionegro, Guatapé, etc."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                            />
                        </div>
                    )}
                    {/* Dynamic municipioConfig selector — merged into main municipio dropdown above */}
                    {false && municipiosConfig.length > 0 && !isSharedTour && (
                        <div className="md:col-span-2 relative">
                            <label className={labelClass}>
                                {language === 'es' ? '¿Desde qué municipio sales?' : 'Which municipality are you departing from?'}
                                <span className="text-gray-400 text-xs ml-1">({language === 'es' ? 'opcional' : 'optional'})</span>
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsMunicipioConfigOpen(!isMunicipioConfigOpen)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none bg-white text-left flex justify-between items-center"
                                >
                                    <span className={formData.municipioConfigId ? 'text-gray-900' : 'text-gray-500'}>
                                        {formData.municipioConfigId
                                            ? (municipiosConfig.find((m) => m.id === formData.municipioConfigId)?.[language === 'es' ? 'nombreES' : 'nombreEN'] ?? 'Seleccionar...')
                                            : (language === 'es' ? 'Seleccionar...' : 'Select...')}
                                    </span>
                                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isMunicipioConfigOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isMunicipioConfigOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {/* None option */}
                                        <button
                                            type="button"
                                            onClick={() => { updateFormData({ municipioConfigId: null, tarifaMunicipioConfig: 0 }); setIsMunicipioConfigOpen(false); }}
                                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${!formData.municipioConfigId ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-500'}`}
                                        >
                                            {language === 'es' ? 'Ninguno' : 'None'}
                                            {!formData.municipioConfigId && <FiCheck />}
                                        </button>
                                        {municipiosConfig.map((m) => {
                                            const label = language === 'es' ? m.nombreES : m.nombreEN;
                                            const isSelected = formData.municipioConfigId === m.id;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { updateFormData({ municipioConfigId: m.id }); setIsMunicipioConfigOpen(false); }}
                                                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                                >
                                                    <span>
                                                        {label}
                                                        {Number(m.recargo) > 0 && (
                                                            <span className="ml-2 text-xs text-gray-500">
                                                                +${Number(m.recargo).toLocaleString('es-CO')}
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isSelected && <FiCheck />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {formData.municipioConfigId && (() => {
                                const sel = municipiosConfig.find((m) => m.id === formData.municipioConfigId);
                                const recargo = Number(sel?.recargo ?? 0);
                                return recargo > 0 ? (
                                    <p className="text-xs text-amber-600 mt-1">
                                        + ${recargo.toLocaleString('es-CO')} {language === 'es' ? 'recargo por municipio' : 'municipality surcharge'}
                                    </p>
                                ) : null;
                            })()}
                        </div>
                    )}

                    {/* Language */}
                    <div className="relative">
                        <label className={labelClass}>
                            {t('reservas.paso1_idioma', language)} *
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none bg-white text-left flex justify-between items-center"
                            >
                                <span className="text-gray-900">
                                    {formData.idioma === Idioma.ES ? 'Español' : 'English'}
                                </span>
                                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isLanguageOpen && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => { updateFormData({ idioma: Idioma.ES }); setIsLanguageOpen(false); }}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${formData.idioma === Idioma.ES ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                    >
                                        Español
                                        {formData.idioma === Idioma.ES && <FiCheck />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { updateFormData({ idioma: Idioma.EN }); setIsLanguageOpen(false); }}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${formData.idioma === Idioma.EN ? 'bg-gray-50 text-[#D6A75D] font-medium' : 'text-gray-700'}`}
                                    >
                                        English
                                        {formData.idioma === Idioma.EN && <FiCheck />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className={labelClass}>{t('tracking.fecha', language)} *</label>
                        <DateInput
                            value={formData.fecha ? formData.fecha.toISOString().split('T')[0] : ''}
                            onChange={(value) => {
                                if (value) {
                                    const [year, month, day] = value.split('-').map(Number);
                                    updateFormData({ fecha: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) });
                                } else {
                                    updateFormData({ fecha: null });
                                }
                            }}
                            className={inputClass}
                            required
                        />
                    </div>

                    {/* Time */}
                    <div>
                        <label className={labelClass}>{t('tracking.hora', language)} *</label>
                        <TimeInput
                            value={formData.hora}
                            onChange={(value) => updateFormData({ hora: value })}
                            className={inputClass}
                            required
                        />
                        {showNightSurcharge && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                <FiAlertCircle size={12} /> +{formatPrice(formData.recargoNocturno)} {t('reservas.paso4_recargo', language)}
                            </p>
                        )}
                    </div>



                    {/* Passengers */}
                    <div>
                        <label className={labelClass}>{t('reservas.paso1_pasajeros', language)} *</label>
                        <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white">
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                <FiUsers size={15} />
                                <span>{language === 'es' ? 'Pasajeros' : 'Passengers'}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => updateFormData({ numeroPasajeros: Math.max(1, formData.numeroPasajeros - 1) })}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >−</button>
                                <span className="text-lg font-bold w-6 text-center text-gray-900">{formData.numeroPasajeros || 0}</span>
                                <button
                                    type="button"
                                    onClick={() => updateFormData({ numeroPasajeros: formData.numeroPasajeros + 1 })}
                                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-400 transition-colors font-bold text-lg leading-none"
                                >+</button>
                            </div>
                        </div>
                    </div>

                    {/* Hours (for hourly services) */}
                    {service.esPorHoras && (
                        <div>
                            <label className={labelClass}>
                                {language === 'es' ? 'Cantidad de Horas' : 'Number of Hours'} *
                            </label>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={4}
                                value={formData.cantidadHoras ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        updateFormData({ cantidadHoras: undefined });
                                    } else {
                                        const num = parseInt(val);
                                        if (!isNaN(num)) {
                                            updateFormData({ cantidadHoras: num < 4 ? 4 : num });
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (!formData.cantidadHoras || formData.cantidadHoras < 4) {
                                        updateFormData({ cantidadHoras: 4 });
                                    }
                                }}
                                placeholder="4"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D6A75D]/30 focus:border-[#D6A75D] outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {language === 'es' ? 'Mínimo 4 horas' : 'Minimum 4 hours'}
                            </p>
                        </div>
                    )}

                    {/* Vehicle Auto-Assignment — hidden for shared tours and fixed-destination services */}
                    <div className="md:col-span-2">
                        {formData.numeroPasajeros > 0 && !service.esCompartido && !isTourPersona && !service.destinoAutoFill && (
                            recommendedVehicle ? (
                                <div className="flex items-center gap-4 p-4 border border-gray-100 bg-white rounded-2xl shadow-sm">
                                    <div className="relative w-20 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                        {recommendedVehicle.imagen ? (
                                            <Image
                                                src={recommendedVehicle.imagen}
                                                alt={recommendedVehicle.nombre}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <FiUser size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                                            {language === 'es' ? 'Vehículo asignado' : 'Assigned vehicle'}
                                        </p>
                                        <p className="text-sm font-bold text-gray-900">{recommendedVehicle.nombre}</p>
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                            <FiUsers size={11} />
                                            <span>{recommendedVehicle.capacidadMinima}–{recommendedVehicle.capacidadMaxima} {language === 'es' ? 'personas' : 'people'}</span>
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 bg-[#D6A75D] rounded-full"></div>
                                </div>
                            ) : (
                                <div className="p-4 border border-red-100 bg-red-50 rounded-2xl">
                                    <p className="text-sm text-red-600">
                                        {language === 'es'
                                            ? `Sin vehículo para ${formData.numeroPasajeros} pasajeros. Contáctanos.`
                                            : `No vehicle for ${formData.numeroPasajeros} passengers. Contact us.`}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* 🔥 NEW: Dynamic Fields with updated interface */}
            {dynamicFields.length > 0 && !isTourPersona && (
                <DynamicFields
                    fields={dynamicFields}
                    values={formData.datosDinamicos || {}}
                    onChange={(values) => updateFormData({ datosDinamicos: values })}
                    onPriceChange={setDynamicPrice}
                    language={formData.idioma}
                />
            )}

            {/* Price Calculator Removed - Moved to Footer */}

            {formData.municipio === Municipio.OTRO && !formData.municipioConfigId && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm text-amber-800">
                        <span className="font-semibold">{t('reservas.paso1_requiere_cotizacion', language)}</span>
                        <span className="block mt-0.5 text-amber-700">
                            {language === 'es' ? `Te contactaremos pronto con el precio para ${formData.otroMunicipio}` : `We will contact you soon with the price for ${formData.otroMunicipio}`}
                        </span>
                    </p>
                </div>
            )}

            {/* WhatsApp Assistance - Only for Airport Services */}
            {service.esAeropuerto && (
                <button
                    type="button"
                    onClick={handleWhatsAppAssistance}
                    className="text-sm text-gray-600 hover:text-[#D6A75D] underline"
                >
                    {t('reservas.paso1_asistencia', language)}
                </button>
            )}
        </div>
    );
}
