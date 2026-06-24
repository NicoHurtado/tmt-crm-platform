# Bot WhatsApp (n8n) — mejoras de precisión y herramienta de precios

Workflow: **TMT Travel - WhatsApp Bot YCloud** (n8n).
Endpoint de contexto que consume: `GET /api/public/servicios?formato=contexto`.

---

## Actualización 2026-06-24 — Contexto por capas (índice liviano + 3 tools)

Se reestructuró el contexto del bot en 3 capas con la BD como fuente única (diseño:
`docs/superpowers/specs/2026-06-24-bot-contexto-por-capas-design.md`):

- **Capa 1 — Persona** (`lib/n8n/persona.ts`): reglas/tono de Nico (estático, se despliega con la app).
- **Capa 2 — Índice liviano** (`lib/n8n/buildLeanIndex.ts`): 4-6 líneas por servicio (id, categoría,
  "Cuándo" de enrutamiento, "Desde $X"); los 119 municipios se colapsan en UNA entrada. Reemplaza el
  volcado de ~43k caracteres. Es lo que sirve `GET /api/public/servicios?formato=contexto&tools=1`.
- **Capa 3 — Tools** conectadas al agente (puerto *ai_tool*):
  | Tool | Endpoint | Uso |
  |------|----------|-----|
  | `cotizar` | `/api/public/cotizar` | Precio EXACTO (ya existía). |
  | `detalle_servicio` | `/api/public/servicio?servicioId=` | Detalle de UN servicio (incluye, adicionales, recargo, vehículos). |
  | `buscar_servicio` | `/api/public/buscar?q=` | Busca servicios/municipios por texto (cubre los 119 municipios sin inlinearlos). |

**Estado de los workflows (wireados vía API n8n el 2026-06-24):**
- `TMT Travel - WhatsApp Bot YCloud` (prod, agente "Mía AI Agent") → 3 tools.
- `TMT Travel - Chat de Prueba` (test, agente "AI Agent") → 3 tools.
- `TMT Travel - WhatsApp Bot` (legacy, endpoint viejo `/api/n8n/contexto-servicios`) → **archivado**.

Backups previos al cambio: `docs/bot/n8n-backup-2026-06-24/<workflowId>.json`.

---

## Cómo funciona hoy (correcto)
- El nodo **Fetch Contexto** trae el catálogo y reglas.
- El nodo **Mía AI Agent** usa **solo** `systemPrompt` como system message (no inyecta el JSON `servicios`). Sin duplicación.
- El prompt se reconstruye **fresco desde la BD en cada mensaje** (el caché solo se usa si la BD falla).

## Estado actual y orden recomendado

### 1. Desplegar el código (imprescindible)
Producción corre código viejo. Tras `merge`/deploy a `www.medellintransportes.com`, el bot:
- Deja de confundir Guatapé (pregunta cuál de los servicios reales: traslado sólo ida, tour, tour compartido).
- Muestra **dos precios de aeropuerto** (José María Córdova | Olaya Herrera) y pregunta cuál antes de cotizar.

Datos ya cargados en la BD (no requieren deploy):
- Precios Olaya independientes (los que ve el bot) en el servicio de aeropuerto.
- Precios + comisión Olaya por aliado (HOTEL/AIRBNB 12%, AGENCIA 0%).

### 2. Cambiar el modelo (mayor impacto en precisión)
En el nodo **OpenRouter GPT**, cambiar `openai/gpt-oss-120b:free` por un modelo fuerte en seguir
instrucciones (GPT-4-class o Claude Sonnet). Es el cambio individual de mayor impacto.

> Mientras tanto el bot funciona con gpt-oss-120b usando los precios inline del prompt (sin la tool).

### 3. Activar la herramienta de precios `cotizar` (garantía dura — hacer cuando el modelo sea fuerte)

Es **aditivo**: no reescribe el flujo. Pasos en n8n:

1. **Cambiar la URL del nodo Fetch Contexto** a:
   `https://www.medellintransportes.com/api/public/servicios?formato=contexto&tools=1`
   (el `&tools=1` agrega al prompt las instrucciones de usar la herramienta y el ID de cada servicio).

2. **Agregar un nodo de herramienta** conectado al puerto *Tool* del **Mía AI Agent**:
   - Tipo: **HTTP Request Tool** (`@n8n/n8n-nodes-langchain.toolHttpRequest`).
   - **Name (importante, el modelo lo invoca por este nombre):** `cotizar`
   - **Description:** `Devuelve el precio EXACTO de un servicio para clientes independientes. Úsala SIEMPRE antes de dar un precio. Parámetros: servicioId (o tipo, o q), pax (nº personas), aeropuerto (JOSE_MARIA_CORDOVA u OLAYA_HERRERA si es aeropuerto).`
   - **Method:** GET
   - **URL:** `https://www.medellintransportes.com/api/public/cotizar`
   - **Query parameters** (definir como "let the model fill", es decir parámetros del tool):
     - `servicioId` (string, opcional) — id del servicio (aparece en el prompt como "ID del servicio").
     - `tipo` (string, opcional) — TipoServicio, alternativa a servicioId.
     - `q` (string, opcional) — texto del servicio, última alternativa.
     - `pax` (number) — número de personas.
     - `aeropuerto` (string, opcional) — `JOSE_MARIA_CORDOVA` | `OLAYA_HERRERA`.
     - `hora` (string, opcional) — `HH:mm` para informar recargo nocturno.

3. Guardar y probar.

#### Respuestas de `cotizar` (campo `status`)
| status | significado | qué hace el bot |
|--------|-------------|-----------------|
| `ok` | precio encontrado | da `precioFormateado` + `linkReserva` |
| `ambiguo` | varios servicios coinciden | pregunta cuál (lista en `opciones`) |
| `falta_pax` | falta nº personas | pregunta cuántas personas |
| `falta_aeropuerto` | aeropuerto sin especificar | pregunta JMC u Olaya |
| `municipio` | traslado municipal | sin precio; envía link (va en el formulario) |
| `fuera_de_rango` | ningún vehículo cubre el grupo | ofrece asesor |
| `no_encontrado` / `falta_servicio` | no hay match | pregunta a qué servicio se refiere |

#### Ejemplos de llamada
```
GET /api/public/cotizar?servicioId=cmihxd4vy00159svu4opysoho&pax=2&aeropuerto=OLAYA_HERRERA
GET /api/public/cotizar?q=guatape            -> status: ambiguo (3 opciones)
GET /api/public/cotizar?tipo=TOUR_GUATAPE&pax=4
```

## Por qué esto cumple los objetivos
- **No inventa precios:** con `tools=1` el precio sale solo de `cotizar` (DB), no de la memoria del modelo.
- **Sin ambigüedad:** `cotizar` devuelve `ambiguo`/`falta_*` y el bot queda obligado a preguntar.
- **Menos ruido:** el modelo no depende de "leer bien" un bloque gigante para el precio.
- **Siempre actualizado:** precios y servicios vienen de la BD en cada consulta.
