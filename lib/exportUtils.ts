import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLocalizedText } from '@/types/multi-language';
import { getStateLabel } from '@/lib/state-transitions';

export const exportarReservasPDF = (data: any[], viewMode: 'nueva' | 'antigua', filtros: any) => {
    // 1. Crear documento (orientación horizontal para que quepan las columnas)
    const doc = new jsPDF({ orientation: 'landscape' });

    // 2. Definir Columnas y Filas según el modo
    let head = [];
    let body = [];

    if (viewMode === 'nueva') {
        head = [['CÓDIGO', 'CLIENTE', 'SERVICIO', 'FECHA', 'ESTADO', 'ALIADO', 'COMISIÓN', 'TOTAL']];
        body = data.map((row: any) => [
            row.codigo,
            row.nombreCliente,
            row.servicio?.nombre ? getLocalizedText(row.servicio.nombre, 'ES') : '-',
            new Date(row.fecha).toLocaleDateString('es-CO'),
            getStateLabel(row.estado),
            row.aliado?.nombre || 'Independiente',
            `$${(Number(row.comisionAliado) || 0).toLocaleString('es-CO')}`,
            `$${Number(row.precioTotal).toLocaleString('es-CO')}`
        ]);
    } else {
        head = [['CANAL', 'NOMBRE', 'SERVICIO', 'FECHA', 'COTIZACIÓN', 'ESTADO']];
        body = data.map((row: any) => [
            row.canal || '-',
            row.nombre,
            row.servicio,
            row.fecha ? new Date(row.fecha).toLocaleDateString('es-CO') : '-',
            row.cotizacion,
            row.estado_servicio || '-'
        ]);
    }

    // 3. Encabezado del Reporte (Logo y Títulos)
    const fechaImpresion = new Date().toLocaleString('es-CO');

    // Título Principal
    doc.setFontSize(18);
    doc.text('Transportes Medellín Travel', 14, 22);

    // Subtítulo
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Reporte de Base de Datos (${viewMode === 'nueva' ? 'Registros Actuales' : 'Histórico'})`, 14, 30);

    // Info Extra (Fecha y Filtros)
    doc.setFontSize(9);
    doc.text(`Generado: ${fechaImpresion}`, 230, 22);
    doc.text(`Total Registros: ${data.length}`, 230, 28);

    if (filtros.busqueda || filtros.desde || filtros.hasta) {
        let textoFiltros = 'Filtros: ';
        if (filtros.busqueda) textoFiltros += `Búsqueda: "${filtros.busqueda}" `;
        if (filtros.desde) textoFiltros += `Desde: ${filtros.desde} `;
        if (filtros.hasta) textoFiltros += `Hasta: ${filtros.hasta}`;
        doc.text(textoFiltros, 14, 38);
    }

    // 4. Generar la Tabla
    autoTable(doc, {
        head: head,
        body: body,
        startY: 45, // Donde empieza la tabla verticalmente
        theme: 'grid', // 'striped', 'grid', 'plain'
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [10, 10, 10], // Color Negro (Tu marca)
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            // Alinear columna de precios a la derecha (índice 6 y 7 en modo 'nueva')
            6: { halign: 'right', fontStyle: 'bold' },
            7: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245] // Gris muy claro para filas alternas
        },
        // Pie de página de la tabla (Totales)
        didDrawPage: (data) => {
            // Solo si es la última página, mostrar totales
            // (Lógica opcional, por simplicidad dejamos esto limpio)
        }
    });

    // 5. Agregar Total General al final
    if (viewMode === 'nueva') {
        const finalY = (doc as any).lastAutoTable.finalY + 10; // Posición Y después de la tabla
        const totalDinero = data.reduce((sum: number, r: any) => sum + (Number(r.precioTotal) || 0), 0);
        const totalComision = data.reduce((sum: number, r: any) => sum + (Number(r.comisionAliado) || 0), 0);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`TOTAL COMISIONES: $${totalComision.toLocaleString('es-CO')}`, 130, finalY);
        doc.text(`TOTAL GENERAL: $${totalDinero.toLocaleString('es-CO')}`, 220, finalY);
    }

    // 6. Descargar
    doc.save(`Reporte_Reservas_${new Date().toISOString().split('T')[0]}.pdf`);
};

import * as XLSX from 'xlsx';

export const exportarReservasExcel = (data: any[], viewMode: 'nueva' | 'antigua') => {
    let excelData = [];

    if (viewMode === 'nueva') {
        excelData = data.map((row: any) => ({
            'CÓDIGO': row.codigo,
            'CLIENTE': row.nombreCliente,
            'EMAIL': row.emailCliente,
            'WHATSAPP': row.whatsappCliente,
            'SERVICIO': row.servicio?.nombre ? getLocalizedText(row.servicio.nombre, 'ES') : '-',
            'FECHA': new Date(row.fecha).toLocaleDateString('es-CO'),
            'HORA': row.hora,
            'ESTADO': getStateLabel(row.estado),
            'ALIADO': row.aliado?.nombre || 'Independiente',
            'COMISIÓN': Number(row.comisionAliado) || 0,
            'TOTAL': Number(row.precioTotal) || 0,
            'NOTAS': row.notas || row.notasEspeciales || '' // Columna de Notas Adicionales
        }));
    } else {
        excelData = data.map((row: any) => ({
            'CANAL': row.canal || '-',
            'NOMBRE': row.nombre,
            'IDIOMA': row.idioma,
            'SERVICIO': row.servicio,
            'FECHA': row.fecha ? new Date(row.fecha).toLocaleDateString('es-CO') : '-',
            'HORA': row.hora ? new Date(row.hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-',
            'COTIZACIÓN': row.cotizacion,
            'ESTADO': row.estado_servicio || '-',
            'COMISIÓN': row.comision,
            'NOTAS': row.informacion_adicional || '' // Columna de Notas Adicionales
        }));
    }

    // Crear Workbook y Sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar ancho de columnas
    const colWidths = viewMode === 'nueva'
        ? [10, 20, 25, 15, 25, 12, 8, 15, 15, 12, 12, 40] // Anchos estimados
        : [15, 20, 8, 20, 12, 10, 12, 15, 12, 40];

    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');

    // Descargar
    XLSX.writeFile(wb, `Reporte_Reservas_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Exporta la lista de asistentes de Tour Compartido para una fecha específica
 * @param asistentes - Array de asistentes con sus datos
 * @param fecha - Fecha del tour para el nombre del archivo
 * @param servicioNombre - Nombre del servicio
 */
export const exportarAsistentesTourCompartido = (
    asistentes: Array<{
        nombre: string;
        tipoDocumento: string;
        numeroDocumento: string;
        reservaCodigo: string;
        clienteNombre: string;
    }>,
    fecha: string,
    servicioNombre: string
) => {
    // Mapear los tipos de documento a nombres legibles
    const tipoDocumentoLabels: Record<string, string> = {
        'CC': 'Cédula de Ciudadanía',
        'PASAPORTE': 'Pasaporte',
        'TI': 'Tarjeta de Identidad',
        'CE': 'Cédula de Extranjería'
    };

    const excelData = asistentes.map((asistente, index) => ({
        '#': index + 1,
        'NOMBRE': asistente.nombre,
        'TIPO DOCUMENTO': tipoDocumentoLabels[asistente.tipoDocumento] || asistente.tipoDocumento,
        'NÚMERO DOCUMENTO': asistente.numeroDocumento,
        'RESERVA': asistente.reservaCodigo,
        'CLIENTE': asistente.clienteNombre
    }));

    // Crear Workbook y Sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar ancho de columnas
    const colWidths = [5, 30, 25, 20, 12, 25];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, 'Asistentes');

    // Formatear fecha para nombre del archivo
    const fechaFormateada = fecha.replace(/-/g, '');

    // Descargar
    XLSX.writeFile(wb, `Asistentes_${servicioNombre.replace(/\s+/g, '_')}_${fechaFormateada}.xlsx`);
};
