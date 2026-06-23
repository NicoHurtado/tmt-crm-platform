/**
 * Clona el servicio "Traslado Guatapé (solo ida)" para crear dos servicios nuevos:
 *   - Traslado Santa Fe de Antioquia
 *   - Traslado Sopetrán
 *
 * Copia config, campos dinámicos, banderas y precios por vehículo EXACTOS del
 * traslado de Guatapé solo ida. Solo adapta los textos (nombre/descripción/incluye)
 * y el destino a cada ciudad.
 *
 * Idempotente: se puede correr varias veces. Identifica los servicios destino por
 * (destinoAutoFill + esTraslado) y hace update si ya existen, create si no.
 *
 * Uso:   npx tsx prisma/clone-traslado-occidente.ts
 * Source override (si la detección es ambigua):  SOURCE_ID=<servicioId> npx tsx prisma/clone-traslado-occidente.ts
 */
import { prisma } from '@/lib/prisma'

type LangText = { es: string; en: string }

// Destinos nuevos. Cada uno reemplaza las menciones a Guatapé/El Peñol en los textos.
const DESTINOS = [
  {
    destino: 'Santa Fe de Antioquia',
    destinoEn: 'Santa Fe de Antioquia',
    // términos del origen a reemplazar (es/en) por el nombre del destino
  },
  {
    destino: 'Sopetrán',
    destinoEn: 'Sopetrán',
  },
]

// Términos del servicio origen que se reemplazan por el destino al adaptar textos.
const ORIGEN_TERMS = [/Guatapé y El Peñol/gi, /Guatapé\/El Peñol/gi, /El Peñol y Guatapé/gi, /Guatapé/gi, /El Peñol/gi]

function adaptText(text: string, destino: string): string {
  let out = text
  for (const term of ORIGEN_TERMS) out = out.replace(term, destino)
  return out
}

function adaptLang(value: unknown, destino: string, destinoEn: string): LangText {
  const v = (value ?? {}) as Partial<LangText>
  return {
    es: adaptText(v.es ?? '', destino),
    en: adaptText(v.en ?? '', destinoEn),
  }
}

function adaptIncluye(value: unknown, destino: string, destinoEn: string): { es: string[]; en: string[] } {
  const v = (value ?? {}) as { es?: string[]; en?: string[] }
  return {
    es: (v.es ?? []).map((s) => adaptText(s, destino)),
    en: (v.en ?? []).map((s) => adaptText(s, destinoEn)),
  }
}

// Id conocido del "Traslado Guatapé ( solo ida )" en la BD de producción.
const DEFAULT_SOURCE_ID = 'cmiz1plzm0000vmn3hpcoqoci'

async function resolveSource() {
  const sourceId = process.env.SOURCE_ID || DEFAULT_SOURCE_ID
  const byId = await prisma.servicio.findUnique({
    where: { id: sourceId },
    include: { vehiculosPermitidos: { include: { vehiculo: true } } },
  })
  if (byId) return byId

  // Fallback: detectar por nombre (traslado + guatapé, solo ida) si cambió el id.
  const all = await prisma.servicio.findMany({
    include: { vehiculosPermitidos: { include: { vehiculo: true } } },
  })
  const nombreEs = (s: (typeof all)[number]) => ((s.nombre as Partial<LangText>)?.es ?? '').toLowerCase()
  const candidatos = all.filter((s) => /guatap/.test(nombreEs(s)) && /traslado/.test(nombreEs(s)))
  if (candidatos.length === 0) throw new Error('No se encontró ningún servicio de traslado de Guatapé.')
  // Preferir "solo ida": excluir ida y vuelta / redondo, preferir los que digan "ida".
  const soloIda = candidatos.filter((s) => !/(vuelta|redondo)/i.test(nombreEs(s)))
  const conIda = soloIda.filter((s) => /\bida\b|solo ?ida|una vía/i.test(nombreEs(s)))

  const pool = conIda.length > 0 ? conIda : soloIda.length > 0 ? soloIda : candidatos
  if (pool.length === 1) return pool[0]

  console.log('⚠️  Varios candidatos de "Traslado Guatapé". Define SOURCE_ID con el id correcto:')
  for (const s of pool) {
    console.log(`   - ${s.id} | ${(s.nombre as Partial<LangText>)?.es} | destino: ${s.destinoAutoFill}`)
  }
  throw new Error('Fuente ambigua: usa SOURCE_ID=<id>')
}

async function upsertDestino(
  source: Awaited<ReturnType<typeof resolveSource>>,
  destino: string,
  destinoEn: string,
) {
  // Deriva el nombre del origen para conservar el sufijo "( solo ida )".
  const nombre = adaptLang(source.nombre, destino, destinoEn)
  const descripcion = adaptLang(source.descripcion, destino, destinoEn)
  const incluye = adaptIncluye(source.incluye, destino, destinoEn)

  const data = {
    tipoServicio: source.tipoServicio,
    esMunicipal: source.esMunicipal,
    esTraslado: source.esTraslado,
    esAeropuerto: source.esAeropuerto,
    esPorHoras: source.esPorHoras,
    esCompartido: source.esCompartido,
    imagen: source.imagen, // placeholder: misma imagen de Guatapé, cambiar luego en /admin/servicios
    activo: source.activo,
    duracion: source.duracion,
    aplicaRecargoNocturno: source.aplicaRecargoNocturno,
    recargoNocturnoInicio: source.recargoNocturnoInicio,
    recargoNocturnoFin: source.recargoNocturnoFin,
    montoRecargoNocturno: source.montoRecargoNocturno,
    configuracion: source.configuracion as object,
    destinoAutoFill: destino,
    guiaEspanolDisponible: source.guiaEspanolDisponible,
    precioGuiaEspanol: source.precioGuiaEspanol,
    guiaInglesDisponible: source.guiaInglesDisponible,
    precioGuiaIngles: source.precioGuiaIngles,
    nombre,
    descripcion,
    incluye,
  }

  // Idempotencia: buscar por nombre exacto (no colisiona con el servicio municipal del mismo destino).
  const existente = await prisma.servicio.findFirst({
    where: { nombre: { path: ['es'], equals: nombre.es } },
  })

  let servicio
  if (existente) {
    servicio = await prisma.servicio.update({ where: { id: existente.id }, data })
    console.log(`♻️  Actualizado: ${nombre.es} (${servicio.id})`)
  } else {
    servicio = await prisma.servicio.create({ data: { ...data, orden: source.orden } })
    console.log(`✅ Creado: ${nombre.es} (${servicio.id})`)
  }

  // Precios por vehículo: clonar precio + precioOlaya exactos del origen.
  for (const sv of source.vehiculosPermitidos) {
    await prisma.servicioVehiculo.upsert({
      where: { servicioId_vehiculoId: { servicioId: servicio.id, vehiculoId: sv.vehiculoId } },
      update: { precio: sv.precio, precioOlaya: sv.precioOlaya },
      create: {
        servicioId: servicio.id,
        vehiculoId: sv.vehiculoId,
        precio: sv.precio,
        precioOlaya: sv.precioOlaya,
      },
    })
    console.log(`   🚐 ${sv.vehiculo.nombre}: ${sv.precio?.toString() ?? '—'}`)
  }

  return servicio
}

async function main() {
  const source = await resolveSource()
  console.log('📦 Fuente:', (source.nombre as Partial<LangText>)?.es, `(${source.id})`)
  console.log('   tipo:', source.tipoServicio, '| destino:', source.destinoAutoFill, '| vehículos:', source.vehiculosPermitidos.length)
  console.log('')

  for (const d of DESTINOS) {
    await upsertDestino(source, d.destino, d.destinoEn)
    console.log('')
  }

  console.log('Listo. Recuerda: la imagen es la de Guatapé (placeholder) — cámbiala en /admin/servicios.')
  console.log('Nota: estos servicios aún no tienen ServicioAliado/PrecioVehiculoAliado (no aparecen en modo aliado).')
}

main()
  .catch((e) => {
    console.error('❌', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
