import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLocalizedText } from '@/types/multi-language';
import { modeloPrecioDeServicio } from '@/lib/servicio-categoria';
import type { TipoAliado } from '@prisma/client';

export const dynamic = 'force-dynamic';

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const comisionLabel = (valor: number, tipo: string): string =>
    tipo === 'PORCENTAJE' ? `${valor}%` : `$${valor.toLocaleString('es-CO')}`;

const TIPOS: { tipo: TipoAliado; hoja: string }[] = [
    { tipo: 'HOTEL', hoja: 'Hoteles' },
    { tipo: 'AGENCIA', hoja: 'Agencias' },
    { tipo: 'AIRBNB', hoja: 'Airbnb' },
];

const DETALLE_HEADERS = [
    'Aliado', 'Servicio', 'Estado servicio', 'Vehículo',
    'Precio base aliado', 'Comisión', 'Tipo comisión', 'Precio Olaya', 'Comisión Olaya',
];

/**
 * GET /api/admin/estado-general/aliados-comisiones
 * Archivo 2: reporte financiero/comercial por aliado (sin texto descriptivo).
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const aliados = await prisma.aliado.findMany({
        orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
        include: {
            serviciosAliado: {
                include: {
                    servicio: true,
                    preciosVehiculos: { include: { vehiculo: true } },
                },
            },
        },
    });

    const wb = XLSX.utils.book_new();

    // ── Hoja Resumen ──
    const resumen: (string | number)[][] = [
        ['Aliado', 'Tipo', 'Servicios activos', 'Servicios inactivos', 'Estado aliado'],
        ...aliados.map((a) => {
            const activos = a.serviciosAliado.filter((sa) => sa.activo).length;
            const inactivos = a.serviciosAliado.length - activos;
            return [a.nombre, a.tipo, activos, inactivos, a.activo ? 'Activo' : 'Inactivo'];
        }),
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols'] = [28, 12, 18, 18, 14].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // ── Una hoja por tipo de aliado ──
    for (const { tipo, hoja } of TIPOS) {
        const delTipo = aliados.filter((a) => a.tipo === tipo);
        const rows: (string | number)[][] = [DETALLE_HEADERS];

        for (const a of delTipo) {
            rows.push([]);
            rows.push([`${a.nombre} · ${a.codigo} · ${a.activo ? 'Activo' : 'Inactivo'}`]);

            for (const sa of a.serviciosAliado) {
                const nombre = getLocalizedText(sa.servicio.nombre, 'ES');
                const estado = sa.activo ? 'Activo' : 'Inactivo';
                const modelo = modeloPrecioDeServicio(sa.servicio as any);

                if (modelo === 'POR_PERSONA_TRAMOS') {
                    const tipoC = sa.comisionPorPersonaTipo;
                    const comision = tipoC
                        ? comisionLabel(num(sa.comisionPorPersonaValor), tipoC)
                        : 'Automática por tipo';
                    rows.push([a.nombre, nombre, estado, 'Por persona', '', comision,
                        tipoC ?? 'AUTO', '', '']);
                    continue;
                }

                if (sa.preciosVehiculos.length === 0) {
                    rows.push([a.nombre, nombre, estado, '—', '', '', '', '', '']);
                    continue;
                }

                for (const pv of sa.preciosVehiculos) {
                    const tieneOlaya = pv.precioBaseOlaya != null || pv.comisionValorOlaya != null;
                    rows.push([
                        a.nombre,
                        nombre,
                        pv.activo ? estado : 'Inactivo',
                        pv.vehiculo.nombre,
                        num(pv.precioBase),
                        comisionLabel(num(pv.comisionValor), pv.tipoComision),
                        pv.tipoComision,
                        tieneOlaya ? num(pv.precioBaseOlaya ?? pv.precioBase) : '',
                        tieneOlaya
                            ? comisionLabel(num(pv.comisionValorOlaya ?? pv.comisionValor), pv.tipoComisionOlaya ?? pv.tipoComision)
                            : '',
                    ]);
                }
            }
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [26, 26, 16, 18, 18, 16, 16, 16, 16].map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(wb, ws, hoja);
    }

    const buf = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const fecha = new Date().toISOString().split('T')[0];

    return new NextResponse(buf, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Aliados_y_Comisiones_${fecha}.xlsx"`,
        },
    });
}
