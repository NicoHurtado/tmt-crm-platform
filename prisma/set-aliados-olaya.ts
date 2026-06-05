import { prisma } from '../lib/prisma';

// Lista de precios Olaya Herrera por capacidad de vehículo (capacidadMaxima cae en el rango).
const OLAYA_PRECIOS: { maxHasta: number; precio: number }[] = [
    { maxHasta: 4, precio: 80_000 },   // Auto (1-3) y Camioneta (4)
    { maxHasta: 8, precio: 120_000 },  // 5-8
    { maxHasta: 15, precio: 170_000 }, // 9-15
    { maxHasta: 18, precio: 200_000 }, // 16-18
    { maxHasta: 25, precio: 350_000 }, // 19-25
    { maxHasta: 40, precio: 450_000 }, // 26-40
];

function precioOlayaPorCapacidad(capacidadMaxima: number): number | null {
    for (const r of OLAYA_PRECIOS) {
        if (capacidadMaxima <= r.maxHasta) return r.precio;
    }
    return null;
}

async function main() {
    const apply = process.argv.includes('--apply');

    const servicios = await prisma.servicio.findMany({
        where: { esAeropuerto: true, activo: true },
        select: { id: true },
    });
    const svcIds = servicios.map((s) => s.id);

    const vehiculos = await prisma.vehiculo.findMany({
        select: { id: true, capacidadMaxima: true, nombre: true },
    });
    const capById = new Map(vehiculos.map((v) => [v.id, v]));

    const sas = await prisma.servicioAliado.findMany({
        where: { servicioId: { in: svcIds } },
        include: { preciosVehiculos: true, aliado: { select: { nombre: true, tipo: true } } },
    });

    let updates = 0;
    for (const sa of sas) {
        const tipo = sa.aliado.tipo;
        // Comisión Olaya: 12% solo HOTEL y AIRBNB; AGENCIA = 0 (sin comisión).
        const aplicaComision = tipo === 'HOTEL' || tipo === 'AIRBNB';
        const comisionValorOlaya = aplicaComision ? 12 : 0;
        const tipoComisionOlaya = 'PORCENTAJE' as const;

        for (const pv of sa.preciosVehiculos) {
            const veh = capById.get(pv.vehiculoId);
            if (!veh) {
                console.warn(`  ⚠️  vehículo desconocido ${pv.vehiculoId} (${sa.aliado.nombre})`);
                continue;
            }
            const precioBaseOlaya = precioOlayaPorCapacidad(veh.capacidadMaxima);
            if (precioBaseOlaya == null) {
                console.warn(`  ⚠️  sin precio Olaya para cap ${veh.capacidadMaxima} (${veh.nombre})`);
                continue;
            }
            console.log(
                `${apply ? 'SET' : 'DRY'} | ${tipo} | ${sa.aliado.nombre} | ${veh.nombre} (${veh.capacidadMaxima}) -> olaya ${precioBaseOlaya} com ${comisionValorOlaya}% `
            );
            if (apply) {
                await prisma.precioVehiculoAliado.update({
                    where: { id: pv.id },
                    data: { precioBaseOlaya, comisionValorOlaya, tipoComisionOlaya },
                });
            }
            updates++;
        }
    }

    console.log(`\n${apply ? '✅ Aplicados' : '🔎 (dry-run) Pendientes'}: ${updates} registros. ${apply ? '' : 'Corre con --apply para aplicar.'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
