# Bot WhatsApp — Contexto por capas (lean index + tools)

**Fecha:** 2026-06-24
**Estado:** Aprobado (diseño) — pendiente de plan de implementación
**Alcance:** Servidor (app) + workflows n8n

## Problema

El bot de WhatsApp (n8n) recibe, en **cada mensaje**, el system prompt completo generado por
`GET /api/public/servicios?formato=contexto&tools=1` (`lib/n8n/formatServicioContext.ts`).
Hoy ese prompt vuelca **todo el detalle de ~22 servicios + 119 municipios** (~43.000 caracteres):
tablas de vehículos con precios, campos dinámicos/adicionales, recargos y la lista completa de
municipios. Esto:

- **Infla el contexto** y diluye las reglas → más confusión y errores del modelo.
- Mezcla "datos para conversar/enrutar" con "datos para calcular precio" (que ya resuelve la tool `cotizar`).
- Hace que los 119 municipios compitan como ruido con los servicios reales.

Lo que **ya está bien** y se conserva:
- El servidor es la **fuente única**: el prompt se reconstruye **fresco desde la BD en cada mensaje**
  (caché 5 min solo como fallback si la BD falla). Nada quemado en n8n.
- La tool `cotizar` (`/api/public/cotizar`) da el **precio exacto determinista** desde BD.
- La persona/reglas de Nico viven en código y se despliegan con la app.

## Objetivo

Reestructurar el contexto del bot en **3 capas** para que sea liviano, organizado, fresco desde BD,
mantenible y con buen funcionamiento — **sin** depender de que el modelo (hoy `gpt-oss-120b:free`,
débil) llame tools de forma confiable. Las tools son mejora aditiva; el índice inline basta para una
conversación útil.

## Restricciones / decisiones tomadas

- **Modelo:** se mantiene `gpt-oss-120b:free` por ahora. El diseño debe **degradar bien sin tools**
  (la Capa 2 sola permite conversar y enrutar). Solo `cotizar` sigue siendo obligatoria para precio.
- **Independientes solamente:** el contexto del bot expone únicamente precios públicos
  (`ServicioVehiculo.precio`, `tipoPrecio = 'independiente'`). **Ningún dato de aliados/hoteles/agencias.**
- **Una sola fuente:** todo el contenido se construye server-side. n8n solo hace fetch + wirea tools.

## Arquitectura: 3 capas

```
Capa 1 — PERSONA + REGLAS   (estática, código, se despliega con la app)
Capa 2 — ÍNDICE LIVIANO     (fresco desde BD, inline en el prompt)
Capa 3 — DETALLE A DEMANDA  (tools que pegan a la BD: cotizar · detalle_servicio · buscar_servicio)
```

### Capa 1 — Persona + reglas
- Contenido sin cambios: `NICO_PERSONA` + `NICO_RECORDATORIO_FINAL` (idioma, tono, anti-invención,
  escalación, formato de link, protocolo de precios, "Cómo elegir el servicio / enrutamiento").
- Se extrae a `lib/n8n/persona.ts` (solo reorganización, sin cambiar el texto).

### Capa 2 — Índice liviano (reemplaza el volcado del catálogo)
Por cada servicio, **4–6 líneas** en lugar de ~20. Formato:

```
### <NOMBRE> · id:<id> · <CATEGORÍA>
Cuándo: <hint de enrutamiento, 1 línea — cuándo este servicio es el correcto>
<gancho/descripción corta, 1 línea>
Desde: <precioDesde formateado> (<por persona | por vehículo | varía por destino>) · Dura: <duracion>
⚠️ Para detalle/precio exacto usa las tools (cotizar / detalle_servicio)
```

Reglas por categoría:
- **Aeropuerto:** añadir línea `⚠️ pregunta JMC u Olaya antes de cotizar` (mantiene el comportamiento
  dual de precio).
- **Por persona (`tipoTarifa = POR_PERSONA`):** `Desde: $X (por persona)`; no se mencionan vehículos.
- **Municipios (`TRANSPORTE_MUNICIPAL`):** NO se listan los 119. **Una sola entrada agrupada**:
  > Traslados a municipios de Antioquia — el precio **varía por destino**, **NO lo inventes**.
  > Usa `buscar_servicio` para confirmar el destino y su id, y `cotizar` para el estado/link.

`CATEGORÍA` viene de `categoriaDeServicio()` (fuente única ya existente), no del enum legacy `OTRO`.
`Cuándo` (hint de enrutamiento): ver "Datos del hint" abajo.

Lo que **sale del inline** (pasa a tools): tablas vehículo×precio, campos dinámicos/adicionales,
recargo nocturno detallado, y la lista de municipios.

### Capa 3 — Tools (contrato server-side)

| Tool | Endpoint | Devuelve |
|---|---|---|
| `cotizar` | `GET /api/public/cotizar` (existe) | Precio exacto + `linkReserva` + `status` (ok/ambiguo/falta_pax/falta_aeropuerto/municipio/fuera_de_rango/no_encontrado). **Sin cambios.** |
| `detalle_servicio` | **NUEVO** `GET /api/public/servicio?servicioId=` | Un servicio: nombre ES/EN, descripción completa, incluye, duración, vehículos (cap), adicionales (campos con precio), recargo nocturno, `linkReserva`. Para preguntas profundas ("¿qué incluye?", "¿tiene recargo?"). |
| `buscar_servicio` | **NUEVO** `GET /api/public/buscar?q=` | Lista de coincidencias `{ id, nombre, categoria, precioDesde, esMunicipal }`. Cubre descubrimiento general y los 119 municipios sin inlinearlos. |

- Todos **públicos** (sin API key), CORS abierto, `dynamic = 'force-dynamic'`, caché in-memory + fallback
  igual que `/api/public/servicios`.
- Solo precios **independientes** (`ServicioVehiculo.precio`). Nunca aliados.
- Superficie mínima (3 tools) para no abrumar al modelo débil.

## Refactor server-side

`lib/n8n/formatServicioContext.ts` (hoy monolítico) se separa en unidades de un solo propósito:

- `lib/n8n/persona.ts` → `NICO_PERSONA`, `NICO_RECORDATORIO_FINAL` (texto sin cambios).
- `lib/n8n/buildLeanIndex.ts` → `buildLeanIndex(servicios): string` (Capa 2).
- `lib/n8n/buildServicioDetalle.ts` → `buildServicioDetalle(servicio): object` (cuerpo de `detalle_servicio`).
- `buildFullSystemPrompt(servicios, appUrl, toolMode)` = `persona + buildLeanIndex + recordatorio`
  (+ bloque de instrucciones de tools cuando `toolMode`). Es lo que sirve `?formato=contexto`.
- `formato=json` (catálogo estructurado completo) y `formato=texto` (catálogo humano legible) **se conservan**
  para otros consumidores/documentación — no los consume el bot.

### Datos del hint `Cuándo`
El hint de enrutamiento por servicio se deriva de la categoría + flags (aeropuerto/municipal/compartido/
por-persona) con una plantilla determinista; para tours específicos se usa el nombre del servicio. No se
inventa: si no hay señal clara, el hint es el nombre del servicio. (Las reglas globales de enrutamiento
—"aeropuerto ≠ urbano", "Guatapé pregunta cuál"— siguen en la Capa 1, que ya las tiene.)

## n8n (parte "establecer")

- **Consolidar workflows:**
  - `TMT Travel - WhatsApp Bot YCloud` (id `IH3vJWv9ZrnTrnVI`) = **producción**.
  - `TMT Travel - Chat de Prueba` (id `RdVs3G9KDSHruLSZ`) = **test**.
  - `TMT Travel - WhatsApp Bot` (id `lOXWAYlE0iDbBxcE`) apunta a endpoint legacy
    `/api/n8n/contexto-servicios` y no tiene `cotizar` → **archivar/eliminar** (verificar primero que no
    esté en uso).
- **Wirear las 2 tools nuevas** (`detalle_servicio`, `buscar_servicio`) al puerto *Tool* del AI Agent en
  producción y test, vía API pública de n8n (HTTP Request Tool, `let the model fill` los parámetros).
- `Fetch Contexto` permanece en `?formato=contexto&tools=1` (ahora liviano).
- **Modelo:** se mantiene `gpt-oss-120b:free`.
- Actualizar el bloque de instrucciones de tools en `toolMode` para describir las 3 tools (no solo `cotizar`).

## Pruebas

- **Vitest (unit):** `buildLeanIndex` (snapshot + casos por-persona / aeropuerto-dual / municipal agrupado),
  `buildServicioDetalle`, y la ruta `/api/public/buscar`.
- Se mantienen verdes los tests de `cotizar`, `recalcularPrecioWebDirecto`, `servicioCategoria`.
- **Smoke real:** correr el "Chat de Prueba" en n8n tras wirear y validar: descubrimiento, detalle, precio,
  ambigüedad de Guatapé, aeropuerto JMC/Olaya, municipio sin inventar precio, y entrega del link correcto.

## Criterios de éxito

1. El prompt de `?formato=contexto` baja sustancialmente de tamaño (objetivo: índice ≤ ~10k chars vs ~43k hoy),
   sin perder capacidad de enrutar ni de conversar.
2. Con el modelo actual (sin garantía de tools), el bot aún describe servicios, da "desde $X" y envía el link
   correcto usando solo la Capa 2.
3. El precio exacto sigue saliendo de `cotizar` (BD), nunca de la memoria del modelo.
4. Ningún dato de aliados aparece en el contexto del bot.
5. Cambiar un precio/servicio en la BD se refleja sin tocar n8n ni el prompt.
6. n8n queda con 1 producción + 1 test, sin el workflow legacy/drift.

## Fuera de alcance (YAGNI por ahora)

- Cambiar el modelo (lo evalúa el usuario después de ver el comportamiento).
- Mover la persona a un CMS editable (SiteContent) — posible mejora futura.
- Reescribir el flujo de audio/escalación/YCloud (se conserva).
