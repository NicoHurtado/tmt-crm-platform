'use client';

import { useState } from 'react';
import { FiUpload, FiX, FiImage } from 'react-icons/fi';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    label?: string;
}

export default function ImageUpload({ value, onChange, label = 'Imagen' }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(value || '');
    const [error, setError] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Solo se permiten archivos JPG, PNG y WebP');
            return;
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('El archivo es muy grande. Máximo 5MB');
            return;
        }

        setError('');
        setUploading(true);

        try {
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Upload file
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                onChange(data.url);
                setPreview(data.url);
            } else {
                setError(data.error || 'Error al subir la imagen');
                setPreview('');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            setError('Error al subir la imagen');
            setPreview('');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = () => {
        setPreview('');
        onChange('');
        setError('');
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {label}
            </label>

            {preview ? (
                <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                        <FiX size={16} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading}
                        />
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D6A75D]"></div>
                                <span className="text-sm text-gray-600">Subiendo...</span>
                            </>
                        ) : (
                            <>
                                <FiUpload className="text-gray-600" />
                                <span className="text-sm text-gray-600">Seleccionar imagen</span>
                            </>
                        )}
                    </label>
                    <FiImage className="text-gray-400" size={24} />
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}

            <p className="text-xs text-gray-500">
                Formatos: JPG, PNG, WebP. Máximo 5MB
            </p>
        </div>
    );
}
