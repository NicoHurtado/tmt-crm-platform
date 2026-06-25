import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLocalizedText } from '@/types/multi-language';
import {
    servicioAFilas,
    ORDEN_BLOQUES,
    type ServicioFila,
} from '@/lib/reports/estado-general';
import { categoriaDeServicio } from '@/lib/servicio-categoria';

export const dynamic = 'force-dynamic';

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const SERVICIO_HEADERS = [
    'Servicio (ES)', 'Categoría', 'Modalidad', 'Vehículo', 'Capacidad',
    'Precio', 'Precio Olaya', 'Duración', 'Incluye (ES)',
    'Descripción (ES)', 'Descripción (EN)', 'Recargo nocturno', 'Guía ES', 'Guía EN',
];

function filaToRow(f: ServicioFila): (string | number)[] {
    return [
        f.servicio, f.categoria, f.modalidad, f.vehiculo, f.capacidad,
        f.precio, f.precioOlaya, f.duracion, f.incluyeES,
        f.descripcionES, f.descripcionEN, f.recargoNocturno, f.guiaES, f.guiaEN,
    ];
}

/**
 * GET /api/admin/estado-general/servicios-precios
 * Archivo 1: catálogo operativo de servicios y precios para independientes.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [servicios, municipios] = await Promise.all([
        prisma.servicio.findMany({
            where: { activo: true },
            include: {
                vehiculosPermitidos: {
                    include: { vehiculo: true },
                    orderBy: { vehiculo: { capacidadMaxima: 'asc' } },
                },
            },
        }),
        prisma.municipioConfig.findMany({ orderBy: { orden: 'asc' } }),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Hoja 1 · Servicios Generales (por bloque de categoría) ──
    const noMunicipales = servicios.filter((s) => !s.esMunicipal);
    const rows1: (string | number)[][] = [SERVICIO_HEADERS];

    for (const bloque of ORDEN_BLOQUES) {
        const delBloque = noMunicipales.filter((s) =>
            bloque.categorias.includes(categoriaDeServicio(s as any)),
        );
        if (delBloque.length === 0) continue;
        rows1.push([]); // fila vacía separadora
        rows1.push([bloque.label.toUpperCase()]); // encabezado de bloque
        for (const s of delBloque) {
            for (const f of servicioAFilas(s as any)) rows1.push(filaToRow(f));
        }
    }

    const ws1 = XLSX.utils.aoa_to_sheet(rows1);
    ws1['!cols'] = [28, 22, 22, 18, 12, 14, 14, 16, 40, 45, 45, 22, 14, 14].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Servicios Generales');

    // ── Hoja 2 · Tarifas por Municipio ──
    const rows2: (string | number)[][] = [
        ['Nota: el recargo se suma al precio base del servicio.'],
        [],
        ['Municipio (ES)', 'Municipio (EN)', 'Recargo', 'Activo'],
        ...municipios.map((m) => [m.nombreES, m.nombreEN, num(m.recargo), m.activo ? 'Sí' : 'No']),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(rows2);
    ws2['!cols'] = [24, 24, 16, 10].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Tarifas por Municipio');

    // ── Hoja 3 · Transportes Municipales ──
    const municipales = servicios.filter((s) => s.esMunicipal);
    const rows3: (string | number)[][] = [['Servicio', 'Vehículo', 'Capacidad', 'Precio', 'Activo']];
    for (const s of municipales) {
        const nombre = getLocalizedText(s.nombre, 'ES');
        if (s.vehiculosPermitidos.length === 0) {
            rows3.push([nombre, '—', '—', 0, 'Sí']);
            continue;
        }
        for (const sv of s.vehiculosPermitidos) {
            const cap = sv.vehiculo.capacidadMinima === sv.vehiculo.capacidadMaxima
                ? `${sv.vehiculo.capacidadMaxima}`
                : `${sv.vehiculo.capacidadMinima}–${sv.vehiculo.capacidadMaxima}`;
            rows3.push([nombre, sv.vehiculo.nombre, cap, num(sv.precio), 'Sí']);
        }
    }
    const ws3 = XLSX.utils.aoa_to_sheet(rows3);
    ws3['!cols'] = [28, 18, 12, 14, 10].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Transportes Municipales');

    const buf = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const fecha = new Date().toISOString().split('T')[0];

    return new NextResponse(buf, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Servicios_y_Precios_${fecha}.xlsx"`,
        },
    });
}
