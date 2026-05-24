'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FiLoader, FiCheckCircle, FiAlertTriangle, FiCamera } from 'react-icons/fi';

type Status = 'loading' | 'valid' | 'invalid' | 'submitting' | 'done';

export default function ConductorRegistroPage({ params }: { params: { token: string } }) {
    const { token } = params;
    const [status, setStatus] = useState<Status>('loading');
    const [error, setError] = useState<string>('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [form, setForm] = useState({
        nombre: '',
        telefono: '',
        whatsapp: '',
        documento: '',
        placa: '',
        foto: '' as string,
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/conductor/registro/${token}`);
                const data = await res.json();
                if (cancelled) return;
                if (res.ok && data.valid) {
                    setStatus('valid');
                } else {
                    setError(data.error || 'Link no válido');
                    setStatus('invalid');
                }
            } catch {
                if (!cancelled) {
                    setError('No se pudo validar el link');
                    setStatus('invalid');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [token]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`/api/conductor/registro/${token}/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) setForm((prev) => ({ ...prev, foto: data.url }));
            else alert(data.error || 'Error al subir la foto');
        } catch {
            alert('Error al subir la foto');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('submitting');
        try {
            const res = await fetch(`/api/conductor/registro/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('done');
            } else {
                alert(data.error || 'Error al registrar');
                setStatus('valid');
            }
        } catch {
            alert('Error de conexión');
            setStatus('valid');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
                <FiLoader className="animate-spin text-3xl text-[#D6A75D]" />
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
                <div className="max-w-md w-full bg-neutral-900 border border-red-900/40 rounded-2xl p-8 text-center">
                    <FiAlertTriangle className="mx-auto text-4xl text-red-400 mb-3" />
                    <h1 className="text-xl font-bold text-white mb-2">Link no disponible</h1>
                    <p className="text-sm text-neutral-400">{error}</p>
                    <p className="text-xs text-neutral-500 mt-4">Por favor solicita un nuevo link al administrador.</p>
                </div>
            </div>
        );
    }

    if (status === 'done') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
                <div className="max-w-md w-full bg-neutral-900 border border-[#D6A75D]/30 rounded-2xl p-8 text-center">
                    <FiCheckCircle className="mx-auto text-4xl text-[#D6A75D] mb-3" />
                    <h1 className="text-xl font-bold text-white mb-2">¡Registro exitoso!</h1>
                    <p className="text-sm text-neutral-300">Tus datos han sido enviados a Transportes Medellín Travel.</p>
                    <p className="text-xs text-neutral-500 mt-4">Ya puedes cerrar esta ventana.</p>
                </div>
            </div>
        );
    }

    const disabled = status === 'submitting';

    return (
        <div className="min-h-screen bg-[#0A0A0A] py-10 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Registro de Conductor</h1>
                    <p className="text-sm text-neutral-400 mt-2">Completa tus datos para sumarte al equipo.</p>
                </div>

                <form onSubmit={submit} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 space-y-5">
                    <Field label="Nombre completo" required>
                        <input
                            type="text"
                            required
                            value={form.nombre}
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                            className={inputCls}
                            placeholder="Carlos González"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Teléfono" required>
                            <input
                                type="tel"
                                required
                                value={form.telefono}
                                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                className={inputCls}
                                placeholder="+57 300 123 4567"
                            />
                        </Field>
                        <Field label="WhatsApp" required>
                            <input
                                type="tel"
                                required
                                value={form.whatsapp}
                                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                                className={inputCls}
                                placeholder="+57 300 123 4567"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Documento" required>
                            <input
                                type="text"
                                required
                                value={form.documento}
                                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                                className={inputCls}
                                placeholder="1234567890"
                            />
                        </Field>
                        <Field label="Placa del vehículo" required>
                            <input
                                type="text"
                                required
                                value={form.placa}
                                onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                                className={`${inputCls} font-mono`}
                                placeholder="ABC123"
                            />
                        </Field>
                    </div>

                    <Field label="Foto (opcional)">
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden border border-neutral-700 bg-neutral-800 flex items-center justify-center flex-shrink-0">
                                {form.foto ? (
                                    <Image src={form.foto} alt="Foto" width={80} height={80} className="object-cover w-full h-full" unoptimized />
                                ) : (
                                    <FiCamera className="text-neutral-500 text-xl" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    disabled={uploadingPhoto}
                                    className="block w-full text-xs text-neutral-400
                                      file:mr-3 file:py-2 file:px-3
                                      file:rounded file:border file:border-neutral-700
                                      file:text-xs file:font-medium file:bg-neutral-800 file:text-neutral-200
                                      hover:file:bg-neutral-700 file:cursor-pointer cursor-pointer"
                                />
                                {uploadingPhoto && <p className="text-xs text-neutral-500 mt-1.5">Subiendo...</p>}
                            </div>
                        </div>
                    </Field>

                    <button
                        type="submit"
                        disabled={disabled || uploadingPhoto}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#D6A75D] hover:bg-[#c49450] text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                        {disabled ? <FiLoader className="animate-spin" /> : null}
                        {disabled ? 'Enviando...' : 'Enviar registro'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const inputCls =
    'w-full px-3 py-2.5 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] outline-none';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                {label} {required && <span className="text-[#D6A75D]">*</span>}
            </label>
            {children}
        </div>
    );
}
