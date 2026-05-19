'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DynamicField, SelectOption, createTextField, createCounterField, createSwitchField, createSelectField } from '@/types/dynamic-fields';
import { FiPlus, FiTrash2, FiMenu, FiEdit2, FiEye } from 'react-icons/fi';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DynamicFieldBuilderProps {
    fields: DynamicField[];
    onChange: (fields: DynamicField[]) => void;
    language?: 'es' | 'en';
}

export default function DynamicFieldBuilder({ fields, onChange, language = 'es' }: DynamicFieldBuilderProps) {
    const [isAddingField, setIsAddingField] = useState(false);
    const [editingField, setEditingField] = useState<{ index: number; field: DynamicField } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = fields.findIndex((f) => f.clave === active.id);
            const newIndex = fields.findIndex((f) => f.clave === over.id);

            const reordered = arrayMove(fields, oldIndex, newIndex);
            // Update orden values
            const updated = reordered.map((field, index) => ({ ...field, orden: index }));
            onChange(updated);
        }
    };

    const addField = (newField: DynamicField) => {
        onChange([...fields, { ...newField, orden: fields.length }]);
        setIsAddingField(false);
    };

    const updateField = (index: number, updatedField: DynamicField) => {
        const updated = [...fields];
        updated[index] = updatedField;
        onChange(updated);
        setEditingField(null);
    };

    const deleteField = (index: number) => {
        const updated = fields.filter((_, i) => i !== index);
        // Reorder
        const reordered = updated.map((field, i) => ({ ...field, orden: i }));
        onChange(reordered);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Campos Dinámicos</h3>
                <button
                    type="button"
                    onClick={() => setIsAddingField(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#D6A75D] text-black rounded-lg hover:bg-[#C5964A] transition-colors"
                >
                    <FiPlus /> Agregar Campo
                </button>
            </div>

            {fields.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    No hay campos dinámicos. Haz clic en &quot;Agregar Campo&quot; para comenzar.
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fields.map((f) => f.clave)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {fields.map((field, index) => (
                                <SortableFieldItem
                                    key={field.clave}
                                    field={field}
                                    index={index}
                                    onEdit={() => setEditingField({ index, field })}
                                    onDelete={() => deleteField(index)}
                                    language={language}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Add Field Modal */}
            {isAddingField && (
                <FieldEditorModal
                    onSave={addField}
                    onClose={() => setIsAddingField(false)}
                    language={language}
                />
            )}

            {/* Edit Field Modal */}
            {editingField && (
                <FieldEditorModal
                    field={editingField.field}
                    onSave={(field) => updateField(editingField.index, field)}
                    onClose={() => setEditingField(null)}
                    language={language}
                />
            )}
        </div>
    );
}

// Sortable Field Item Component
function SortableFieldItem({
    field,
    index,
    onEdit,
    onDelete,
    language,
}: {
    field: DynamicField;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    language: 'es' | 'en';
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.clave });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const getFieldTypeLabel = (tipo: string) => {
        const labels: Record<string, string> = {
            TEXT: 'Texto',
            TEXTAREA: 'Área de Texto',
            SELECT: 'Selección',
            SWITCH: 'Sí/No',
            COUNTER: 'Contador',
        };
        return labels[tipo] || tipo;
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                    <FiMenu size={20} />
                </button>

                {/* Field Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">{field.etiqueta[language]}</span>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{getFieldTypeLabel(field.tipo)}</span>
                        {field.requerido && <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Requerido</span>}
                        {field.tienePrecio && (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                ${field.precioUnitario?.toLocaleString('es-CO')}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Clave: {field.clave}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onEdit} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <FiEdit2 />
                    </button>
                    <button type="button" onClick={onDelete} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors">
                        <FiTrash2 />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Metadata por tipo de campo ───────────────────────────────────────────────
const TIPO_INFO: Record<string, { label: string; descripcion: string; ejemploClave: string; ejemploEtiquetaEs: string; ejemploEtiquetaEn: string }> = {
    TEXT: {
        label: 'Texto corto',
        descripcion: 'Una línea de texto libre. Ideal para número de vuelo, nombre de hotel, número de documento, etc.',
        ejemploClave: 'numeroVuelo',
        ejemploEtiquetaEs: 'Número de vuelo',
        ejemploEtiquetaEn: 'Flight number',
    },
    TEXTAREA: {
        label: 'Texto largo',
        descripcion: 'Varias líneas de texto. Ideal para instrucciones especiales, observaciones o peticiones del cliente.',
        ejemploClave: 'instruccionesEspeciales',
        ejemploEtiquetaEs: 'Instrucciones especiales',
        ejemploEtiquetaEn: 'Special instructions',
    },
    SELECT: {
        label: 'Lista de opciones',
        descripcion: 'El cliente elige una opción de una lista desplegable. Ideal para idioma del guía, nivel de dificultad, etc.',
        ejemploClave: 'idiomaGuia',
        ejemploEtiquetaEs: 'Idioma del guía',
        ejemploEtiquetaEn: 'Guide language',
    },
    SWITCH: {
        label: 'Sí / No',
        descripcion: 'Activar o desactivar algo. Puede tener un precio extra que se cobra si el cliente lo activa. Ideal para vuelta en bote, guía certificado, seguro adicional, etc.',
        ejemploClave: 'vueltaBote',
        ejemploEtiquetaEs: 'Vuelta en bote',
        ejemploEtiquetaEn: 'Boat ride',
    },
    COUNTER: {
        label: 'Contador numérico',
        descripcion: 'El cliente elige una cantidad (0, 1, 2, 3…). Puede tener precio por unidad que se multiplica por la cantidad elegida. Ideal para almuerzos, motos, sillas adicionales, etc.',
        ejemploClave: 'cantidadAlmuerzos',
        ejemploEtiquetaEs: 'Almuerzos incluidos',
        ejemploEtiquetaEn: 'Included lunches',
    },
};

// Field Editor Modal Component
function FieldEditorModal({
    field,
    onSave,
    onClose,
    language,
}: {
    field?: DynamicField;
    onSave: (field: DynamicField) => void;
    onClose: () => void;
    language: 'es' | 'en';
}) {
    const [tipo, setTipo] = useState<'TEXT' | 'TEXTAREA' | 'SELECT' | 'SWITCH' | 'COUNTER'>(field?.tipo || 'TEXT');
    const [clave, setClave] = useState(field?.clave || '');
    const [etiquetaEs, setEtiquetaEs] = useState(field?.etiqueta.es || '');
    const [etiquetaEn, setEtiquetaEn] = useState(field?.etiqueta.en || '');
    const [ayudaEs, setAyudaEs] = useState(field?.ayuda?.es || '');
    const [ayudaEn, setAyudaEn] = useState(field?.ayuda?.en || '');
    const [requerido, setRequerido] = useState(field?.requerido || false);
    const [tienePrecio, setTienePrecio] = useState(field?.tienePrecio || false);
    const [precioUnitario, setPrecioUnitario] = useState(field?.precioUnitario || 0);
    const [placeholderEs, setPlaceholderEs] = useState(field?.placeholder?.es || '');
    const [placeholderEn, setPlaceholderEn] = useState(field?.placeholder?.en || '');
    const [counterMin, setCounterMin] = useState(field?.tipo === 'COUNTER' ? (field as any).min ?? 0 : 0);
    const [counterMax, setCounterMax] = useState<number | ''>(field?.tipo === 'COUNTER' ? (field as any).max ?? '' : '');
    const [opciones, setOpciones] = useState<SelectOption[]>(
        field && field.tipo === 'SELECT' && 'opciones' in field ? field.opciones : []
    );

    const tipoInfo = TIPO_INFO[tipo];

    // Auto-suggest clave when etiquetaEs changes (only when creating new)
    const handleEtiquetaEsChange = (value: string) => {
        setEtiquetaEs(value);
        if (!field) {
            const suggested = value
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
                .replace(/[^a-zA-Z0-9_]/g, '')
                .replace(/^./, (c) => c.toLowerCase());
            setClave(suggested);
        }
    };

    const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] outline-none";
    const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide";

    const handleSave = () => {
        if (!etiquetaEs || !etiquetaEn) {
            alert('Por favor completa el nombre del campo en español e inglés');
            return;
        }
        if (!clave) {
            alert('Escribe el nombre en español primero para generar el ID automáticamente');
            return;
        }

        const base = {
            clave,
            etiqueta: { es: etiquetaEs, en: etiquetaEn },
            requerido,
            orden: field?.orden || 0,
            ...(ayudaEs || ayudaEn ? { ayuda: { es: ayudaEs, en: ayudaEn } } : {}),
        };

        let newField: DynamicField;

        switch (tipo) {
            case 'TEXT':
            case 'TEXTAREA':
                newField = {
                    ...base,
                    tipo,
                    tienePrecio: false,
                    ...(placeholderEs || placeholderEn ? { placeholder: { es: placeholderEs, en: placeholderEn } } : {}),
                } as DynamicField;
                break;

            case 'COUNTER':
                newField = {
                    ...base,
                    tipo: 'COUNTER',
                    min: counterMin,
                    ...(counterMax !== '' ? { max: counterMax } : {}),
                    step: 1,
                    tienePrecio,
                    precioUnitario: tienePrecio ? precioUnitario : undefined,
                };
                break;

            case 'SWITCH':
                newField = {
                    ...base,
                    tipo: 'SWITCH',
                    tienePrecio,
                    precioUnitario: tienePrecio ? precioUnitario : undefined,
                };
                break;

            case 'SELECT':
                if (opciones.length === 0) {
                    alert('Debes agregar al menos una opción');
                    return;
                }
                newField = {
                    ...base,
                    tipo: 'SELECT',
                    opciones,
                    tienePrecio: false,
                };
                break;

            default:
                return;
        }

        onSave(newField);
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">{field ? 'Editar Campo' : 'Nuevo Campo'}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Configura cómo aparecerá este campo en el formulario de reserva</p>
                </div>

                <div className="p-6 space-y-6">

                    {/* ── TIPO ── */}
                    <div>
                        <label className={labelClass}>Tipo de campo *</label>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(TIPO_INFO).map(([key, info]) => (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={!!field}
                                    onClick={() => setTipo(key as any)}
                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                        tipo === key
                                            ? 'border-[#D6A75D] bg-[#D6A75D]/8'
                                            : field
                                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-gray-900">{info.label}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{info.descripcion}</p>
                                    </div>
                                    {tipo === key && (
                                        <span className="ml-auto text-[#D6A75D] text-xs font-bold flex-shrink-0">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {field && (
                            <p className="text-xs text-amber-600 mt-2">El tipo no se puede cambiar después de crear el campo.</p>
                        )}
                    </div>

                    {/* ── NOMBRE DEL CAMPO ── */}
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                        <p className={labelClass}>Nombre del campo — lo que ve el cliente</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Español *</label>
                                <input
                                    type="text"
                                    value={etiquetaEs}
                                    onChange={(e) => handleEtiquetaEsChange(e.target.value)}
                                    placeholder={`ej: ${tipoInfo.ejemploEtiquetaEs}`}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">English *</label>
                                <input
                                    type="text"
                                    value={etiquetaEn}
                                    onChange={(e) => setEtiquetaEn(e.target.value)}
                                    placeholder={`eg: ${tipoInfo.ejemploEtiquetaEn}`}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {/* Texto de ayuda */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">
                                    Texto de ayuda ES <span className="text-gray-400">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={ayudaEs}
                                    onChange={(e) => setAyudaEs(e.target.value)}
                                    placeholder="ej: Aparece en tu tiquete de avión"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">
                                    Help text EN <span className="text-gray-400">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={ayudaEn}
                                    onChange={(e) => setAyudaEn(e.target.value)}
                                    placeholder="eg: Found on your airline ticket"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">El texto de ayuda aparece debajo del campo en el formulario como una pista para el cliente.</p>
                    </div>

                    {/* ── CLAVE INTERNA (solo referencia, se genera automáticamente) ── */}
                    {clave && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>ID interno:</span>
                            <code className="px-2 py-0.5 bg-gray-100 rounded font-mono text-gray-500">{clave}</code>
                            {!field && (
                                <span className="text-gray-400">(generado automáticamente)</span>
                            )}
                        </div>
                    )}

                    {/* ── PLACEHOLDER (TEXT / TEXTAREA) ── */}
                    {(tipo === 'TEXT' || tipo === 'TEXTAREA') && (
                        <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                            <p className={labelClass}>Texto de ejemplo dentro del campo <span className="normal-case font-normal text-gray-400">(placeholder)</span></p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Español</label>
                                    <input type="text" value={placeholderEs} onChange={(e) => setPlaceholderEs(e.target.value)}
                                        placeholder="ej: Ej: AV 0123" className={inputClass} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">English</label>
                                    <input type="text" value={placeholderEn} onChange={(e) => setPlaceholderEn(e.target.value)}
                                        placeholder="eg: Ex: AV 0123" className={inputClass} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── CONTADOR: min / max ── */}
                    {tipo === 'COUNTER' && (
                        <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                            <p className={labelClass}>Límites del contador</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
                                    <input type="number" value={counterMin} min={0}
                                        onChange={(e) => setCounterMin(Number(e.target.value))}
                                        className={inputClass} />
                                    <p className="text-xs text-gray-400 mt-1">Cantidad mínima que puede elegir el cliente (normalmente 0)</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Máximo <span className="text-gray-400">(opcional)</span></label>
                                    <input type="number" value={counterMax} min={1}
                                        onChange={(e) => setCounterMax(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Sin límite"
                                        className={inputClass} />
                                    <p className="text-xs text-gray-400 mt-1">Deja vacío si no hay límite</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PRECIO (COUNTER y SWITCH) ── */}
                    {(tipo === 'COUNTER' || tipo === 'SWITCH') && (
                        <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                            <p className={labelClass}>Precio adicional</p>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" id="tienePrecio" checked={tienePrecio}
                                    onChange={(e) => setTienePrecio(e.target.checked)}
                                    className="w-4 h-4 text-[#D6A75D] border-gray-300 rounded focus:ring-[#D6A75D]" />
                                <span className="text-sm font-medium text-gray-700">Este campo tiene un costo adicional</span>
                            </label>
                            {tienePrecio && (
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">
                                        Precio unitario (COP) —{' '}
                                        {tipo === 'COUNTER'
                                            ? 'se multiplica por la cantidad elegida'
                                            : 'se cobra si el cliente lo activa'}
                                    </label>
                                    <input type="number" value={precioUnitario} min={0} step={1000}
                                        onChange={(e) => setPrecioUnitario(Number(e.target.value))}
                                        placeholder="ej: 25000"
                                        className={inputClass} />
                                    <p className="text-xs text-amber-600 mt-1">
                                        {tipo === 'COUNTER'
                                            ? `Ej: si el cliente elige 3, se suma ${precioUnitario > 0 ? `$${(precioUnitario * 3).toLocaleString('es-CO')}` : '$0'} al total`
                                            : `Ej: si activa la opción, se suma $${precioUnitario > 0 ? precioUnitario.toLocaleString('es-CO') : '0'} al total`}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── OPCIONES (SELECT) ── */}
                    {tipo === 'SELECT' && (
                        <div>
                            <label className={labelClass}>Opciones de la lista</label>
                            <p className="text-xs text-gray-400 mb-3">El cliente podrá elegir una de estas opciones. El "Valor interno" se guarda en la reserva; el "Texto" es lo que ve el cliente.</p>
                            <SelectOptionsBuilder opciones={opciones} onChange={setOpciones} />
                        </div>
                    )}

                    {/* ── REQUERIDO ── */}
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                        <input type="checkbox" id="requerido" checked={requerido}
                            onChange={(e) => setRequerido(e.target.checked)}
                            className="w-4 h-4 text-[#D6A75D] border-gray-300 rounded focus:ring-[#D6A75D] mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-gray-700">Campo obligatorio</p>
                            <p className="text-xs text-gray-400">El cliente no podrá avanzar en la reserva sin llenar este campo</p>
                        </div>
                    </label>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                    <button type="button" onClick={onClose}
                        className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSave}
                        className="px-5 py-2.5 bg-[#D6A75D] text-black rounded-lg text-sm font-semibold hover:bg-[#C5964A] transition-colors">
                        {field ? 'Guardar cambios' : 'Agregar campo'}
                    </button>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

// Select Options Builder Component
function SelectOptionsBuilder({
    opciones,
    onChange,
}: {
    opciones: SelectOption[];
    onChange: (opciones: SelectOption[]) => void;
}) {
    const addOption = () => {
        onChange([
            ...opciones,
            {
                valor: '',
                etiqueta: { es: '', en: '' },
            },
        ]);
    };

    const updateOption = (index: number, field: keyof SelectOption, value: any) => {
        const updated = [...opciones];
        if (field === 'etiqueta') {
            updated[index] = { ...updated[index], etiqueta: value };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }
        onChange(updated);
    };

    const deleteOption = (index: number) => {
        onChange(opciones.filter((_, i) => i !== index));
    };

    const inputSm = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D6A75D]/40 focus:border-[#D6A75D] outline-none";

    return (
        <div className="space-y-3">
            {opciones.length > 0 && (
                <div className="grid grid-cols-3 gap-2 px-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor interno</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Texto español</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text English</p>
                </div>
            )}
            {opciones.map((opcion, index) => (
                <div key={index} className="flex gap-2 items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                        <div>
                            <input
                                type="text"
                                value={opcion.valor}
                                onChange={(e) => updateOption(index, 'valor', e.target.value.replace(/\s/g, '_').toLowerCase())}
                                placeholder="ej: espanol"
                                className={`${inputSm} font-mono`}
                            />
                            <p className="text-xs text-gray-400 mt-0.5">Se guarda en la reserva</p>
                        </div>
                        <input
                            type="text"
                            value={opcion.etiqueta.es}
                            onChange={(e) => updateOption(index, 'etiqueta', { ...opcion.etiqueta, es: e.target.value })}
                            placeholder="ej: Español"
                            className={inputSm}
                        />
                        <input
                            type="text"
                            value={opcion.etiqueta.en}
                            onChange={(e) => updateOption(index, 'etiqueta', { ...opcion.etiqueta, en: e.target.value })}
                            placeholder="eg: Spanish"
                            className={inputSm}
                        />
                    </div>
                    <button type="button" onClick={() => deleteOption(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <FiTrash2 size={16} />
                    </button>
                </div>
            ))}

            <button type="button" onClick={addOption}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#D6A75D] hover:text-[#D6A75D] transition-colors">
                + Agregar opción
            </button>
        </div>
    );
}
