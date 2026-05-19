'use client';

import { Municipio } from '@prisma/client';

interface MunicipalityPrice {
    municipio: Municipio;
    valorExtra: number;
}

interface MunicipalityPricingEditorProps {
    tarifas: MunicipalityPrice[];
    onChange: (tarifas: MunicipalityPrice[]) => void;
}

const MUNICIPIOS = [
    { value: 'ENVIGADO' as Municipio, label: 'Envigado' },
    { value: 'SABANETA' as Municipio, label: 'Sabaneta' },
    { value: 'ITAGUI' as Municipio, label: 'Itagüí' },
    { value: 'BELLO' as Municipio, label: 'Bello' },
    { value: 'MEDELLIN' as Municipio, label: 'Medellín' },
];

export default function MunicipalityPricingEditor({ tarifas, onChange }: MunicipalityPricingEditorProps) {
    const handlePriceChange = (municipio: Municipio, valor: number) => {
        const existing = tarifas.find(t => t.municipio === municipio);

        if (existing) {
            // Update existing
            onChange(tarifas.map(t =>
                t.municipio === municipio ? { ...t, valorExtra: valor } : t
            ));
        } else {
            // Add new
            onChange([...tarifas, { municipio, valorExtra: valor }]);
        }
    };

    const getPriceForMunicipio = (municipio: Municipio): number => {
        return tarifas.find(t => t.municipio === municipio)?.valorExtra || 0;
    };

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>ℹ️ Información:</strong> Estas tarifas adicionales se aplicarán solo a usuarios regulares (sin código de aliado).
                    Los aliados tienen sus propias tarifas configuradas en su perfil.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MUNICIPIOS.map((municipio) => (
                    <div key={municipio.value} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {municipio.label}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                                type="number"
                                value={getPriceForMunicipio(municipio.value)}
                                onChange={(e) => handlePriceChange(municipio.value, Number(e.target.value))}
                                min="0"
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D6A75D] focus:border-transparent"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Valor adicional (COP)
                        </p>
                    </div>
                ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Resumen de Tarifas</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {MUNICIPIOS.map((municipio) => {
                        const precio = getPriceForMunicipio(municipio.value);
                        return (
                            <div key={municipio.value} className="flex justify-between">
                                <span className="text-gray-600">{municipio.label}:</span>
                                <span className={`font-semibold ${precio > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    ${precio.toLocaleString('es-CO')}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
