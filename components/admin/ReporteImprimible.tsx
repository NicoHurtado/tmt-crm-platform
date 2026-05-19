import React, { forwardRef } from 'react'; // 1. Importar forwardRef
import { getLocalizedText } from '@/types/multi-language';
import { getStateLabel } from '@/lib/state-transitions';

interface ReporteProps {
    data: any[];
    viewMode: 'nueva' | 'antigua';
    filtros: {
        desde: string;
        hasta: string;
        busqueda: string;
    };
}

// 2. Envolver el componente en forwardRef<HTMLDivElement, ReporteProps>
export const ReporteImprimible = forwardRef<HTMLDivElement, ReporteProps>((props, ref) => {
    const { data, viewMode, filtros } = props;
    const fechaImpresion = new Date().toLocaleString('es-CO');

    // Cálculos de totales
    const totalDinero = data.reduce((sum, r) => sum + (Number(r.precioTotal) || 0), 0);
    const totalComision = data.reduce((sum, r) => sum + (Number(r.comisionAliado) || 0), 0);

    return (
        // 3. ASIGNAR LA REF AQUÍ. Si esto falta, react-to-print no encuentra qué imprimir.
        <div ref={ref} className="p-8 bg-white text-black print-container">

            {/* Cabecera */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-wide">Transportes Medellín Travel</h1>
                        <p className="text-sm text-gray-600 mt-1">Reporte de Base de Datos ({viewMode === 'nueva' ? 'Registros Actuales' : 'Histórico'})</p>
                    </div>
                    <div className="text-right text-xs">
                        <p><strong>Generado:</strong> {fechaImpresion}</p>
                        <p><strong>Registros:</strong> {data.length}</p>
                    </div>
                </div>
                <div className="mt-4 text-xs text-gray-500 flex gap-4">
                    {filtros.desde && <span>Desde: {filtros.desde}</span>}
                    {filtros.hasta && <span>Hasta: {filtros.hasta}</span>}
                    {filtros.busqueda && <span>Búsqueda: &quot;{filtros.busqueda}&quot;</span>}
                </div>
            </div>

            {/* Tabla */}
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-100 border-b border-gray-400">
                        {viewMode === 'nueva' ? (
                            <>
                                <th className="p-2 text-left font-bold">CÓDIGO</th>
                                <th className="p-2 text-left font-bold">CLIENTE</th>
                                <th className="p-2 text-left font-bold">SERVICIO</th>
                                <th className="p-2 text-left font-bold">FECHA</th>
                                <th className="p-2 text-left font-bold">ESTADO</th>
                                <th className="p-2 text-left font-bold">ALIADO</th>
                                <th className="p-2 text-right font-bold">TOTAL</th>
                            </>
                        ) : (
                            <>
                                <th className="p-2 text-left font-bold">CANAL</th>
                                <th className="p-2 text-left font-bold">NOMBRE</th>
                                <th className="p-2 text-left font-bold">SERVICIO</th>
                                <th className="p-2 text-left font-bold">FECHA</th>
                                <th className="p-2 text-left font-bold">COTIZACIÓN</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200">
                            {viewMode === 'nueva' ? (
                                <>
                                    <td className="p-2 font-mono">{row.codigo}</td>
                                    <td className="p-2">{row.nombreCliente}</td>
                                    <td className="p-2">{row.servicio?.nombre ? getLocalizedText(row.servicio.nombre, 'ES') : '-'}</td>
                                    <td className="p-2">{new Date(row.fecha).toLocaleDateString('es-CO')}</td>
                                    <td className="p-2">{getStateLabel(row.estado)}</td>
                                    <td className="p-2">{row.aliado?.nombre || 'Indep.'}</td>
                                    <td className="p-2 text-right font-medium">${Number(row.precioTotal).toLocaleString('es-CO')}</td>
                                </>
                            ) : (
                                <>
                                    <td className="p-2">{row.canal}</td>
                                    <td className="p-2">{row.nombre}</td>
                                    <td className="p-2">{row.servicio}</td>
                                    <td className="p-2">{row.fecha ? new Date(row.fecha).toLocaleDateString('es-CO') : '-'}</td>
                                    <td className="p-2">{row.cotizacion}</td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totales */}
            <div className="mt-8 pt-4 border-t-2 border-gray-800 flex justify-end gap-8">
                {viewMode === 'nueva' && (
                    <div className="text-right">
                        <p className="text-xs text-gray-500">COMISIONES ALIADOS</p>
                        <p className="text-lg font-bold text-gray-700">${totalComision.toLocaleString('es-CO')}</p>
                    </div>
                )}
                <div className="text-right">
                    <p className="text-xs text-gray-500">TOTAL GENERAL</p>
                    <p className="text-xl font-bold text-black">${totalDinero.toLocaleString('es-CO')}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 15mm; size: auto; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
});

ReporteImprimible.displayName = 'ReporteImprimible';
