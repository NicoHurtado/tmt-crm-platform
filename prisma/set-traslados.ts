/**
 * Marca esTraslado=true en los servicios cuyo nombre contiene "traslado"
 * (excluye aeropuerto y municipal, que tienen su propia sección).
 *
 * Idempotente. Uso:  npx tsx prisma/set-traslados.ts
 */
import { prisma } from '@/lib/prisma'

async function main() {
  const all = await prisma.servicio.findMany()
  const objetivos = all.filter((s) => {
    const nombre = ((s.nombre as { es?: string })?.es ?? '').toLowerCase()
    return nombre.includes('traslado') && !s.esAeropuerto && !s.esMunicipal
  })

  console.log(`Encontrados ${objetivos.length} servicios "traslado":`)
  for (const s of objetivos) {
    const nombre = (s.nombre as { es?: string })?.es
    if (s.esTraslado) {
      console.log(`  = ya marcado: ${nombre}`)
      continue
    }
    await prisma.servicio.update({ where: { id: s.id }, data: { esTraslado: true } })
    console.log(`  ✅ marcado: ${nombre}`)
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1) }).finally(() => prisma.$disconnect())
