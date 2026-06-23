/**
 * Backfill de Servicio.categoria, Servicio.modeloPrecio y (conservador) tipoServicio.
 *
 * - categoria / modeloPrecio: se derivan de los flags actuales y se escriben siempre que
 *   difieran (idempotente).
 * - tipoServicio: SOLO se rellena cuando hoy es 'OTRO' y los flags determinan un valor
 *   estructural inequívoco (aeropuerto/municipal/compartido/por horas). Nunca pisa un tipo
 *   de tour curado a mano (CITY_TOUR, TOUR_GUATAPE, …).
 *
 * No borra ni modifica ningún otro campo. Idempotente: correrlo dos veces = 0 cambios la 2ª.
 *
 * Uso:  npx tsx prisma/backfill-categoria-servicios.ts
 */
import { prisma } from '@/lib/prisma'
import {
  categoriaDeServicio,
  modeloPrecioDeServicio,
  tipoServicioEstructural,
} from '@/lib/servicio-categoria'

async function main() {
  const servicios = await prisma.servicio.findMany()
  let cat = 0
  let tipo = 0

  for (const s of servicios) {
    const categoria = categoriaDeServicio(s as any)
    const modeloPrecio = modeloPrecioDeServicio(s as any)
    const data: Record<string, unknown> = {}

    if (s.categoria !== categoria) data.categoria = categoria
    if (s.modeloPrecio !== modeloPrecio) data.modeloPrecio = modeloPrecio

    // tipoServicio legacy: solo si hoy es OTRO y los flags lo determinan.
    const estructural = tipoServicioEstructural(s as any)
    if (s.tipoServicio === 'OTRO' && estructural) {
      data.tipoServicio = estructural
      tipo++
    }

    if (Object.keys(data).length === 0) continue
    await prisma.servicio.update({ where: { id: s.id }, data })
    cat++
    const nombre = (s.nombre as { es?: string })?.es ?? s.id
    console.log(`  ✅ ${nombre}: ${JSON.stringify(data)}`)
  }

  console.log(`Listo. ${cat}/${servicios.length} servicios actualizados (tipoServicio rellenado en ${tipo}).`)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
