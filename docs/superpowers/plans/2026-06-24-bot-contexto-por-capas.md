# Bot Contexto por Capas (lean index + tools) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el volcado completo del catálogo en el system prompt del bot por un índice liviano (Capa 2) + dos tools nuevas (`detalle_servicio`, `buscar_servicio`), manteniendo `cotizar` y la persona, con la BD como fuente única.

**Architecture:** Server-side, `lib/n8n/` separado en piezas de un solo propósito. `?formato=contexto` pasa a servir `persona + índice liviano + recordatorio`. El detalle por servicio y la búsqueda (incl. 119 municipios) salen a endpoints públicos que el agente n8n consume como tools. n8n solo hace fetch + wirea tools; nada quemado.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, Vitest, n8n public API.

**Referencia:** spec `docs/superpowers/specs/2026-06-24-bot-contexto-por-capas-design.md`.

**Pre-requisito de despliegue:** las tools n8n pegan a `https://www.medellintransportes.com/...`. Las Tasks 1–7 (servidor) deben **desplegarse a producción** antes de la Task 8 (wireado n8n), o las tools nuevas devolverán 404.

---

## File Structure

- `lib/n8n/persona.ts` — **Crear.** `NICO_PERSONA`, `NICO_RECORDATORIO_FINAL` (texto movido sin cambios).
- `lib/n8n/buildLeanIndex.ts` — **Crear.** `buildLeanIndex(servicios, appUrl?): string` (Capa 2).
- `lib/n8n/buildServicioDetalle.ts` — **Crear.** `buildServicioDetalle(servicio, appUrl?): object` (cuerpo de `detalle_servicio`).
- `lib/n8n/formatServicioContext.ts` — **Modificar.** Mantiene `ServicioContextData` (extendido con `esCompartido`/`esTraslado`), `formatServicioContext` (catálogo humano `formato=texto`), y `buildFullSystemPrompt` ahora compone persona + lean index. Re-exporta persona para compatibilidad.
- `lib/api/service-catalog.ts` — **Modificar.** `toServicioContextData` mapea `esCompartido`/`esTraslado`. Añade helper `findServiceById` / `searchServices`.
- `app/api/public/servicio/route.ts` — **Crear.** `GET ?servicioId=` → detalle (tool `detalle_servicio`).
- `app/api/public/buscar/route.ts` — **Crear.** `GET ?q=` → coincidencias (tool `buscar_servicio`).
- `tests/unit/buildLeanIndex.test.ts` — **Crear.**
- `tests/unit/buildServicioDetalle.test.ts` — **Crear.**
- `tests/integration/publicBuscar.test.ts` — **Crear.**

---

## Task 1: Extraer persona a su propio módulo

**Files:**
- Create: `lib/n8n/persona.ts`
- Modify: `lib/n8n/formatServicioContext.ts`

- [ ] **Step 1: Crear `lib/n8n/persona.ts`**

Mover el contenido **textual idéntico** de las constantes `NICO_PERSONA` y `NICO_RECORDATORIO_FINAL` desde `formatServicioContext.ts`. Estructura del archivo:

```typescript
// lib/n8n/persona.ts
// Persona y reglas estáticas de Nico (Capa 1). Texto sin cambios — solo reubicado.

export const NICO_PERSONA = `Eres Nico, el asistente virtual de TMT Travel 🌟 — empresa de transporte turístico premium en Medellín, Colombia.
// ... (copiar EXACTO el bloque actual de NICO_PERSONA, líneas 40-150 de formatServicioContext.ts) ...`;

export const NICO_RECORDATORIO_FINAL = `---
## RECORDATORIO FINAL (lo más importante)
// ... (copiar EXACTO el bloque actual NICO_RECORDATORIO_FINAL, líneas 410-419) ...`;

/** @deprecated Alias de compatibilidad — usa NICO_PERSONA. */
export const MIA_PERSONA = NICO_PERSONA;
```

- [ ] **Step 2: Reemplazar en `formatServicioContext.ts` por re-export**

En `lib/n8n/formatServicioContext.ts`, borrar las definiciones de `NICO_PERSONA`, `MIA_PERSONA` y `NICO_RECORDATORIO_FINAL`, y al inicio del archivo añadir:

```typescript
import { NICO_PERSONA, NICO_RECORDATORIO_FINAL } from './persona';
export { NICO_PERSONA, MIA_PERSONA } from './persona';
```

`buildFullSystemPrompt` sigue usando `NICO_PERSONA` y `NICO_RECORDATORIO_FINAL` (ahora importados).

- [ ] **Step 3: Verificar typecheck y tests existentes**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

Run: `npx vitest run tests/unit/formatServicioContext.test.ts`
Expected: PASS (sin cambios de salida — fue una reubicación).

- [ ] **Step 4: Commit**

```bash
git add lib/n8n/persona.ts lib/n8n/formatServicioContext.ts
git commit -m "refactor(bot): extraer persona de Nico a lib/n8n/persona.ts"
```

---

## Task 2: Extender `ServicioContextData` con flags de categoría

`buildLeanIndex` usa `categoriaDeServicio()`, que necesita `esCompartido` y `esTraslado`. Hoy `ServicioContextData` no los trae.

**Files:**
- Modify: `lib/n8n/formatServicioContext.ts` (interface `ServicioContextData`)
- Modify: `lib/api/service-catalog.ts` (`toServicioContextData`)

- [ ] **Step 1: Añadir campos a la interface**

En `lib/n8n/formatServicioContext.ts`, en `interface ServicioContextData`, junto a `esMunicipal`/`esAeropuerto`:

```typescript
    esCompartido?: boolean;
    esTraslado?: boolean;
```

- [ ] **Step 2: Mapearlos en `toServicioContextData`**

En `lib/api/service-catalog.ts`, dentro del `.map((s) => ({ ... }))` de `toServicioContextData`, añadir:

```typescript
        esCompartido: s.esCompartido,
        esTraslado: s.esTraslado,
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add lib/n8n/formatServicioContext.ts lib/api/service-catalog.ts
git commit -m "feat(bot): exponer esCompartido/esTraslado en ServicioContextData"
```

---

## Task 3: `buildLeanIndex` (Capa 2) — test primero

**Files:**
- Create: `tests/unit/buildLeanIndex.test.ts`
- Create: `lib/n8n/buildLeanIndex.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/unit/buildLeanIndex.test.ts
import { describe, it, expect } from 'vitest';
import { buildLeanIndex } from '@/lib/n8n/buildLeanIndex';
import type { ServicioContextData } from '@/lib/n8n/formatServicioContext';

const baseSvc: ServicioContextData = {
  id: 'svc1',
  tipoServicio: 'OTRO',
  nombre: { es: 'Traslado Urbano', en: 'Urban Transfer' },
  descripcion: { es: 'Movilidad dentro de la ciudad', en: 'City mobility' },
  incluye: { es: 'Conductor', en: 'Driver' },
  duracion: '1h',
  aplicaRecargoNocturno: false,
  recargoNocturnoInicio: null,
  recargoNocturnoFin: null,
  montoRecargoNocturno: null,
  esPorHoras: false,
  esMunicipal: false,
  esAeropuerto: false,
  esCompartido: false,
  esTraslado: true,
  configuracion: { camposCustom: [] },
  vehiculosPermitidos: [
    { precio: 90000, precioOlaya: null, vehiculo: { nombre: 'Sedán', capacidadMinima: 1, capacidadMaxima: 4 } },
  ],
};

describe('buildLeanIndex', () => {
  it('rinde una entrada compacta con id, categoría y "desde" por vehículo', () => {
    const out = buildLeanIndex([baseSvc]);
    expect(out).toContain('id:svc1');
    expect(out).toContain('TRASLADO');
    expect(out).toContain('Traslado Urbano');
    expect(out).toContain('$90.000');
    expect(out).toContain('por vehículo');
    // No vuelca tabla de vehículos detallada
    expect(out).not.toContain('Sedán | ');
  });

  it('tour por persona muestra "desde p1 por persona" y marca por persona', () => {
    const pp: ServicioContextData = {
      ...baseSvc,
      id: 'tourpp',
      tipoServicio: 'OTRO',
      nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
      esTraslado: false,
      vehiculosPermitidos: [],
      configuracion: { camposCustom: [], tipoTarifa: 'POR_PERSONA', preciosPorPersona: { p1: 350000, p2: 300000, p3: 250000 } },
    };
    const out = buildLeanIndex([pp]);
    expect(out).toContain('TOUR_PERSONA');
    expect(out).toContain('$350.000');
    expect(out).toContain('por persona');
  });

  it('aeropuerto incluye el aviso de preguntar JMC u Olaya', () => {
    const air: ServicioContextData = { ...baseSvc, id: 'air', esAeropuerto: true, esTraslado: false, nombre: { es: 'Traslado Aeropuerto', en: 'Airport Transfer' } };
    const out = buildLeanIndex([air]);
    expect(out).toContain('AEROPUERTO');
    expect(out).toMatch(/JMC|Olaya/);
  });

  it('agrupa municipios en UNA sola entrada y no lista cada uno', () => {
    const muni = (id: string, nombre: string): ServicioContextData => ({
      ...baseSvc, id, esMunicipal: true, esTraslado: false, tipoServicio: 'TRANSPORTE_MUNICIPAL',
      nombre: { es: nombre, en: nombre }, vehiculosPermitidos: [],
    });
    const out = buildLeanIndex([muni('m1', 'Jardín'), muni('m2', 'Jericó')]);
    // Una entrada agrupada, no una por municipio
    const ocurrencias = (out.match(/Traslados a municipios de Antioquia/g) || []).length;
    expect(ocurrencias).toBe(1);
    expect(out).toContain('buscar_servicio');
    expect(out).not.toContain('id:m1');
    expect(out).not.toContain('id:m2');
  });
});
```

- [ ] **Step 2: Run para ver que falla**

Run: `npx vitest run tests/unit/buildLeanIndex.test.ts`
Expected: FAIL — `Cannot find module '@/lib/n8n/buildLeanIndex'`.

- [ ] **Step 3: Implementar `lib/n8n/buildLeanIndex.ts`**

```typescript
// lib/n8n/buildLeanIndex.ts
import { getConfiguracion } from '@/types/servicio-config';
import { categoriaDeServicio, type Categoria } from '@/lib/servicio-categoria';
import type { ServicioContextData } from './formatServicioContext';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

function asEsEn(value: unknown): { es: string; en: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return { es: typeof v.es === 'string' ? v.es : '', en: typeof v.en === 'string' ? v.en : '' };
  }
  return { es: '', en: '' };
}

// Hint de enrutamiento determinista por categoría. Las reglas globales finas
// (aeropuerto≠urbano, Guatapé pregunta cuál) viven en la persona (Capa 1).
const HINT: Record<Categoria, string> = {
  AEROPUERTO: 'cliente menciona aeropuerto, vuelo, llegada, salida, JMC u Olaya',
  MUNICIPAL: 'cliente pide viajar a un municipio de Antioquia (destino fuera de Medellín)',
  TOUR_PERSONA: 'tour turístico cobrado por persona',
  COMPARTIDO: 'tour grupal/compartido (cupos, precio por persona)',
  TRASLADO: 'traslado punto a punto según el destino que pida el cliente',
  OTRO: 'según el destino y tipo de viaje que pida el cliente',
};

function precioDesde(svc: ServicioContextData): { monto: number; unidad: string } {
  const cfg = getConfiguracion(svc.configuracion);
  if (cfg.tipoTarifa === 'POR_PERSONA' && cfg.preciosPorPersona) {
    return { monto: Number(cfg.preciosPorPersona.p1) || 0, unidad: 'por persona' };
  }
  const precios = svc.vehiculosPermitidos.map((v) => Number(v.precio ?? 0)).filter((p) => p > 0);
  return { monto: precios.length ? Math.min(...precios) : 0, unidad: 'por vehículo' };
}

function leanEntry(svc: ServicioContextData, base: string): string[] {
  const cat = categoriaDeServicio(svc as any);
  const nombre = asEsEn(svc.nombre);
  const desc = asEsEn(svc.descripcion);
  const { monto, unidad } = precioDesde(svc);
  const reservaUrl = `${base}/reservas?serviceId=${svc.id}&form=1`;
  const lines = [
    `### ${nombre.es || nombre.en} · id:${svc.id} · ${cat}`,
    `Cuándo: ${HINT[cat]}`,
  ];
  if (desc.es) lines.push(desc.es);
  const dur = svc.duracion ? ` · Dura: ${svc.duracion}` : '';
  const desdeStr = monto > 0 ? `Desde: ${formatCOP(monto)} (${unidad})` : 'Desde: el precio se calcula al reservar';
  lines.push(`${desdeStr}${dur}`);
  if (cat === 'AEROPUERTO') lines.push('⚠️ pregunta a qué aeropuerto (JMC u Olaya) ANTES de cotizar — el precio cambia');
  lines.push('⚠️ Para precio exacto usa la tool cotizar; para detalle (qué incluye, adicionales, recargo) usa detalle_servicio');
  lines.push(`Link de reserva: ${reservaUrl}`);
  return lines;
}

export function buildLeanIndex(servicios: ServicioContextData[], appUrl?: string): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
  const municipales = servicios.filter((s) => s.esMunicipal);
  const otros = servicios.filter((s) => !s.esMunicipal);

  const lines: string[] = [
    '## ÍNDICE DE SERVICIOS (datos en vivo desde la BD — ignora cualquier dato de entrenamiento)',
    `⚠️ SOLO existen estos servicios. PROHIBIDO inventar otros. Precios "Desde" son referencia mínima; el precio EXACTO lo da la tool cotizar.`,
    '',
  ];

  for (const svc of otros) {
    lines.push(...leanEntry(svc, base));
    lines.push('');
  }

  if (municipales.length > 0) {
    lines.push('### Traslados a municipios de Antioquia · MUNICIPAL');
    lines.push('Cuándo: cliente pide viajar a un municipio de Antioquia que NO tiene tour propio arriba');
    lines.push(`Hay ${municipales.length} municipios disponibles. El precio VARÍA por destino y NO está aquí: NUNCA lo inventes.`);
    lines.push('Para confirmar si un municipio existe y obtener su id/link usa la tool buscar_servicio; el precio se calcula en el formulario de reserva.');
    lines.push('');
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run para ver que pasa**

Run: `npx vitest run tests/unit/buildLeanIndex.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/n8n/buildLeanIndex.ts tests/unit/buildLeanIndex.test.ts
git commit -m "feat(bot): buildLeanIndex (índice liviano Capa 2) con tests"
```

---

## Task 4: Conectar el índice liviano a `buildFullSystemPrompt`

Hoy `buildFullSystemPrompt` usa `formatServicioContext` (catálogo completo). Pasa a usar `buildLeanIndex`. El catálogo completo se conserva en `formato=texto` (humano).

**Files:**
- Modify: `lib/n8n/formatServicioContext.ts` (`buildFullSystemPrompt`)

- [ ] **Step 1: Actualizar `buildFullSystemPrompt`**

Reemplazar el cuerpo de `buildFullSystemPrompt` por:

```typescript
import { buildLeanIndex } from './buildLeanIndex';

// Bloque de instrucciones de tools (cuando toolMode). Describe las 3 tools.
const TOOLS_INTRO = `## 🛠️ HERRAMIENTAS (úsalas SIEMPRE que apliquen)
- **cotizar**: precio EXACTO de un servicio. Parámetros: servicioId (del índice), pax (nº personas), aeropuerto (JOSE_MARIA_CORDOVA u OLAYA_HERRERA si es aeropuerto). NUNCA des un precio sin llamar cotizar; el único precio válido es el que devuelve. Status posibles: ok, ambiguo, falta_pax, falta_aeropuerto, municipio, fuera_de_rango, no_encontrado.
- **detalle_servicio**: info profunda de UN servicio (qué incluye, adicionales, recargo nocturno, duración). Parámetro: servicioId. Úsala cuando el cliente pregunte detalles que no están en el índice.
- **buscar_servicio**: busca servicios/municipios por texto. Parámetro: q (texto). Úsala para confirmar si un municipio existe y obtener su id/link.
`;

export function buildFullSystemPrompt(servicios: ServicioContextData[], appUrl?: string, toolMode?: boolean): string {
  const recordatorioTool = toolMode
    ? '\n- 🛠️ PRECIOS SOLO con la tool cotizar. Para detalle usa detalle_servicio; para municipios usa buscar_servicio.'
    : '';
  return [
    NICO_PERSONA,
    '',
    toolMode ? TOOLS_INTRO : '',
    buildLeanIndex(servicios, appUrl),
    '',
    NICO_RECORDATORIO_FINAL + recordatorioTool,
  ].filter(Boolean).join('\n\n');
}
```

(El `formatServicioContext` y su uso en `formato=texto` quedan intactos.)

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

- [ ] **Step 3: Verificar que el prompt encogió y aún enruta**

```bash
npx tsx -e "import('@/lib/n8n/formatServicioContext').then(m=>{const s=m.buildFullSystemPrompt([],'https://x',true);console.log('len',s.length, 'tieneTools', s.includes('detalle_servicio'))})" 2>/dev/null || echo "verificar manualmente con un servicio mock en test"
```

Expected: imprime una longitud y `tieneTools true`. (Si `tsx` no está, basta con que los tests de Step siguiente pasen.)

- [ ] **Step 4: Actualizar/añadir test de `buildFullSystemPrompt`**

En `tests/unit/formatServicioContext.test.ts`, añadir:

```typescript
it('buildFullSystemPrompt usa el índice liviano y describe las 3 tools en toolMode', () => {
  const prompt = buildFullSystemPrompt([], 'https://www.medellintransportes.com', true);
  expect(prompt).toContain('ÍNDICE DE SERVICIOS');
  expect(prompt).toContain('cotizar');
  expect(prompt).toContain('detalle_servicio');
  expect(prompt).toContain('buscar_servicio');
});
```

Run: `npx vitest run tests/unit/formatServicioContext.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/n8n/formatServicioContext.ts tests/unit/formatServicioContext.test.ts
git commit -m "feat(bot): system prompt usa índice liviano + describe 3 tools"
```

---

## Task 5: `buildServicioDetalle` (cuerpo de detalle_servicio) — test primero

**Files:**
- Create: `tests/unit/buildServicioDetalle.test.ts`
- Create: `lib/n8n/buildServicioDetalle.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/unit/buildServicioDetalle.test.ts
import { describe, it, expect } from 'vitest';
import { buildServicioDetalle } from '@/lib/n8n/buildServicioDetalle';
import type { ServicioContextData } from '@/lib/n8n/formatServicioContext';

const svc: ServicioContextData = {
  id: 'svc1', tipoServicio: 'OTRO',
  nombre: { es: 'Tour Guatapé', en: 'Guatapé Tour' },
  descripcion: { es: 'Día completo', en: 'Full day' },
  incluye: { es: 'Guía y transporte', en: 'Guide and transport' },
  duracion: '8h',
  aplicaRecargoNocturno: true, recargoNocturnoInicio: '22:00', recargoNocturnoFin: '06:00', montoRecargoNocturno: 50000,
  esPorHoras: false, esMunicipal: false, esAeropuerto: false, esCompartido: false, esTraslado: false,
  configuracion: { camposCustom: [{ clave: 'almuerzos', tipo: 'COUNTER', etiqueta: { es: 'Almuerzos', en: 'Lunches' }, requerido: false, orden: 1, min: 0, max: 10, tienePrecio: true, precioUnitario: 30000 }] } as any,
  vehiculosPermitidos: [{ precio: 350000, precioOlaya: null, vehiculo: { nombre: 'Van', capacidadMinima: 1, capacidadMaxima: 8 } }],
};

describe('buildServicioDetalle', () => {
  it('devuelve nombre, incluye, duración, recargo y adicionales con precio', () => {
    const d = buildServicioDetalle(svc, 'https://www.medellintransportes.com');
    expect(d.id).toBe('svc1');
    expect(d.nombre.es).toBe('Tour Guatapé');
    expect(d.incluye.es).toContain('Guía');
    expect(d.duracion).toBe('8h');
    expect(d.recargoNocturno.aplica).toBe(true);
    expect(d.recargoNocturno.monto).toBe(50000);
    expect(d.adicionales[0]).toMatchObject({ clave: 'almuerzos', precioUnitario: 30000 });
    expect(d.linkReserva).toContain('serviceId=svc1');
  });

  it('servicio no encontrado → null vía caller (función pura no rompe con campos vacíos)', () => {
    const minimal = { ...svc, configuracion: { camposCustom: [] }, aplicaRecargoNocturno: false } as ServicioContextData;
    const d = buildServicioDetalle(minimal, 'https://x');
    expect(d.adicionales).toEqual([]);
    expect(d.recargoNocturno.aplica).toBe(false);
  });
});
```

- [ ] **Step 2: Run para ver que falla**

Run: `npx vitest run tests/unit/buildServicioDetalle.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `lib/n8n/buildServicioDetalle.ts`**

```typescript
// lib/n8n/buildServicioDetalle.ts
import { getConfiguracion } from '@/types/servicio-config';
import { validateDynamicFields } from '@/types/dynamic-fields';
import type { ServicioContextData } from './formatServicioContext';

function asEsEn(value: unknown): { es: string; en: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return { es: typeof v.es === 'string' ? v.es : '', en: typeof v.en === 'string' ? v.en : '' };
  }
  return { es: '', en: '' };
}

export interface ServicioDetalle {
  id: string;
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  incluye: { es: string; en: string };
  duracion: string | null;
  esAeropuerto: boolean;
  esPorPersona: boolean;
  recargoNocturno: { aplica: boolean; inicio?: string | null; fin?: string | null; monto?: number | null };
  adicionales: { clave: string; etiqueta: string; tipo: string; precioUnitario: number }[];
  vehiculos: { nombre: string; capacidadMinima: number; capacidadMaxima: number }[];
  linkReserva: string;
}

export function buildServicioDetalle(svc: ServicioContextData, appUrl?: string): ServicioDetalle {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.medellintransportes.com').replace(/\/$/, '');
  const cfg = getConfiguracion(svc.configuracion);
  const campos = validateDynamicFields(cfg.camposCustom);
  const adicionales = campos
    .filter((c) => c.tienePrecio && c.precioUnitario && c.precioUnitario > 0)
    .map((c) => ({ clave: c.clave, etiqueta: c.etiqueta.es, tipo: c.tipo, precioUnitario: Number(c.precioUnitario) }));
  return {
    id: svc.id,
    nombre: asEsEn(svc.nombre),
    descripcion: asEsEn(svc.descripcion),
    incluye: asEsEn(svc.incluye),
    duracion: svc.duracion,
    esAeropuerto: !!svc.esAeropuerto,
    esPorPersona: cfg.tipoTarifa === 'POR_PERSONA',
    recargoNocturno: svc.aplicaRecargoNocturno && svc.montoRecargoNocturno
      ? { aplica: true, inicio: svc.recargoNocturnoInicio, fin: svc.recargoNocturnoFin, monto: Number(svc.montoRecargoNocturno) }
      : { aplica: false },
    adicionales,
    vehiculos: svc.vehiculosPermitidos.map((v) => ({
      nombre: v.vehiculo.nombre, capacidadMinima: v.vehiculo.capacidadMinima, capacidadMaxima: v.vehiculo.capacidadMaxima,
    })),
    linkReserva: `${base}/reservas?serviceId=${svc.id}&form=1`,
  };
}
```

- [ ] **Step 4: Run para ver que pasa**

Run: `npx vitest run tests/unit/buildServicioDetalle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/n8n/buildServicioDetalle.ts tests/unit/buildServicioDetalle.test.ts
git commit -m "feat(bot): buildServicioDetalle (cuerpo de detalle_servicio) con tests"
```

---

## Task 6: Endpoint `GET /api/public/servicio` (tool detalle_servicio)

**Files:**
- Create: `app/api/public/servicio/route.ts`

- [ ] **Step 1: Implementar la ruta**

```typescript
// app/api/public/servicio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveCatalogServices, toServicioContextData } from '@/lib/api/service-catalog';
import { buildServicioDetalle } from '@/lib/n8n/buildServicioDetalle';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const servicioId = searchParams.get('servicioId');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
    if (!servicioId) {
      return NextResponse.json({ status: 'falta_servicio', mensaje: 'Indica servicioId.' }, { headers: CORS });
    }
    const raw = await fetchActiveCatalogServices();
    const match = raw.find((s) => s.id === servicioId);
    if (!match) {
      return NextResponse.json({ status: 'no_encontrado', mensaje: 'No existe un servicio activo con ese id.' }, { headers: CORS });
    }
    const [ctx] = toServicioContextData([match]);
    return NextResponse.json({ status: 'ok', servicio: buildServicioDetalle(ctx, appUrl) }, { headers: CORS });
  } catch (error) {
    console.error('[public/servicio]', error);
    return NextResponse.json({ status: 'error', mensaje: 'No fue posible obtener el detalle.' }, { status: 200, headers: CORS });
  }
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

- [ ] **Step 3: Smoke local (build de ruta)**

Run: `npx next build 2>&1 | grep -E 'api/public/servicio|Failed to compile' | head`
Expected: la ruta aparece compilada, sin "Failed to compile". (Si no quieres build completo, basta el typecheck del Step 2.)

- [ ] **Step 4: Commit**

```bash
git add app/api/public/servicio/route.ts
git commit -m "feat(bot): endpoint /api/public/servicio (tool detalle_servicio)"
```

---

## Task 7: Endpoint `GET /api/public/buscar` (tool buscar_servicio) — test primero

**Files:**
- Modify: `lib/api/service-catalog.ts` (helper `searchCatalogServices`)
- Create: `app/api/public/buscar/route.ts`
- Create: `tests/integration/publicBuscar.test.ts`

- [ ] **Step 1: Escribir el test que falla (sobre el helper puro)**

```typescript
// tests/integration/publicBuscar.test.ts
import { describe, it, expect } from 'vitest';
import { searchCatalogServices } from '@/lib/api/service-catalog';
import type { CatalogService } from '@/lib/api/service-catalog';

const mk = (id: string, es: string, esMunicipal = false): CatalogService => ({
  id, tipo: 'OTRO', nombre: es, nombreES: es, nombreEN: es,
  descripcion: '', descripcionES: '', descripcionEN: '', incluye: null,
  precioDesde: 100000, tipoTarifa: null, preciosPorPersona: null, duracion: null,
  esAeropuerto: false, esPorHoras: false, esMunicipal, aplicaRecargoNocturno: false,
  recargoNocturno: { aplica: false }, configuracion: { camposCustom: [] },
  linkReserva: `https://x/reservas?serviceId=${id}&form=1`, vehiculos: [],
  precioOrigen: 'ServicioVehiculo.precio', tipoPrecio: 'independiente',
} as any);

describe('searchCatalogServices', () => {
  const catalogo = [mk('a', 'Tour a Guatapé'), mk('b', 'Traslado Jardín', true), mk('c', 'Traslado Urbano')];

  it('encuentra por coincidencia normalizada (sin acentos, case-insensitive)', () => {
    const r = searchCatalogServices(catalogo, 'guatape');
    expect(r.map((s) => s.id)).toContain('a');
  });

  it('devuelve forma liviana con id, nombre, categoría, precioDesde, esMunicipal', () => {
    const r = searchCatalogServices(catalogo, 'jardin');
    expect(r[0]).toMatchObject({ id: 'b', esMunicipal: true });
    expect(r[0]).toHaveProperty('precioDesde');
  });

  it('q vacío → lista vacía', () => {
    expect(searchCatalogServices(catalogo, '')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run para ver que falla**

Run: `npx vitest run tests/integration/publicBuscar.test.ts`
Expected: FAIL — `searchCatalogServices` no existe.

- [ ] **Step 3: Implementar el helper en `lib/api/service-catalog.ts`**

Añadir al final de `lib/api/service-catalog.ts`:

```typescript
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');
function normTxt(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING, '').trim();
}

export interface CatalogMatch {
  id: string;
  nombre: string;
  categoria: string;
  precioDesde: number;
  esMunicipal: boolean;
  linkReserva: string;
}

export function searchCatalogServices(servicios: CatalogService[], q: string): CatalogMatch[] {
  const nq = normTxt(q || '');
  if (!nq) return [];
  return servicios
    .filter((s) => {
      const es = normTxt(s.nombreES);
      const en = normTxt(s.nombreEN);
      return es.includes(nq) || en.includes(nq) || nq.includes(es);
    })
    .map((s) => ({
      id: s.id,
      nombre: s.nombreES,
      categoria: s.esMunicipal ? 'MUNICIPAL' : s.esAeropuerto ? 'AEROPUERTO' : s.tipoTarifa === 'POR_PERSONA' ? 'TOUR_PERSONA' : 'SERVICIO',
      precioDesde: s.precioDesde,
      esMunicipal: s.esMunicipal,
      linkReserva: s.linkReserva,
    }));
}
```

- [ ] **Step 4: Run para ver que pasa**

Run: `npx vitest run tests/integration/publicBuscar.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implementar la ruta `app/api/public/buscar/route.ts`**

```typescript
// app/api/public/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildCatalogJson } from '@/lib/api/service-catalog';
import { searchCatalogServices } from '@/lib/api/service-catalog';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.medellintransportes.com';
    if (!q.trim()) {
      return NextResponse.json({ status: 'falta_q', mensaje: 'Indica q (texto a buscar).', resultados: [] }, { headers: CORS });
    }
    const catalogo = await buildCatalogJson('ES', appUrl);
    const resultados = searchCatalogServices(catalogo.servicios as any, q);
    return NextResponse.json(
      { status: resultados.length ? 'ok' : 'no_encontrado', total: resultados.length, resultados },
      { headers: CORS }
    );
  } catch (error) {
    console.error('[public/buscar]', error);
    return NextResponse.json({ status: 'error', mensaje: 'No fue posible buscar.', resultados: [] }, { status: 200, headers: CORS });
  }
}
```

- [ ] **Step 6: Verificar typecheck + tests + smoke build**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

Run: `npx vitest run tests/integration/publicBuscar.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/api/service-catalog.ts app/api/public/buscar/route.ts tests/integration/publicBuscar.test.ts
git commit -m "feat(bot): endpoint /api/public/buscar (tool buscar_servicio) con tests"
```

---

## Task 8: Suite completa + desplegar

**Files:** ninguno (verificación).

- [ ] **Step 1: Toda la suite verde**

Run: `npx vitest run`
Expected: todos los archivos de `tests/` pasan (los nuevos + los previos de precios/categoría/cotizar).

- [ ] **Step 2: Typecheck producción limpio**

Run: `npx tsc --noEmit 2>&1 | grep -v '^tests/' | grep -c 'error TS'`
Expected: `0`

- [ ] **Step 3: Merge/deploy a producción**

Abrir PR de `feat/bot-contexto-por-capas` y mergear a `main` para que Vercel despliegue `www.medellintransportes.com`. **Esto debe ocurrir antes de la Task 9** (las tools n8n pegan a producción).

```bash
git push -u origin feat/bot-contexto-por-capas
gh pr create --title "feat(bot): contexto por capas (lean index + tools)" --body "Ver docs/superpowers/specs/2026-06-24-bot-contexto-por-capas-design.md"
```

- [ ] **Step 4: Smoke en producción tras deploy**

Verificar que los 3 endpoints responden (usar ctx_execute con fetch, NO curl):
- `GET /api/public/servicios?formato=contexto&tools=1` → `systemPrompt` contiene `ÍNDICE DE SERVICIOS`, `detalle_servicio`, y NO contiene los 119 municipios listados.
- `GET /api/public/servicio?servicioId=<id real>` → `status: ok` con `servicio.incluye`.
- `GET /api/public/buscar?q=guatape` → `status: ok` con resultados.

---

## Task 9: Wirear tools y consolidar workflows en n8n

**Contexto:** API n8n `https://n8n-production-9d890.up.railway.app/api/v1`, header `X-N8N-API-KEY`.
Workflows: producción `IH3vJWv9ZrnTrnVI` (YCloud), test `RdVs3G9KDSHruLSZ` (Chat de Prueba), legacy `lOXWAYlE0iDbBxcE` (WhatsApp Bot, endpoint viejo, sin cotizar).

> Ejecutar los fetch con `mcp__plugin_context-mode_context-mode__ctx_execute` (language javascript), nunca curl.

- [ ] **Step 1: Backup de los 3 workflows**

Script (ctx_execute, javascript): `GET /workflows/{id}` para los 3 ids y guardar el JSON a `docs/bot/n8n-backup-2026-06-24/<id>.json` (vía Write tool, no shell). Esto permite revertir.

- [ ] **Step 2: Añadir nodos tool `detalle_servicio` y `buscar_servicio` al workflow de producción y al de prueba**

Para `IH3vJWv9ZrnTrnVI` y `RdVs3G9KDSHruLSZ`: clonar el nodo existente `cotizar` (`@n8n/n8n-nodes-langchain.toolHttpRequest`) dos veces, cambiando:

- `detalle_servicio`: name=`detalle_servicio`, url=`https://www.medellintransportes.com/api/public/servicio`, query param `servicioId` (let the model fill), description=`Detalle profundo de UN servicio (qué incluye, adicionales, recargo, duración). Param: servicioId.`
- `buscar_servicio`: name=`buscar_servicio`, url=`https://www.medellintransportes.com/api/public/buscar`, query param `q` (let the model fill), description=`Busca servicios o municipios por texto. Param: q. Úsala para confirmar si un municipio existe y su id/link.`

Conectar ambos nodos al puerto `ai_tool` del AI Agent (en `connections`, replicar la entrada que ya tiene `cotizar` hacia el agente). Persistir con `PUT /workflows/{id}` enviando el objeto completo modificado.

Validación tras el PUT: `GET /workflows/{id}` y confirmar que `nodes` incluye `detalle_servicio` y `buscar_servicio`, y que `connections` los enlaza al agente igual que `cotizar`.

- [ ] **Step 3: Archivar el workflow legacy**

`POST /workflows/lOXWAYlE0iDbBxcE/deactivate` (ya está inactivo; idempotente) y renombrar a `[ARCHIVADO] TMT Travel - WhatsApp Bot` vía `PUT` para evitar confusión. No se borra el endpoint `/api/n8n/contexto-servicios` (puede usarlo otra cosa).

- [ ] **Step 4: Smoke real en "Chat de Prueba"**

Activar/ejecutar el workflow de prueba en n8n y enviar mensajes que cubran: descubrimiento ("¿qué tours tienen?"), detalle ("¿qué incluye el de Guatapé?" → debe llamar detalle_servicio), precio ("para 2 personas" → cotizar), ambigüedad Guatapé, aeropuerto (pregunta JMC/Olaya), municipio (no inventa precio, usa buscar_servicio), y entrega del link correcto. Registrar resultados.

- [ ] **Step 5: Commit del backup y notas**

```bash
git add docs/bot/n8n-backup-2026-06-24/ docs/bot-n8n-mejoras.md
git commit -m "chore(bot): backup n8n + notas de wireado de tools detalle_servicio/buscar_servicio"
```

---

## Self-Review (cubierto)

- **Capa 1 persona** → Task 1. **Capa 2 índice** → Tasks 3-4. **Capa 3 tools** → cotizar (existe) + Task 5-6 (detalle) + Task 7 (buscar).
- **Municipios fuera del inline** → Task 3 (entrada agrupada) + Task 7 (descubrimiento por tool).
- **Solo independientes** → endpoints reusan `service-catalog` (precio `ServicioVehiculo.precio`); ningún path de aliado.
- **Una sola fuente / fresco BD** → endpoints `force-dynamic`; n8n solo fetch+tools (Task 9).
- **Consolidar workflows + drift** → Task 9 Step 3.
- **Modelo sin cambios** → no se toca el nodo OpenRouter.
- **Pruebas** → Tasks 3,5,7 (unit/integration) + Task 8 (suite) + Task 9 Step 4 (smoke real).
