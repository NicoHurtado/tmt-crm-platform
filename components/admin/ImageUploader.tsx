'use client';

import { useState, useRef } from 'react';
import { FiUpload, FiImage, FiX } from 'react-icons/fi';
import Image from 'next/image';

interface ImageUploaderProps {
    currentImageUrl?: string;
    onImageUploaded: (url: string) => void;
    label?: string;
}

export default function ImageUploader({ currentImageUrl, onImageUploaded, label = 'Imagen del Servicio' }: ImageUploaderProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || '');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setError('Solo se permiten archivos JPG, PNG y WEBP');
            return;
        }

        // Validar tamaño (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('El archivo es demasiado grande. Máximo 5MB');
            return;
        }

        setError('');
        setSelectedFile(file);

        // Crear preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('/api/upload/image', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al subir la imagen');
            }

            // Actualizar URL en el formulario padre
            onImageUploaded(data.url);
            setPreviewUrl(data.url);
            setSelectedFile(null);

        } catch (err: any) {
            setError(err.message || 'Error al subir la imagen');
        } finally {
            setUploading(false);
        }
    };

    const handleClear = () => {
        setSelectedFile(null);
        setPreviewUrl('');
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
                {label}
            </label>

            {/* File Input */}
            <div className="flex items-center gap-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="image-upload"
                />
                <label
                    htmlFor="image-upload"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                >
                    <FiImage />
                    Seleccionar Archivo
                </label>

                {selectedFile && (
                    <>
                        <button
                            type="button"
                            onClick={handleUpload}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-[#D6A75D] hover:bg-[#C5964A] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FiUpload />
                            {uploading ? 'Subiendo...' : 'Subir'}
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={uploading}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <FiX size={20} />
                        </button>
                    </>
                )}
            </div>

            {/* Selected File Info */}
            {selectedFile && (
                <div className="text-sm text-gray-600">
                    <p>Archivo seleccionado: <span className="font-medium">{selectedFile.name}</span></p>
                    <p>Tamaño: <span className="font-medium">{(selectedFile.size / 1024).toFixed(2)} KB</span></p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Preview */}
            {previewUrl && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Vista Previa:</p>
                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                            src={previewUrl}
                            alt="Preview"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
