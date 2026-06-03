# Análisis del contexto del bot + recomendaciones

> Contexto crudo completo (lo que el bot recibe en CADA mensaje):
> [`docs/bot/contexto-actual-bot.txt`](./contexto-actual-bot.txt)
> Fuente: `GET /api/public/servicios?formato=contexto` → generado por `lib/n8n/formatServicioContext.ts`

## 1. Cómo llega el contexto hoy

| | |
|---|---|
| Tamaño | ~43.000 caracteres · 553 líneas |
| `totalServicios` | **141** (≈22 servicios reales + 119 municipios sueltos) |
| Orden | `NICO_PERSONA` (reglas) → `CATÁLOGO` (servicios) → `RECORDATORIO FINAL` |

**Estructura:**
1. **Reglas (arriba):** Idioma, Personalidad, Misión, Cómo responder, **PRECIOS (3 reglas de oro)**, Ejemplos de tono, Reglas de contenido, Cuándo enviar link, Escalación.
2. **Catálogo:** cabecera con "EXACTAMENTE 141 servicios" + cada servicio con `## CATEGORÍA`, link, nombre ES/EN, descripción, vehículos+precios, info adicional, recargo nocturno.
3. **Sección municipal:** 1 servicio "Traslados a Municipios" + **119 municipios como `nombre: ID`** (sin precio).
4. **Recordatorio final (abajo):** repite las reglas críticas.

El diseño es correcto: reglas importantes al **inicio y al final** (primacía + recencia). El problema no es el orden, son **ambigüedades concretas** en los datos y la falta de un **mapa de enrutamiento** servicio↔intención.

---

## 2. Problemas detectados (causa de confusiones e invenciones)

### 🔴 A. Categorías `## OTRO` — ruido que confunde
14+ servicios salen con cabecera `## OTRO` (Traslado URBANO, Traslado Guatapé, Full Day Jardín, Transporte Concierto, etc.). La cabecera debería ayudar a clasificar; "OTRO" no aporta nada y mete ruido.
**Origen:** `formatOneSvc` usa `svc.tipoServicio`, y en la BD muchos tienen `tipoServicio = OTRO`.

### 🔴 B. Destinos duplicados con varias modalidades → ambigüedad
- **Guatapé tiene 3 servicios:** `Tour compartido Guatapé`, `Tour a Guatapé y El Peñol`, `Traslado Guatapé (sólo ida)`. (Causa del bug de los $600k vs $900k.)
- **Aeropuerto vs Urbano vs Municipal** se confunden cuando el cliente da una dirección. (Causa del bug de hoy.)
El bot no tiene un criterio explícito de "qué palabra del cliente → qué servicio". Lo dejamos a su criterio → se equivoca.

### 🔴 C. Sección municipal peligrosa para inventar precios
Dice: *"VEHÍCULOS DISPONIBLES (precio varía por destino — dar precio al cliente solo si lo piden)"* … pero **NO hay precios listados**. Si un cliente pide precio de un municipio, el bot **no tiene el dato y puede inventarlo**. La instrucción "dar precio solo si lo piden" es contradictoria (no hay precio que dar).

### 🟠 D. Datos sucios en la BD
Typos ("aporx", "aproximadamente" inconsistente), dobles espacios, descripciones que repiten el inglés en el campo español ("Traslado URBANO" → Description EN está en español). No rompe nada pero baja la percepción de calidad y puede confundir el idioma.

### 🟠 E. Recargo nocturno solo visible en Aeropuerto
Si otros servicios tienen recargo en la BD pero el flag no está, el bot nunca lo menciona → cotiza de menos. Verificar qué servicios deberían tenerlo.

### 🟠 F. Falta una regla anti-invención de procesos
El bot solo tiene reglas sobre precios/servicios, pero no una regla dura de **"no inventes procesos"** (formas de pago que no existen, descuentos, tiempos de confirmación, políticas). Conviene explicitarlo.

---

## 3. Recomendaciones (de mayor a menor impacto)

### ✅ R1 — Tabla de enrutamiento intención → servicio (lo más importante)
Agregar al prompt, justo antes del catálogo, una **tabla corta y determinista** que mapee lo que dice el cliente al servicio exacto. Elimina el 90% de las confusiones. Ejemplo:

```
## CÓMO ELEGIR EL SERVICIO (enrutamiento obligatorio)
- "aeropuerto", "vuelo", "llegada", "salida", "José María Córdova", "JMC", "Rionegro (aeropuerto)" → Traslado Privado Aeropuerto.
- Moverse DENTRO de Medellín, un solo trayecto entre dos puntos urbanos → Traslado URBANO.
- Un municipio de Antioquia (Guatapé, Santa Fe, Jardín, Jericó…) → su Tour o Traslado específico SI existe; si no, "Traslados a Municipios de Antioquia".
- Guatapé: SIEMPRE preguntar si es Traslado (solo ida), Tour día completo, o Tour compartido.
- Una dirección, barrio u hotel NUNCA define el servicio por sí sola: es solo el punto de recogida. Pregunta el DESTINO.
```

### ✅ R2 — Arreglar la sección municipal (anti-invención de precios)
Cambiar el texto a algo inequívoco:
```
VEHÍCULOS: el precio de estos municipios NO está en este catálogo y VARÍA por destino.
NUNCA des un precio para estos municipios. Si preguntan precio, responde que se calcula
en el formulario de reserva y envía el link del municipio. No estimes ni inventes.
```

### ✅ R3 — Reemplazar `## OTRO` por el nombre del servicio
En `formatOneSvc`, cuando `tipoServicio` sea `OTRO` (o falte label), usar el **Nombre ES** como cabecera. Cabeceras con sentido = menos ruido, mejor recuperación. (Cambio de 1 línea en el código.)

### ✅ R4 — Regla dura anti-invención de procesos
Añadir a "Reglas de contenido":
```
- NUNCA inventes procesos, políticas, descuentos, formas de pago, tiempos ni condiciones.
  Solo afirmas lo que está escrito en este prompt. Si no está, dilo claro u ofrece un asesor.
```

### ✅ R5 — Regla de "una pregunta a la vez" + confirmación antes del link
Para que sea directo y sin errores con el link:
```
- Antes de enviar el link, confirma en una frase el servicio + nº de personas que entendiste.
  Ej: "Entonces: Traslado al Aeropuerto para 4 personas, ¿correcto? Te paso el link 👇"
```

### 🛠️ R6 — Limpieza de datos en la BD (no es código)
- Corregir typos y campos EN que están en español (Traslado URBANO, etc.).
- Revisar qué servicios deben tener recargo nocturno activo.
- Estandarizar nombres de servicios para que el enrutamiento (R1) sea limpio.

---

## 4. Prioridad sugerida
1. **R1 + R2 + R4** (cambios de prompt, alto impacto, bajo riesgo) → desplegar ya.
2. **R3** (1 línea de código) → siguiente deploy.
3. **R5** (prompt, mejora UX) → junto con R1.
4. **R6** (limpieza BD) → cuando haya tiempo, mejora calidad general.
