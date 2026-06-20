'use client';

import { ReservationFormData, Asistente } from '@/types/reservation';
import { TipoDocumento } from '@prisma/client';
import { FiUser, FiUsers, FiAlertCircle, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useLanguage, t } from '@/lib/i18n';
import LegalNotice from '@/components/LegalNotice';
import { useEffect, useState } from 'react';

interface Step2Props {
    formData: ReservationFormData;
    updateFormData: (updates: Partial<ReservationFormData>) => void;
    onNext: () => void;
    onBack: () => void;
    esAeropuerto?: boolean; // Cuando es true, los pasajeros adicionales son opcionales
    isAlly?: boolean; // Cuando es true, los pasajeros adicionales son opcionales
}

export default function Step2ContactInfo({ formData, updateFormData, onNext, onBack, esAeropuerto = false, isAlly = false }: Step2Props) {
    const { language } = useLanguage();

    // Number of additional passengers (beyond the main contact)
    const additionalPassengersNeeded = Math.max(0, formData.numeroPasajeros - 1);

    // Para aeropuerto: cuántos pasajeros opcionales se han agregado manualmente
    const [addedOptionalPassengers, setAddedOptionalPassengers] = useState(0);

    // Ensure we have the correct number of attendees based on numeroPasajeros
    useEffect(() => {
        // Para servicios de aeropuerto O aliados, solo crear el primer asistente (representante)
        if (esAeropuerto || isAlly) {
            const currentAttendees = formData.asistentes.length;
            // Solo inicializar si no hay asistentes o si el representante no existe
            if (currentAttendees === 0) {
                updateFormData({
                    asistentes: [{
                        nombre: formData.nombreCliente || '',
                        tipoDocumento: formData.tipoDocumentoCliente || TipoDocumento.PASAPORTE,
                        numeroDocumento: formData.numeroDocumentoCliente || '',
                        email: formData.emailCliente || '',
                        telefono: formData.whatsappCliente || ''
                    }]
                });
            }
            return;
        }

        // Para otros servicios, comportamiento normal
        const requiredAttendees = formData.numeroPasajeros;
        const currentAttendees = formData.asistentes.length;

        if (currentAttendees !== requiredAttendees) {
            const newAsistentes: Asistente[] = [];

            // First attendee is always the contact person
            newAsistentes.push({
                nombre: formData.nombreCliente || '',
                tipoDocumento: formData.tipoDocumentoCliente || TipoDocumento.PASAPORTE,
                numeroDocumento: formData.numeroDocumentoCliente || '',
                email: formData.emailCliente || '',
                telefono: formData.whatsappCliente || ''
            });

            // Add additional attendees
            for (let i = 1; i < requiredAttendees; i++) {
                // Keep existing data if available
                if (formData.asistentes[i]) {
                    newAsistentes.push(formData.asistentes[i]);
                } else {
                    newAsistentes.push({
                        nombre: '',
                        tipoDocumento: TipoDocumento.PASAPORTE,
                        numeroDocumento: '',
                        email: '',
                        telefono: ''
                    });
                }
            }

            updateFormData({ asistentes: newAsistentes });
        }
    }, [formData.numeroPasajeros, esAeropuerto, isAlly]);

    // Sync contact info to first attendee when contact fields change
    const updateContactAndFirstAttendee = (field: 'nombreCliente' | 'emailCliente' | 'whatsappCliente', value: string) => {
        const updates: Partial<ReservationFormData> = { [field]: value };

        // Also update first attendee
        if (formData.asistentes.length > 0) {
            const updatedAsistentes = [...formData.asistentes];
            if (field === 'nombreCliente') {
                updatedAsistentes[0] = { ...updatedAsistentes[0], nombre: value };
            } else if (field === 'emailCliente') {
                updatedAsistentes[0] = { ...updatedAsistentes[0], email: value };
            } else if (field === 'whatsappCliente') {
                updatedAsistentes[0] = { ...updatedAsistentes[0], telefono: value };
            }
            updates.asistentes = updatedAsistentes;
        }

        updateFormData(updates);
    };

    // Update document type for contact (synced to first attendee)
    const updateDocumentoCliente = (field: 'tipoDocumentoCliente' | 'numeroDocumentoCliente', value: string) => {
        const updates: Partial<ReservationFormData> = { [field]: value };

        // Also update first attendee
        if (formData.asistentes.length > 0) {
            const updatedAsistentes = [...formData.asistentes];
            if (field === 'tipoDocumentoCliente') {
                updatedAsistentes[0] = { ...updatedAsistentes[0], tipoDocumento: value as TipoDocumento };
            } else if (field === 'numeroDocumentoCliente') {
                updatedAsistentes[0] = { ...updatedAsistentes[0], numeroDocumento: value };
            }
            updates.asistentes = updatedAsistentes;
        }

        updateFormData(updates);
    };

    const updateAsistente = (index: number, field: keyof Asistente, value: string) => {
        const updated = [...formData.asistentes];
        updated[index] = { ...updated[index], [field]: value };

        // If updating first attendee, also sync to contact fields
        if (index === 0) {
            const contactUpdates: Partial<ReservationFormData> = { asistentes: updated };
            if (field === 'nombre') contactUpdates.nombreCliente = value;
            if (field === 'email') contactUpdates.emailCliente = value;
            if (field === 'telefono') contactUpdates.whatsappCliente = value;
            if (field === 'tipoDocumento') contactUpdates.tipoDocumentoCliente = value as TipoDocumento;
            if (field === 'numeroDocumento') contactUpdates.numeroDocumentoCliente = value;
            updateFormData(contactUpdates);
        } else {
            updateFormData({ asistentes: updated });
        }
    };

    // Count how many passengers are complete
    const completedPassengers = formData.asistentes.filter(a =>
        a.nombre.trim().length >= 2 &&
        a.numeroDocumento.trim().length >= 4
    ).length;

    // Función para agregar un pasajero opcional (solo para aeropuerto)
    const addOptionalPassenger = () => {
        if (addedOptionalPassengers < additionalPassengersNeeded) {
            const updatedAsistentes = [...formData.asistentes];
            updatedAsistentes.push({
                nombre: '',
                tipoDocumento: TipoDocumento.PASAPORTE,
                numeroDocumento: '',
                email: '',
                telefono: ''
            });
            updateFormData({ asistentes: updatedAsistentes });
            setAddedOptionalPassengers(prev => prev + 1);
        }
    };

    // Función para eliminar un pasajero opcional
    const removeOptionalPassenger = (index: number) => {
        if (index > 0) { // Nunca eliminar el representante
            const updatedAsistentes = formData.asistentes.filter((_, i) => i !== index);
            updateFormData({ asistentes: updatedAsistentes });
            setAddedOptionalPassengers(prev => Math.max(0, prev - 1));
        }
    };

    const isValid = () => {
        // Validación base del representante (siempre obligatorio)
        const contactValid =
            formData.nombreCliente.trim().length >= 3 &&
            formData.whatsappCliente.trim().length >= 10 &&
            formData.emailCliente.includes('@') &&
            (formData.numeroDocumentoCliente?.trim().length || 0) >= 4;

        // Para servicios de aeropuerto O aliados, solo el representante es obligatorio
        if (esAeropuerto || isAlly) {
            return contactValid;
        }

        // Para otros servicios, todos los pasajeros son obligatorios
        return (
            contactValid &&
            formData.asistentes.length >= formData.numeroPasajeros &&
            formData.asistentes.slice(0, formData.numeroPasajeros).every(a =>
                a.nombre.trim().length >= 2 &&
                a.numeroDocumento.trim().length >= 4
            )
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">{t('reservas.paso2_titulo', language)}</h2>
                <p className="text-gray-600">
                    {language === 'es' ? 'Necesitamos tus datos para coordinar el servicio' : 'We need your details to coordinate the service'}
                </p>
            </div>

            {/* Passenger count indicator */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <FiUsers className="text-blue-600" size={24} />
                <div>
                    <p className="font-medium text-blue-900">
                        {language === 'es'
                            ? `${formData.numeroPasajeros} pasajero${formData.numeroPasajeros > 1 ? 's' : ''} en total`
                            : `${formData.numeroPasajeros} passenger${formData.numeroPasajeros > 1 ? 's' : ''} total`}
                    </p>
                    <p className="text-sm text-blue-700">
                        {esAeropuerto || isAlly
                            ? (language === 'es'
                                ? 'Solo los datos del representante son obligatorios'
                                : 'Only representative details are required')
                            : (completedPassengers === formData.numeroPasajeros
                                ? (language === 'es' ? '✓ Todos los datos completos' : '✓ All details complete')
                                : (language === 'es'
                                    ? `Completa los datos de ${formData.numeroPasajeros - completedPassengers} pasajero(s)`
                                    : `Complete details for ${formData.numeroPasajeros - completedPassengers} passenger(s)`))}
                    </p>
                </div>
            </div>

            {/* Contact fields - Main Passenger (Passenger 1) */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-[#D6A75D] rounded-full flex items-center justify-center text-white">
                        <span className="font-bold text-sm">1</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">
                            {language === 'es' ? 'Tus Datos (Pasajero Principal)' : 'Your Info (Main Passenger)'}
                        </h3>
                        <p className="text-xs text-gray-600">
                            {language === 'es' ? 'Persona de contacto y primer pasajero' : 'Contact person and first passenger'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('reservas.paso2_nombre', language)} *
                        </label>
                        <input
                            type="text"
                            value={formData.nombreCliente}
                            onChange={(e) => updateContactAndFirstAttendee('nombreCliente', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            placeholder="Juan Pérez"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('reservas.paso2_whatsapp', language)} *
                        </label>
                        <input
                            type="tel"
                            value={formData.whatsappCliente}
                            onChange={(e) => updateContactAndFirstAttendee('whatsappCliente', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            placeholder="+57 300 123 4567"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {language === 'es'
                                ? 'Este número lo usaremos para contactarte en caso de necesitarlo'
                                : 'We will use this number to contact you if needed'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('reservas.paso2_email', language)} *
                        </label>
                        <input
                            type="email"
                            value={formData.emailCliente}
                            onChange={(e) => updateContactAndFirstAttendee('emailCliente', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            placeholder="juan@email.com"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {language === 'es'
                                ? 'A este correo te llegarán actualizaciones de tu servicio'
                                : 'Service updates will be sent to this email'}
                        </p>
                    </div>

                    {/* Document fields for contact person */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {language === 'es' ? 'Tipo de Documento' : 'Document Type'} *
                        </label>
                        <select
                            value={formData.tipoDocumentoCliente || TipoDocumento.PASAPORTE}
                            onChange={(e) => updateDocumentoCliente('tipoDocumentoCliente', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                        >
                            <option value={TipoDocumento.CC}>{t('tipoDocumento.CC', language)}</option>
                            <option value={TipoDocumento.PASAPORTE}>{t('tipoDocumento.PASAPORTE', language)}</option>
                            <option value={TipoDocumento.TI}>{t('tipoDocumento.TI', language)}</option>
                            <option value={TipoDocumento.CE}>{t('tipoDocumento.CE', language)}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {language === 'es' ? 'Número de Documento' : 'Document Number'} *
                        </label>
                        <input
                            type="text"
                            value={formData.numeroDocumentoCliente || ''}
                            onChange={(e) => updateDocumentoCliente('numeroDocumentoCliente', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none"
                            placeholder="1234567890"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Additional Passengers - Different behavior for airport/ally vs other services */}
            {additionalPassengersNeeded > 0 && (
                <div className="space-y-4">
                    {/* Para servicios de aeropuerto O aliados: Botón para agregar pasajeros opcionales */}
                    {esAeropuerto || isAlly ? (
                        <>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FiUsers className="text-gray-600" />
                                    <h3 className="text-lg font-bold">
                                        {language === 'es'
                                            ? 'Pasajeros Adicionales (Opcional)'
                                            : 'Additional Passengers (Optional)'}
                                    </h3>
                                </div>
                                {formData.asistentes.length - 1 < additionalPassengersNeeded && (
                                    <button
                                        type="button"
                                        onClick={addOptionalPassenger}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#D6A75D] hover:bg-[#C5964A] text-black font-medium rounded-lg transition-colors"
                                    >
                                        <FiPlus size={18} />
                                        {language === 'es' ? 'Agregar Pasajero' : 'Add Passenger'}
                                    </button>
                                )}
                            </div>

                            {formData.asistentes.length > 1 && (
                                <p className="text-sm text-gray-600">
                                    {language === 'es'
                                        ? `${formData.asistentes.length - 1} de ${additionalPassengersNeeded} pasajeros adicionales agregados`
                                        : `${formData.asistentes.length - 1} of ${additionalPassengersNeeded} additional passengers added`}
                                </p>
                            )}

                            {/* Pasajeros agregados manualmente */}
                            <div className="space-y-3">
                                {formData.asistentes.slice(1).map((asistente, idx) => {
                                    const index = idx + 1;
                                    const isComplete = asistente.nombre.trim().length >= 2 && asistente.numeroDocumento.trim().length >= 4;

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 border rounded-lg space-y-3 ${isComplete ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold ${isComplete ? 'bg-green-500' : 'bg-gray-400'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-medium text-gray-700">
                                                        {language === 'es' ? `Pasajero ${index + 1}` : `Passenger ${index + 1}`}
                                                    </span>
                                                    {isComplete && (
                                                        <span className="text-green-600 text-sm">✓</span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeOptionalPassenger(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title={language === 'es' ? 'Eliminar pasajero' : 'Remove passenger'}
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <input
                                                    type="text"
                                                    value={asistente.nombre}
                                                    onChange={(e) => updateAsistente(index, 'nombre', e.target.value)}
                                                    placeholder={language === 'es' ? 'Nombre Completo' : 'Full Name'}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                />
                                                <select
                                                    value={asistente.tipoDocumento}
                                                    onChange={(e) => updateAsistente(index, 'tipoDocumento', e.target.value)}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                >
                                                    <option value={TipoDocumento.CC}>{t('tipoDocumento.CC', language)}</option>
                                                    <option value={TipoDocumento.PASAPORTE}>{t('tipoDocumento.PASAPORTE', language)}</option>
                                                    <option value={TipoDocumento.TI}>{t('tipoDocumento.TI', language)}</option>
                                                    <option value={TipoDocumento.CE}>{t('tipoDocumento.CE', language)}</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={asistente.numeroDocumento}
                                                    onChange={(e) => updateAsistente(index, 'numeroDocumento', e.target.value)}
                                                    placeholder={language === 'es' ? 'No. Documento' : 'Doc Number'}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {formData.asistentes.length === 1 && (
                                <p className="text-sm text-gray-500 italic">
                                    {language === 'es'
                                        ? 'Puedes agregar los datos de los demás pasajeros si lo deseas, pero no es obligatorio.'
                                        : 'You can add other passengers\' details if you wish, but it\'s not required.'}
                                </p>
                            )}
                        </>
                    ) : (
                        /* Para otros servicios: Mostrar todos los pasajeros (obligatorios) */
                        <>
                            <div className="flex items-center gap-2">
                                <FiUsers className="text-gray-600" />
                                <h3 className="text-lg font-bold">
                                    {language === 'es'
                                        ? `Pasajeros Adicionales (${additionalPassengersNeeded})`
                                        : `Additional Passengers (${additionalPassengersNeeded})`}
                                </h3>
                            </div>

                            <div className="space-y-3">
                                {Array.from({ length: additionalPassengersNeeded }).map((_, idx) => {
                                    const index = idx + 1;
                                    const asistente = formData.asistentes[index] || { nombre: '', tipoDocumento: TipoDocumento.PASAPORTE, numeroDocumento: '', email: '', telefono: '' };
                                    const isComplete = asistente.nombre.trim().length >= 2 && asistente.numeroDocumento.trim().length >= 4;

                                    return (
                                        <div
                                            key={index}
                                            className={`p-4 border rounded-lg space-y-3 ${isComplete ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold ${isComplete ? 'bg-green-500' : 'bg-gray-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <span className="font-medium text-gray-700">
                                                    {language === 'es' ? `Pasajero ${index + 1}` : `Passenger ${index + 1}`}
                                                </span>
                                                {isComplete && (
                                                    <span className="text-green-600 text-sm">✓</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <input
                                                    type="text"
                                                    value={asistente.nombre}
                                                    onChange={(e) => updateAsistente(index, 'nombre', e.target.value)}
                                                    placeholder={(language === 'es' ? 'Nombre Completo' : 'Full Name') + ' *'}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                />
                                                <select
                                                    value={asistente.tipoDocumento}
                                                    onChange={(e) => updateAsistente(index, 'tipoDocumento', e.target.value)}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                >
                                                    <option value={TipoDocumento.CC}>{t('tipoDocumento.CC', language)}</option>
                                                    <option value={TipoDocumento.PASAPORTE}>{t('tipoDocumento.PASAPORTE', language)}</option>
                                                    <option value={TipoDocumento.TI}>{t('tipoDocumento.TI', language)}</option>
                                                    <option value={TipoDocumento.CE}>{t('tipoDocumento.CE', language)}</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={asistente.numeroDocumento}
                                                    onChange={(e) => updateAsistente(index, 'numeroDocumento', e.target.value)}
                                                    placeholder={(language === 'es' ? 'No. Documento' : 'Doc Number') + ' *'}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Warning if not all passengers filled - Only show for non-airport/non-ally services */}
            {!esAeropuerto && !isAlly && completedPassengers < formData.numeroPasajeros && formData.numeroPasajeros > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800">
                    <FiAlertCircle size={20} />
                    <p className="text-sm">
                        {language === 'es'
                            ? `Debes completar los datos de todos los ${formData.numeroPasajeros} pasajeros para continuar.`
                            : `You must complete the details for all ${formData.numeroPasajeros} passengers to continue.`}
                    </p>
                </div>
            )}

            <p className="text-xs text-gray-500">
                {t('reservas.paso2_asistentes_nota', language)}
            </p>

            {/* Aviso Legal */}
            <LegalNotice />
        </div>
    );
}
