/**
 * Backfill (best-effort) del snapshot Reserva.categoriaServicio / Reserva.modeloPrecio
 * para reservas históricas creadas antes de existir estas columnas.
 *
 * Estrategia eficiente: en vez de una query por reserva, agrupa por servicio y usa
 * updateMany (≈2 queries por servicio, no por reserva). Deriva el snapshot desde la
 * config ACTUAL del servicio. Es una aproximación: si la config del servicio cambió desde
 * que se creó la reserva, el valor refleja el estado actual, no el histórico. Por eso SOLO
 * rellena filas con el snapshot en NULL — nunca pisa un snapshot ya estampado al crear.
 *
 * No borra ni modifica ningún otro campo. Idempotente.
 *
 * Uso:  npx tsx prisma/backfill-reserva-categoria.ts
 */
import { prisma } from '@/lib/prisma'
import { categoriaDeServicio, modeloPrecioDeServicio } from '@/lib/servicio-categoria'

async function main() {
  const servicios = await prisma.servicio.findMany()
  console.log(`Procesando ${servicios.length} servicios…`)

  let totalCat = 0
  let totalModelo = 0

  for (const s of servicios) {
    const categoria = categoriaDeServicio(s as any)
    const modeloPrecio = modeloPrecioDeServicio(s as any)

    const rCat = await prisma.reserva.updateMany({
      where: { servicioId: s.id, categoriaServicio: null },
      data: { categoriaServicio: categoria },
    })
    const rModelo = await prisma.reserva.updateMany({
      where: { servicioId: s.id, modeloPrecio: null },
      data: { modeloPrecio },
    })

    totalCat += rCat.count
    totalModelo += rModelo.count
    if (rCat.count || rModelo.count) {
      const nombre = (s.nombre as { es?: string })?.es ?? s.id
      console.log(`  ✅ ${nombre}: categoria→${rCat.count}, modeloPrecio→${rModelo.count}`)
    }
  }

  console.log(`Listo. Reservas actualizadas: categoria=${totalCat}, modeloPrecio=${totalModelo}.`)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
