'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { FiPlus, FiTrash2, FiEdit2, FiX } from 'react-icons/fi';

export interface FormField {
    id: string;
    key: string;
    label: string;
    tipo: 'text' | 'number' | 'switch' | 'counter' | 'select';
    requerido: boolean;
    precio?: number; // Para switch (precio fijo)
    precioUnitario?: number; // Para counter (precio por unidad)
    min?: number; // Para counter
    max?: number; // Para counter
    opciones?: { value: string; label: string }[]; // Para select
    placeholder?: string;
}

interface FormBuilderProps {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
}

export default function FormBuilder({ fields, onChange }: FormBuilderProps) {
    const [editingField, setEditingField] = useState<FormField | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const handleAddField = () => {
        const newField: FormField = {
            id: generateId(),
            key: '',
            label: '',
            tipo: 'text',
            requerido: false,
        };
        setEditingField(newField);
        setIsModalOpen(true);
    };

    const handleEditField = (field: FormField) => {
        setEditingField({ ...field });
        setIsModalOpen(true);
    };

    const handleSaveField = (field: FormField) => {
        if (!field.key || !field.label) {
            alert('El key y el label son requeridos');
            return;
        }

        // Validar que el key sea único
        const keyExists = fields.some(f => f.key === field.key && f.id !== field.id);
        if (keyExists) {
            alert('El key ya existe. Debe ser único.');
            return;
        }

        const updatedFields = editingField && fields.find(f => f.id === editingField.id)
            ? fields.map(f => f.id === editingField.id ? field : f)
            : [...fields, field];

        onChange(updatedFields);
        setIsModalOpen(false);
        setEditingField(null);
    };

    const handleDeleteField = (id: string) => {
        if (confirm('¿Estás seguro de eliminar este campo?')) {
            onChange(fields.filter(f => f.id !== id));
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingField(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Campos Personalizados</h3>
                    <p className="text-sm text-gray-600">
                        Define los campos únicos que este servicio necesita
                    </p>
                </div>
                <Button onClick={handleAddField} size="sm">
                    <FiPlus className="mr-2" />
                    Agregar Campo
                </Button>
            </div>

            {fields.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-gray-500 mb-4">No hay campos personalizados</p>
                    <Button onClick={handleAddField} variant="outline">
                        Agregar Primer Campo
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {fields.map((field) => (
                        <div
                            key={field.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="font-medium text-gray-900">{field.label}</span>
                                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                                        {field.tipo}
                                    </span>
                                    {field.requerido && (
                                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                            Requerido
                                        </span>
                                    )}
                                    {field.tipo === 'switch' && field.precio && (
                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                            +${field.precio.toLocaleString()}
                                        </span>
                                    )}
                                    {field.tipo === 'counter' && field.precioUnitario && (
                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                            ${field.precioUnitario.toLocaleString()}/unidad
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Key: {field.key}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditField(field)}
                                >
                                    <FiEdit2 size={16} />
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteField(field.id)}
                                >
                                    <FiTrash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para editar/crear campo */}
            {isModalOpen && editingField && (
                <FieldEditorModal
                    field={editingField}
                    onSave={handleSaveField}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
}

interface FieldEditorModalProps {
    field: FormField;
    onSave: (field: FormField) => void;
    onClose: () => void;
}

function FieldEditorModal({ field, onSave, onClose }: FieldEditorModalProps) {
    const [formData, setFormData] = useState<FormField>(field);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <h3 className="text-xl font-bold">Configurar Campo</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Key (identificador único) */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Key (Identificador único) *</label>
                        <Input
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                            placeholder="numero_vuelo"
                            required
                            className="w-full"
                        />
                        <p className="text-xs text-gray-500">Solo letras, números y guiones bajos. Se usa internamente.</p>
                    </div>

                    {/* Label (etiqueta visible) */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Etiqueta (Texto visible) *</label>
                        <Input
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder="Número de Vuelo"
                            required
                            className="w-full"
                        />
                    </div>

                    {/* Tipo de campo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipo de Campo *
                        </label>
                        <select
                            value={formData.tipo}
                            onChange={(e) => {
                                const newTipo = e.target.value as FormField['tipo'];
                                setFormData({
                                    ...formData,
                                    tipo: newTipo,
                                    // Limpiar campos específicos cuando cambia el tipo
                                    precio: newTipo === 'switch' ? formData.precio : undefined,
                                    precioUnitario: newTipo === 'counter' ? formData.precioUnitario : undefined,
                                    opciones: newTipo === 'select' ? formData.opciones || [] : undefined,
                                });
                            }}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#D6A75D] focus:ring-2 focus:ring-[#D6A75D] focus:ring-offset-1"
                            required
                        >
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="switch">Switch (Sí/No)</option>
                            <option value="counter">Contador (Cantidad)</option>
                            <option value="select">Selección (Dropdown)</option>
                        </select>
                    </div>

                    {/* Placeholder */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Placeholder (Opcional)</label>
                        <Input
                            value={formData.placeholder || ''}
                            onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                            placeholder="Ej: AV123"
                            className="w-full"
                        />
                    </div>

                    {/* Requerido */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="requerido"
                            checked={formData.requerido}
                            onChange={(e) => setFormData({ ...formData, requerido: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-[#D6A75D] focus:ring-[#D6A75D]"
                        />
                        <label htmlFor="requerido" className="text-sm font-medium text-gray-700">
                            Campo requerido
                        </label>
                    </div>

                    {/* Precio para Switch */}
                    {formData.tipo === 'switch' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ¿Afecta el precio?
                            </label>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="tienePrecio"
                                        checked={!!formData.precio}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, precio: 0 });
                                            } else {
                                                setFormData({ ...formData, precio: undefined });
                                            }
                                        }}
                                        className="w-5 h-5 rounded border-gray-300 text-[#D6A75D] focus:ring-[#D6A75D]"
                                    />
                                    <label htmlFor="tienePrecio" className="text-sm text-gray-700">
                                        Sí, suma un precio fijo cuando está activado
                                    </label>
                                </div>
                                {formData.precio !== undefined && (
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-gray-700">Precio Fijo (COP)</label>
                                        <Input
                                            type="number"
                                            value={formData.precio}
                                            onChange={(e) => setFormData({ ...formData, precio: Number(e.target.value) })}
                                            placeholder="30000"
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Precio Unitario para Counter */}
                    {formData.tipo === 'counter' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ¿Afecta el precio?
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="tienePrecioUnitario"
                                        checked={!!formData.precioUnitario}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, precioUnitario: 0 });
                                            } else {
                                                setFormData({ ...formData, precioUnitario: undefined });
                                            }
                                        }}
                                        className="w-5 h-5 rounded border-gray-300 text-[#D6A75D] focus:ring-[#D6A75D]"
                                    />
                                    <label htmlFor="tienePrecioUnitario" className="text-sm text-gray-700">
                                        Sí, multiplica cantidad × precio unitario
                                    </label>
                                </div>
                            </div>
                            {formData.precioUnitario !== undefined && (
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Precio por Unidad (COP)</label>
                                    <Input
                                        type="number"
                                        value={formData.precioUnitario}
                                        onChange={(e) => setFormData({ ...formData, precioUnitario: Number(e.target.value) })}
                                        placeholder="20000"
                                        className="w-full"
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Mínimo</label>
                                    <Input
                                        type="number"
                                        value={formData.min || 0}
                                        onChange={(e) => setFormData({ ...formData, min: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Máximo</label>
                                    <Input
                                        type="number"
                                        value={formData.max || 10}
                                        onChange={(e) => setFormData({ ...formData, max: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Opciones para Select */}
                    {formData.tipo === 'select' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Opciones *
                            </label>
                            <SelectOptionsEditor
                                opciones={formData.opciones || []}
                                onChange={(opciones) => setFormData({ ...formData, opciones })}
                            />
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            Guardar Campo
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface SelectOptionsEditorProps {
    opciones: { value: string; label: string }[];
    onChange: (opciones: { value: string; label: string }[]) => void;
}

function SelectOptionsEditor({ opciones, onChange }: SelectOptionsEditorProps) {
    const addOption = () => {
        onChange([...opciones, { value: '', label: '' }]);
    };

    const updateOption = (index: number, field: 'value' | 'label', value: string) => {
        const updated = [...opciones];
        updated[index][field] = value;
        onChange(updated);
    };

    const removeOption = (index: number) => {
        onChange(opciones.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            {opciones.map((opcion, index) => (
                <div key={index} className="flex gap-2 items-center">
                    <Input
                        value={opcion.value}
                        onChange={(e) => updateOption(index, 'value', e.target.value)}
                        placeholder="valor"
                        className="flex-1"
                    />
                    <Input
                        value={opcion.label}
                        onChange={(e) => updateOption(index, 'label', e.target.value)}
                        placeholder="Etiqueta visible"
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeOption(index)}
                    >
                        <FiTrash2 size={16} />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" onClick={addOption} size="sm">
                <FiPlus className="mr-2" />
                Agregar Opción
            </Button>
        </div>
    );
}

