import { prisma } from '../lib/prisma';

// Precios Olaya Herrera para CLIENTES INDEPENDIENTES (ServicioVehiculo.precioOlaya).
// Mapeo por capacidadMaxima del vehículo.
const OLAYA_PRECIOS: { maxHasta: number; precio: number }[] = [
    { maxHasta: 4, precio: 80_000 },   // Auto (1-3) y Camioneta (4)
    { maxHasta: 8, precio: 120_000 },  // 5-8
    { maxHasta: 15, precio: 170_000 }, // 9-15
    { maxHasta: 18, precio: 200_000 }, // 16-18
    { maxHasta: 25, precio: 350_000 }, // 19-25
    { maxHasta: 40, precio: 450_000 }, // 26-40
];

function precioOlaya(cap: number): number | null {
    for (const r of OLAYA_PRECIOS) if (cap <= r.maxHasta) return r.precio;
    return null;
}

async function main() {
    const apply = process.argv.includes('--apply');

    const servicios = await prisma.servicio.findMany({
        where: { esAeropuerto: true, activo: true },
        include: { vehiculosPermitidos: { include: { vehiculo: true } } },
    });

    let updates = 0;
    for (const svc of servicios) {
        const nombre = (svc.nombre as any)?.es ?? svc.id;
        for (const sv of svc.vehiculosPermitidos) {
            const cap = sv.vehiculo.capacidadMaxima;
            const precio = precioOlaya(cap);
            if (precio == null) {
                console.warn(`  ⚠️  sin precio Olaya para cap ${cap} (${sv.vehiculo.nombre})`);
                continue;
            }
            console.log(
                `${apply ? 'SET' : 'DRY'} | ${nombre} | ${sv.vehiculo.nombre} (${cap}) | JMC ${sv.precio} -> Olaya ${precio}`
            );
            if (apply) {
                await prisma.servicioVehiculo.update({
                    where: { id: sv.id },
                    data: { precioOlaya: precio },
                });
            }
            updates++;
        }
    }
    console.log(`\n${apply ? '✅ Aplicados' : '🔎 (dry-run)'}: ${updates} registros. ${apply ? '' : 'Corre con --apply.'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
