/**
 * Auditoría de SOLO LECTURA del estado de categorización, configuración y precios.
 * No escribe nada. Reporta inconsistencias para revisión.
 *
 * Uso:  npx tsx prisma/audit-categorizacion.ts
 */
import { prisma } from '@/lib/prisma'
import {
  categoriaDeServicio,
  modeloPrecioDeServicio,
  tipoServicioEstructural,
} from '@/lib/servicio-categoria'
import { getConfiguracion } from '@/types/servicio-config'

type Issue = { sev: 'ALTO' | 'MEDIO' | 'INFO'; servicio: string; detalle: string }

async function main() {
  const servicios = await prisma.servicio.findMany({
    include: { vehiculosPermitidos: true, _count: { select: { reservas: true } } },
    orderBy: { orden: 'asc' },
  })

  const issues: Issue[] = []
  const porCategoria: Record<string, number> = {}
  const porModelo: Record<string, number> = {}
  let activos = 0
  let inactivos = 0

  for (const s of servicios) {
    const nombre = (s.nombre as { es?: string })?.es ?? s.id
    const cfg = getConfiguracion((s as any).configuracion)
    const catDerivada = categoriaDeServicio(s as any)
    const modDerivado = modeloPrecioDeServicio(s as any)
    s.activo ? activos++ : inactivos++
    porCategoria[catDerivada] = (porCategoria[catDerivada] ?? 0) + 1
    porModelo[modDerivado] = (porModelo[modDerivado] ?? 0) + 1

    // 1. Columnas pobladas y sincronizadas
    if (s.categoria == null) issues.push({ sev: 'MEDIO', servicio: nombre, detalle: 'categoria en NULL (falta backfill)' })
    else if (s.categoria !== catDerivada) issues.push({ sev: 'ALTO', servicio: nombre, detalle: `categoria desincronizada: BD=${s.categoria} derivada=${catDerivada}` })
    if (s.modeloPrecio == null) issues.push({ sev: 'MEDIO', servicio: nombre, detalle: 'modeloPrecio en NULL (falta backfill)' })
    else if (s.modeloPrecio !== modDerivado) issues.push({ sev: 'ALTO', servicio: nombre, detalle: `modeloPrecio desincronizado: BD=${s.modeloPrecio} derivado=${modDerivado}` })

    // 2. Flags en conflicto
    const estructurales = [s.esAeropuerto && 'aeropuerto', s.esTraslado && 'traslado', s.esPorHoras && 'porHoras', s.esCompartido && 'compartido', s.esMunicipal && 'municipal'].filter(Boolean)
    if (s.esCompartido && cfg.tipoTarifa === 'POR_PERSONA') issues.push({ sev: 'ALTO', servicio: nombre, detalle: 'compartido + porPersona a la vez (excluyentes)' })
    if (estructurales.length > 1) issues.push({ sev: 'MEDIO', servicio: nombre, detalle: `múltiples flags estructurales: ${estructurales.join(', ')}` })

    // 3. Precios según modelo
    const preciosVeh = s.vehiculosPermitidos.map((v) => Number(v.precio ?? 0)).filter((p) => p > 0)
    if (modDerivado === 'POR_VEHICULO' || modDerivado === 'POR_HORAS' || modDerivado === 'COMPARTIDO_POR_PERSONA') {
      if (s.vehiculosPermitidos.length === 0) issues.push({ sev: s.activo ? 'ALTO' : 'INFO', servicio: nombre, detalle: 'sin vehículos configurados (no se puede cotizar)' })
      else if (preciosVeh.length === 0) issues.push({ sev: s.activo ? 'ALTO' : 'INFO', servicio: nombre, detalle: 'vehículos sin precio (>0)' })
    }
    if (modDerivado === 'POR_PERSONA_TRAMOS') {
      const p = cfg.preciosPorPersona
      if (!p || (Number(p.p1) <= 0 && Number(p.p2) <= 0 && Number(p.p3) <= 0)) issues.push({ sev: s.activo ? 'ALTO' : 'INFO', servicio: nombre, detalle: 'por persona sin preciosPorPersona configurados' })
    }
    // 4. Aeropuerto sin precioOlaya (fallback ok, pero se cobra JMC en Olaya)
    if (s.esAeropuerto) {
      const sinOlaya = s.vehiculosPermitidos.filter((v) => v.precioOlaya == null || Number(v.precioOlaya) <= 0)
      if (sinOlaya.length > 0) issues.push({ sev: 'INFO', servicio: nombre, detalle: `${sinOlaya.length}/${s.vehiculosPermitidos.length} vehículos sin precioOlaya (Olaya cobra tarifa JMC)` })
    }
    // 5. tipoServicio legacy desactualizado (n8n/cotizador)
    const estr = tipoServicioEstructural(s as any)
    if (estr && s.tipoServicio === 'OTRO') issues.push({ sev: 'INFO', servicio: nombre, detalle: `tipoServicio=OTRO pero estructural sugiere ${estr} (invisible para bot n8n)` })
    // 6. Residual: por persona con vehículos pegados (ignorados al cobrar)
    if (modDerivado === 'POR_PERSONA_TRAMOS' && s.vehiculosPermitidos.length > 0) {
      issues.push({ sev: 'INFO', servicio: nombre, detalle: `${s.vehiculosPermitidos.length} vehículos residuales (por persona no usa vehículos; se ignoran al cobrar)` })
    }
  }

  // Reservas: snapshot
  const reservasTotal = await prisma.reserva.count()
  const reservasSinCat = await prisma.reserva.count({ where: { categoriaServicio: null } })
  const reservasSinModelo = await prisma.reserva.count({ where: { modeloPrecio: null } })

  // ── Reporte ──
  console.log('\n══════════ AUDITORÍA DE CATEGORIZACIÓN Y PRECIOS ══════════\n')
  console.log(`Servicios: ${servicios.length} (activos ${activos} / inactivos ${inactivos})`)
  console.log('\nPor categoría (derivada):')
  for (const [k, v] of Object.entries(porCategoria).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)} ${v}`)
  console.log('\nPor modelo de precio:')
  for (const [k, v] of Object.entries(porModelo).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${v}`)

  console.log(`\nReservas: ${reservasTotal} (sin categoriaServicio ${reservasSinCat}, sin modeloPrecio ${reservasSinModelo})`)

  const alto = issues.filter((i) => i.sev === 'ALTO')
  const medio = issues.filter((i) => i.sev === 'MEDIO')
  const info = issues.filter((i) => i.sev === 'INFO')
  console.log(`\nHallazgos: ${alto.length} ALTO · ${medio.length} MEDIO · ${info.length} INFO`)
  for (const grupo of [['🔴 ALTO', alto], ['🟡 MEDIO', medio], ['🔵 INFO', info]] as const) {
    if ((grupo[1] as Issue[]).length === 0) continue
    console.log(`\n${grupo[0]}`)
    for (const i of grupo[1] as Issue[]) console.log(`  • ${i.servicio}: ${i.detalle}`)
  }
  console.log('\n═══════════════════════════════════════════════════════════\n')
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
