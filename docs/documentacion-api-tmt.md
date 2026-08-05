# Documentación API TMT

**Transportes Medellín Travel — API de traslados al aeropuerto para socios**

Esta guía tiene todo lo necesario para integrarse: credenciales, endpoints, formatos
exactos de cada campo, errores y cómo manejarlos, y una lista de verificación final.

---

## Índice

1. [Qué hace esta API](#1-qué-hace-esta-api)
2. [Credenciales](#2-credenciales)
3. [Datos generales](#3-datos-generales)
4. [Endpoint 1 — Consultar precio](#4-endpoint-1--consultar-precio)
5. [Endpoint 2 — Crear la reserva](#5-endpoint-2--crear-la-reserva)
6. [Formato exacto de cada campo](#6-formato-exacto-de-cada-campo)
7. [Cómo se calcula el precio](#7-cómo-se-calcula-el-precio)
8. [Errores y cómo manejarlos](#8-errores-y-cómo-manejarlos)
9. [Reintentos e idempotencia](#9-reintentos-e-idempotencia)
10. [Qué pasa después de crear la reserva](#10-qué-pasa-después-de-crear-la-reserva)
11. [Fuera de alcance](#11-fuera-de-alcance)
12. [Lista de verificación](#12-lista-de-verificación)
13. [Ejemplo completo de integración](#13-ejemplo-completo-de-integración)

---

## 1. Qué hace esta API

Permite que tu plataforma venda traslados al aeropuerto en Medellín. Tú atiendes al
huésped y le cobras; nosotros prestamos el servicio.

```
1. Tu huésped llena el formulario en tu plataforma
2. Nos consultas el precio          →  POST /api/socios/cotizar
3. Tu huésped paga en TU pasarela      (nosotros no intervenimos)
4. Nos envías la reserva            →  POST /api/socios/reservas
5. Nosotros asignamos conductor y prestamos el servicio
```

**Puntos clave:**

- Son **dos llamadas**, nada más. No hay sesiones, tokens que expiren ni estado que
  mantener entre una y otra.
- **El precio que te damos es lo que TMT te cobra a ti.** Lo que le cobres a tu huésped
  (con tu margen) es decisión tuya; nosotros no lo sabemos ni nos importa.
- **Tú cobras, tú te quedas con el dinero del huésped.** La liquidación entre nosotros se
  hace por fuera de la API, según lo acordado comercialmente.
- La reserva nos llega **ya pagada**. Nuestro conductor no le cobra nada al huésped.
- Cotizar **no reserva ni bloquea nada** y no caduca. Puedes cotizar las veces que
  quieras.

---

## 2. Credenciales

La autenticación es un header en cada petición:

```
x-api-key: TU_LLAVE
```

Recibes **dos llaves**. Las dos funcionan igual y escriben en el mismo sistema.

### Llave de pruebas

Úsala durante todo el desarrollo. Las reservas que crees con ella quedan marcadas aparte
para que podamos identificarlas y borrarlas cuando termines de integrar.

```
e27144f80be2fffd5a8f3c103ea8c720d8fa7c50d68896157c76b9aca2204b47
```

### Llave de producción

Cámbiala solo cuando hayas pasado la [lista de verificación](#12-lista-de-verificación).

```
f737ae5fc3f1817836a88960ee269143ec0c17029d2bb89fc9a2948c6b89efea
```

> **Importante:** estas llaves dan permiso para crear reservas a nombre de tu empresa.
> Guárdalas como una contraseña: en variables de entorno del servidor, nunca en el código
> fuente, nunca en un repositorio y **nunca en el navegador**. Todas las llamadas a esta
> API deben salir desde tu backend, jamás desde el JavaScript de tu página — si la llave
> viaja al navegador, cualquiera puede verla y usarla.
>
> Si sospechas que una llave se filtró, avísanos: la desactivamos al instante y te damos
> una nueva.

---

## 3. Datos generales

| | |
|---|---|
| **URL base** | `https://www.medellintransportes.com` |
| **Método** | `POST` en los dos endpoints (un `GET` responde `405`) |
| **Content-Type** | `application/json` |
| **Autenticación** | Header `x-api-key` |
| **Moneda** | COP (pesos colombianos), **enteros sin decimales** |
| **Zona horaria** | Colombia (UTC−5). Las horas que envías son hora local de Medellín |
| **Límite de peticiones** | No hay |

El servicio disponible es el **traslado privado al aeropuerto**, en los dos sentidos, para
los dos aeropuertos de Medellín. Su identificador es fijo:

```
servicioId = cmihxd4vy00159svu4opysoho
```

Guárdalo como constante en tu código. Si algún día cambiara, te avisamos con anticipación.

---

## 4. Endpoint 1 — Consultar precio

```
POST https://www.medellintransportes.com/api/socios/cotizar
```

Llámalo cuando el huésped ya eligió pasajeros, hora y aeropuerto, y necesitas mostrarle
el precio.

### Campos del request

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `servicioId` | string | Sí | Siempre `cmihxd4vy00159svu4opysoho` |
| `numeroPasajeros` | entero > 0 | Sí | Determina qué vehículo se asigna |
| `hora` | string `HH:MM` | Sí | Hora del servicio, 24 horas. Determina el recargo nocturno |
| `aeropuertoNombre` | string | Sí | `JOSE_MARIA_CORDOVA` o `OLAYA_HERRERA` |

### Ejemplo

```bash
curl -X POST https://www.medellintransportes.com/api/socios/cotizar \
  -H "x-api-key: TU_LLAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "servicioId": "cmihxd4vy00159svu4opysoho",
    "numeroPasajeros": 2,
    "hora": "23:30",
    "aeropuertoNombre": "JOSE_MARIA_CORDOVA"
  }'
```

### Respuesta `200`

```json
{
  "ok": true,
  "servicioId": "cmihxd4vy00159svu4opysoho",
  "servicioNombre": "Traslado Privado Aeropuerto",
  "vehiculo": {
    "id": "test-vehiculo-1",
    "nombre": "Auto 1 - 3",
    "capacidadMinima": 1,
    "capacidadMaxima": 3
  },
  "desglose": {
    "precioBase": 140000,
    "precioAdicionales": 0,
    "recargoNocturno": 20000,
    "tarifaMunicipio": 0
  },
  "total": 160000,
  "moneda": "COP"
}
```

### Qué hacer con la respuesta

| Campo | Para qué te sirve |
|---|---|
| `total` | **El número que importa.** Es lo que TMT te cobra, por el vehículo completo (no por persona). Súmale tu margen y muéstraselo a tu huésped |
| `vehiculo.nombre` | Puedes mostrarlo: “Auto”, “Van”, etc. |
| `vehiculo.capacidadMaxima` | Útil si quieres mostrar “hasta N pasajeros” |
| `desglose` | Informativo. Si quieres detallar el precio al huésped, úsalo. **No necesitas sumarlo tú** — `total` ya lo trae sumado |
| `moneda` | Siempre `"COP"` |

> **No guardes una tabla de precios de tu lado.** Nuestras tarifas pueden cambiar.
> Cotiza siempre antes de cobrarle a tu huésped y usa el `total` que te devolvemos.

---

## 5. Endpoint 2 — Crear la reserva

```
POST https://www.medellintransportes.com/api/socios/reservas
```

Llámalo **después** de que tu huésped pagó. Antes no.

El precio **se vuelve a calcular en nuestro servidor**. No aceptamos un precio enviado por
ti: si lo mandas en el cuerpo, lo ignoramos. Con los mismos datos, el total será idéntico
al que te dio `cotizar`.

### Campos del request

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `refExterna` | string | Sí | El identificador de esta reserva **en tu sistema**. Debe ser único por reserva. Es la clave de la idempotencia — ver [sección 9](#9-reintentos-e-idempotencia) |
| `servicioId` | string | Sí | Siempre `cmihxd4vy00159svu4opysoho` |
| `numeroPasajeros` | entero > 0 | Sí | El mismo que usaste al cotizar |
| `fecha` | string `YYYY-MM-DD` | Sí | Fecha del servicio |
| `hora` | string `HH:MM` | Sí | Hora del servicio, 24 horas |
| `aeropuertoNombre` | string | Sí | `JOSE_MARIA_CORDOVA` o `OLAYA_HERRERA` |
| `aeropuertoTipo` | string | Sí | `DESDE` o `HACIA` — ver abajo |
| `lugarRecogida` | string | Sí | Dirección del alojamiento, **en los dos sentidos** |
| `nombreCliente` | string | Sí | Nombre del huésped |
| `whatsappCliente` | string | Sí | Con indicativo de país. El conductor lo usa para coordinar |
| `emailCliente` | string | Sí | Ahí le llega la confirmación con el código |
| `numeroVuelo` | string | No | **Muy recomendado.** Nos permite ajustar la recogida si el vuelo se retrasa |
| `idioma` | string | No | `ES` o `EN`. Idioma de los correos al huésped. Por defecto `ES` |
| `notas` | string | No | Lo que el conductor deba saber |

### `aeropuertoTipo` y `lugarRecogida`

Es el par que más confusión genera. Léelo con calma:

| `aeropuertoTipo` | Qué significa | De dónde sale | A dónde llega | Qué va en `lugarRecogida` |
|---|---|---|---|---|
| `DESDE` | **Llegada.** El huésped aterriza | Del aeropuerto | Al alojamiento | La dirección **del alojamiento** |
| `HACIA` | **Salida.** El huésped se va | Del alojamiento | Al aeropuerto | La dirección **del alojamiento** |

> En los dos casos `lugarRecogida` es la **dirección del alojamiento**, nunca el
> aeropuerto. El aeropuerto ya lo sabemos por `aeropuertoNombre`. Nosotros deducimos el
> sentido del trayecto a partir de `aeropuertoTipo`.

### Ejemplo

```bash
curl -X POST https://www.medellintransportes.com/api/socios/reservas \
  -H "x-api-key: TU_LLAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "refExterna": "reserva-88213",
    "servicioId": "cmihxd4vy00159svu4opysoho",
    "numeroPasajeros": 2,
    "fecha": "2026-09-14",
    "hora": "23:30",
    "aeropuertoNombre": "JOSE_MARIA_CORDOVA",
    "aeropuertoTipo": "DESDE",
    "lugarRecogida": "Cra 43A #7-50, Apto 1204, El Poblado",
    "numeroVuelo": "AV8432",
    "nombreCliente": "Juan Pérez",
    "whatsappCliente": "+573001234567",
    "emailCliente": "juan@ejemplo.com",
    "idioma": "ES",
    "notas": "Llega con 2 maletas grandes"
  }'
```

### Respuesta `201`

```json
{
  "ok": true,
  "duplicado": false,
  "codigo": "K7M2P9QX",
  "estado": "CONFIRMED_UNASSIGNED",
  "fecha": "2026-09-14",
  "hora": "23:30",
  "numeroPasajeros": 2,
  "vehiculo": "Auto 1 - 3",
  "total": 160000,
  "moneda": "COP",
  "tracking": "https://www.medellintransportes.com/tracking/K7M2P9QX"
}
```

### Qué hacer con la respuesta

| Campo | Qué hacer |
|---|---|
| `codigo` | **Guárdalo en tu base de datos.** Son 8 caracteres y es el identificador de la reserva en TMT. Es lo que usamos los dos para hablar de esta reserva |
| `tracking` | **Muéstraselo a tu huésped.** Ahí ve el estado del traslado y los datos del conductor cuando se le asigne. También te sirve a ti para consultar |
| `estado` | Siempre `CONFIRMED_UNASSIGNED` en una reserva nueva. Significa **confirmada, pendiente de asignar conductor**. Es lo normal, no es un error ni algo que debas resolver |
| `duplicado` | `false` si se creó ahora, `true` si ya existía — ver [sección 9](#9-reintentos-e-idempotencia) |
| `total` | El precio final. Debería coincidir con el de `cotizar` |

---

## 6. Formato exacto de cada campo

Esta tabla está construida probando la API real, no por escrito de memoria. Si respetas
esto, no vas a tener errores de formato.

### `servicioId`

| | |
|---|---|
| **Válido** | Exactamente `cmihxd4vy00159svu4opysoho` |
| **Se rechaza** | Cualquier otro valor, vacío o ausente |
| **Error** | `Servicio no encontrado o inactivo` / `servicioId es requerido` |

### `numeroPasajeros`

| | |
|---|---|
| **Válido** | Entero de 1 a 40. Como número (`2`) o como texto (`"2"`, `"02"`, `" 2 "`) |
| **Se rechaza** | `0`, negativos, decimales (`2.5`), texto no numérico (`"dos"`), `null`, booleanos, arreglos, objetos |
| **Error** | `numeroPasajeros debe ser un entero mayor a 0` |
| **Si excede 40** | `No hay vehículo disponible para N pasajeros (capacidad máxima: 40)` |

### `fecha`

| | |
|---|---|
| **Válido** | `YYYY-MM-DD` con ceros a la izquierda: `2026-09-14`, `2026-01-05` |
| **Se rechaza** | `14-09-2026`, `2026-9-5` (sin cero), `2026-09-14T10:00:00Z`, vacío |
| **Se rechaza** | Fechas que no existen: `2026-02-31`, `2026-02-29` (2026 no es bisiesto) |
| **Error** | `fecha debe usar formato YYYY-MM-DD` / `fecha inexistente en el calendario: X` |
| **⚠️ Cuidado** | **Aceptamos fechas pasadas.** Si mandas `2020-01-01`, la reserva se crea. Valida de tu lado que la fecha tenga sentido antes de cobrarle al huésped |

### `hora`

| | |
|---|---|
| **Válido** | `HH:MM` en 24 horas, con cero a la izquierda: `00:00`, `09:05`, `14:30`, `23:59` |
| **Se rechaza** | `9:05` (sin cero), `24:00`, `23:60`, `14:30:00` (con segundos), `2:30 PM`, vacío |
| **Error** | `hora debe usar formato HH:MM (24 horas)` |

### `aeropuertoNombre`

| | |
|---|---|
| **Válido** | `JOSE_MARIA_CORDOVA` o `OLAYA_HERRERA` — **en mayúsculas, exacto** |
| **Se rechaza** | `jose_maria_cordova`, `JMC`, `Jose Maria Cordova`, vacío, ausente |
| **Error** | `aeropuertoNombre inválido. Valores válidos: JOSE_MARIA_CORDOVA, OLAYA_HERRERA` |
| **Ojo** | Se escribe `CORDOVA` con **V**, no con B |

### `aeropuertoTipo`

| | |
|---|---|
| **Válido** | `DESDE` o `HACIA` — **en mayúsculas, exacto** |
| **Se rechaza** | `desde`, `Desde`, `LLEGADA`, `SALIDA`, vacío, ausente |
| **Error** | `aeropuertoTipo debe ser DESDE (del aeropuerto) o HACIA (al aeropuerto)` |

### `emailCliente`

| | |
|---|---|
| **Válido** | Formato de correo real: `juan@ejemplo.com`, `juan+etiqueta@x.com`, `juan@e.co`. Se aceptan mayúsculas y espacios alrededor — los normalizamos |
| **Se rechaza** | `juan@ejemplo` (sin dominio), `juan.ejemplo.com` (sin arroba), `@ejemplo.com`, `juan@.com`, `juan @x.com` (con espacio interno), vacío |
| **Error** | `emailCliente no es una dirección de correo válida: X` |
| **Por qué somos estrictos** | Es el único canal por el que el huésped recibe su código de reserva. Si la dirección está mal, el correo se pierde en silencio y nadie se entera |

### `whatsappCliente`

| | |
|---|---|
| **Válido** | Empieza con `+`, indicativo de país, entre 10 y 15 dígitos. Se aceptan espacios, guiones y paréntesis: `+573001234567`, `+57 300 123 4567`, `+57 (300) 123-4567`, `+1 415 555 0132` |
| **Se rechaza** | `573001234567` (sin `+`), `3001234567` (sin indicativo), `+57300` (muy corto), más de 15 dígitos, cualquier letra mezclada |
| **Error** | `whatsappCliente debe ir en formato internacional con indicativo, ej. +573001234567 (recibido: X)` |
| **Normalización** | Lo guardamos como `+<dígitos>`. `+57 (300) 123-4567` queda `+573001234567` |
| **Por qué somos estrictos** | El conductor abre el chat de WhatsApp con ese número. Sin indicativo, el enlace no abre nada |

### `refExterna`

| | |
|---|---|
| **Válido** | Cualquier texto no vacío. Se recomienda tu id interno de reserva |
| **Se rechaza** | Vacío o solo espacios |
| **Error** | `Campos requeridos: refExterna` |
| **Regla** | **Único y estable por reserva.** Ver [sección 9](#9-reintentos-e-idempotencia) |

### `lugarRecogida`, `nombreCliente`

| | |
|---|---|
| **Válido** | Cualquier texto no vacío. Se admiten tildes, ñ y caracteres especiales |
| **Se rechaza** | Vacío o solo espacios |
| **Error** | `lugarRecogida es requerido` / `Campos requeridos: nombreCliente` |

### `numeroVuelo`, `notas`, `idioma` (opcionales)

| | |
|---|---|
| `numeroVuelo` | Texto libre: `AV8432`. Puedes omitirlo, pero **mándalo si lo tienes** |
| `notas` | Texto libre para el conductor. Puedes omitirlo |
| `idioma` | `ES` o `EN`. Cualquier otro valor, o ausente, se toma como `ES` sin dar error |

---

## 7. Cómo se calcula el precio

No necesitas replicar este cálculo — para eso está `cotizar`. Se explica para que entiendas
por qué el precio cambia.

### El vehículo lo elegimos nosotros

A partir de `numeroPasajeros` asignamos el vehículo más económico que cubra al grupo:

| Pasajeros | Vehículo |
|---|---|
| 1 – 3 | Auto |
| 4 | Camioneta |
| 5 – 8 | Van |
| 9 – 15 | Van |
| 16 – 18 | Van |
| 19 – 25 | Bus |
| 26 – 40 | Bus |
| Más de 40 | No hay vehículo — responde `400` |

### Tres cosas mueven el precio

1. **El aeropuerto.** José María Córdova está mucho más lejos que Olaya Herrera, así que
   cuesta más.
2. **El número de pasajeros**, porque determina el vehículo.
3. **La hora.** Entre las **22:00 y las 03:00** (ambas incluidas) se suma un **recargo
   nocturno**. A las 21:59 no aplica; a las 22:00 sí. A las 03:00 aplica; a las 03:01 no.

### Precios vigentes al momento de escribir esta guía

Sirven para que verifiques tu integración. **No los guardes en tu código** — pueden
cambiar; cotiza siempre.

| Pasajeros | Vehículo | José María Córdova | Olaya Herrera |
|---|---|---|---|
| 1 – 3 | Auto | $140.000 | $80.000 |
| 4 | Camioneta | $180.000 | $80.000 |
| 5 – 8 | Van | $240.000 | $120.000 |
| 9 – 15 | Van | $300.000 | $170.000 |
| 16 – 18 | Van | $370.000 | $200.000 |
| 19 – 25 | Bus | $680.000 | $350.000 |
| 26 – 40 | Bus | $750.000 | $450.000 |

**Recargo nocturno:** +$20.000 entre las 22:00 y las 03:00.

El precio es **por el vehículo completo**, no por persona.

---

## 8. Errores y cómo manejarlos

Todos los errores devuelven `ok: false` y un mensaje legible en `error`:

```json
{ "ok": false, "error": "No hay vehículo disponible para 45 pasajeros (capacidad máxima: 40)" }
```

### Los tres códigos que vas a ver

| Código | Qué significa | Qué debes hacer |
|---|---|---|
| **`400`** | Tu petición tiene algo mal: falta un campo, un formato es inválido, o ningún vehículo cubre al grupo | **Corrige y reenvía. NO reintentes igual** — vas a obtener el mismo error |
| **`401`** | Llave ausente, desconocida o desactivada | Revisa el header `x-api-key`. Si persiste, contáctanos |
| **`500`** | Falla de nuestro lado | **Reintenta con la misma `refExterna`.** Es seguro — ver [sección 9](#9-reintentos-e-idempotencia) |

> **La diferencia entre `400` y `500` es lo más importante de esta sección.**
>
> Un `400` es tuyo: reintentar no lo arregla. Un `500` es nuestro: reintentar es
> exactamente lo que debes hacer, y gracias a la idempotencia no corres riesgo de duplicar
> el traslado.
>
> Programa tu cliente para que distinga los dos casos. Si tratas un `500` como un fallo
> definitivo, vas a perder una reserva que ya le cobraste al huésped.

### Otros casos

| Situación | Respuesta |
|---|---|
| `GET` en vez de `POST` | `405` |
| JSON malformado | `400` con la lista de campos requeridos |
| Cuerpo vacío `{}` | `400 Campos requeridos: refExterna, servicioId, numeroPasajeros, fecha, hora, nombreCliente, whatsappCliente, emailCliente` |

### Orden de validación

Validamos campo por campo y **nos detenemos en el primer error**. Si tu petición tiene
varios problemas, los vas a ver de a uno. El orden es:

```
campos requeridos → refExterna → servicioId → numeroPasajeros → fecha → hora
→ aeropuertoNombre → aeropuertoTipo → lugarRecogida → nombreCliente
→ whatsappCliente → emailCliente → disponibilidad de vehículo
```

---

## 9. Reintentos e idempotencia

**El problema:** le cobraste al huésped, nos mandas la reserva, y la red se cae antes de
que llegue la respuesta. ¿Se creó o no? Si reintentas, ¿creas un traslado duplicado?

**La solución:** `refExterna`.

Si envías dos peticiones con la misma `refExterna`, **no creamos una segunda reserva**. La
segunda devuelve la original con:

```json
{ "ok": true, "duplicado": true, "codigo": "K7M2P9QX", "...": "..." }
```

con código HTTP `200` en lugar de `201`.

### Las reglas

✅ **Ante un timeout, error de red o `500`: reintenta con la misma `refExterna`.**
Es la forma correcta de manejarlo. Puedes reintentar las veces que necesites.

❌ **Nunca generes una `refExterna` nueva para reintentar.** Eso sí crearía un segundo
traslado, y tendrías que pagar los dos.

✅ **Usa tu identificador interno de reserva.** Si en tu base de datos la reserva es la
`88213`, usa algo como `"reserva-88213"`. Es único y estable por naturaleza.

❌ **No uses valores que cambian**, como una marca de tiempo generada en el momento del
reintento. Dejaría de ser la misma referencia.

### Cómo distinguir los dos casos

| Respuesta | Significa |
|---|---|
| `201` + `"duplicado": false` | La reserva se creó ahora |
| `200` + `"duplicado": true` | Ya existía; te devolvemos la que había |

En los dos casos el `codigo` es válido y la reserva está confirmada. Para tu lógica, ambos
son éxito.

---

## 10. Qué pasa después de crear la reserva

En cuanto respondemos `201`:

1. **Le enviamos un correo al huésped** a la dirección de `emailCliente`, en el idioma que
   indicaste, con el código de reserva y el enlace de seguimiento. El correo le dice
   explícitamente que **el traslado ya está pagado y que no debe entregarle dinero al
   conductor**.
2. **La reserva entra a nuestra operación** con estado `CONFIRMED_UNASSIGNED` y aparece en
   el panel y en el calendario del equipo.
3. **Asignamos conductor.** Cuando lo hacemos, los datos del conductor aparecen en el
   enlace de `tracking` y el huésped recibe otro correo.
4. **El día del servicio** el conductor coordina por WhatsApp con el número que enviaste.

### El enlace de tracking

```
https://www.medellintransportes.com/tracking/{codigo}
```

Es público — basta el código — y no requiere autenticación. Muéstraselo a tu huésped:
ahí ve el estado en tiempo real y los datos del conductor. También te sirve a ti para
consultar cómo va una reserva sin llamarnos.

---

## 11. Fuera de alcance

Acordado para esta primera versión. Se pueden añadir si el volumen lo justifica:

| No disponible | Qué hacer mientras tanto |
|---|---|
| **Cancelar por API** | Avísanos por el canal acordado y lo hacemos nosotros |
| **Consultar una reserva por API** | Usa el enlace de `tracking` |
| **Modificar una reserva** | Avísanos para cancelar la existente y crea una nueva |
| **Webhooks hacia tu sistema** | No te notificamos cambios de estado. Si necesitas saber el estado, consulta el `tracking` |
| **Catálogo de servicios por API** | El `servicioId` es fijo y está en esta guía |
| **Otros servicios** (tours, traslados entre municipios, por horas) | Solo traslados al aeropuerto por ahora. Hablemos si te interesa |

> ⚠️ **Sobre cancelaciones:** el huésped puede cancelar por su cuenta desde el enlace de
> tracking si faltan más de 24 horas, y **tu sistema no se entera automáticamente**. Para
> evitar descuadres, lo recomendable es que las cancelaciones pasen por ti y nos avises.

---

## 12. Lista de verificación

Antes de cambiar a la llave de producción, comprueba con la **llave de pruebas**:

**Precio**
- [ ] Cotizas y el precio coincide con la [tabla de casos](#casos-de-prueba) de abajo
- [ ] Muestras `total` + tu margen, no `total` solo
- [ ] No tienes precios escritos en el código; cotizas siempre antes de cobrar

**Reserva**
- [ ] Creas una reserva y recibes `codigo` y `tracking`
- [ ] Abres el `tracking` y ves la reserva
- [ ] Tu huésped de prueba recibe el correo de confirmación
- [ ] Guardas el `codigo` en tu base de datos

**Robustez**
- [ ] `refExterna` es tu id interno, único y estable
- [ ] Reintentas con la misma `refExterna` y recibes `200` + `"duplicado": true`, sin que
      se cree una segunda reserva
- [ ] Ante `400` no reintentas; muestras el mensaje de `error`
- [ ] Ante `500` o timeout **sí** reintentas, con la misma `refExterna`

**Seguridad**
- [ ] La llave está en variables de entorno del servidor
- [ ] Ninguna llamada a esta API sale desde el navegador
- [ ] La llave no está en tu repositorio

**Cierre**
- [ ] Nos avisas para borrar tus reservas de prueba
- [ ] Cambias a la llave de producción

### Casos de prueba

Con `servicioId = cmihxd4vy00159svu4opysoho`:

| Pasajeros | Hora | Aeropuerto | Vehículo esperado | Total esperado |
|---|---|---|---|---|
| 2 | `14:30` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $140.000 |
| 2 | `23:30` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $160.000 (con nocturno) |
| 2 | `21:59` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $140.000 (sin nocturno) |
| 2 | `22:00` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $160.000 (con nocturno) |
| 2 | `03:00` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $160.000 (con nocturno) |
| 2 | `03:01` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $140.000 (sin nocturno) |
| 2 | `14:30` | `OLAYA_HERRERA` | Auto 1 - 3 | $80.000 |
| 4 | `14:30` | `JOSE_MARIA_CORDOVA` | Camioneta 4 | $180.000 |
| 7 | `14:30` | `JOSE_MARIA_CORDOVA` | Van 5 - 8 | $240.000 |
| 12 | `14:30` | `JOSE_MARIA_CORDOVA` | Van 9 - 15 | $300.000 |
| 45 | `14:30` | `JOSE_MARIA_CORDOVA` | — | `400`: capacidad máxima 40 |

Si alguno no coincide, avísanos: puede ser que hayamos actualizado tarifas.

---

## 13. Ejemplo completo de integración

Node.js, sin librerías externas. La lógica es la misma en cualquier lenguaje.

```javascript
const TMT_API = 'https://www.medellintransportes.com';
const TMT_KEY = process.env.TMT_API_KEY;   // nunca escrita en el código
const SERVICIO_AEROPUERTO = 'cmihxd4vy00159svu4opysoho';

async function llamarTMT(ruta, cuerpo) {
  const res = await fetch(`${TMT_API}${ruta}`, {
    method: 'POST',
    headers: { 'x-api-key': TMT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, datos: await res.json() };
}

// ── PASO 1: precio, antes de cobrarle al huésped ──────────────────────────
async function obtenerPrecio({ pasajeros, hora, aeropuerto }) {
  const { status, datos } = await llamarTMT('/api/socios/cotizar', {
    servicioId: SERVICIO_AEROPUERTO,
    numeroPasajeros: pasajeros,
    hora,                          // 'HH:MM' 24h, con cero a la izquierda
    aeropuertoNombre: aeropuerto,  // 'JOSE_MARIA_CORDOVA' | 'OLAYA_HERRERA'
  });

  if (!datos.ok) {
    // 400 → dato inválido, corrígelo. 500 → falla nuestra, puedes reintentar.
    throw new Error(`No se pudo cotizar (${status}): ${datos.error}`);
  }

  const costoTMT = datos.total;
  const precioHuesped = Math.round(costoTMT * 1.20);  // tu margen

  return { costoTMT, precioHuesped, vehiculo: datos.vehiculo.nombre };
}

// ── PASO 2: reserva, DESPUÉS de que el huésped pagó ───────────────────────
async function crearReserva(reserva) {
  const cuerpo = {
    refExterna: `reserva-${reserva.id}`,   // tu id interno: único y estable
    servicioId: SERVICIO_AEROPUERTO,
    numeroPasajeros: reserva.pasajeros,
    fecha: reserva.fecha,                  // 'YYYY-MM-DD'
    hora: reserva.hora,                    // 'HH:MM'
    aeropuertoNombre: reserva.aeropuerto,
    aeropuertoTipo: reserva.esLlegada ? 'DESDE' : 'HACIA',
    lugarRecogida: reserva.direccionAlojamiento,   // en ambos sentidos
    numeroVuelo: reserva.vuelo,            // opcional, pero mándalo
    nombreCliente: reserva.huesped.nombre,
    whatsappCliente: reserva.huesped.telefono,     // '+57...' obligatorio
    emailCliente: reserva.huesped.email,
    idioma: reserva.huesped.idioma === 'en' ? 'EN' : 'ES',
    notas: reserva.observaciones,
  };

  // Reintentos: solo tienen sentido ante 5xx o error de red. Ante 4xx, nunca.
  const MAX_INTENTOS = 4;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const { status, datos } = await llamarTMT('/api/socios/reservas', cuerpo);

      if (datos.ok) {
        // 201 = creada ahora · 200 con duplicado:true = ya existía.
        // Los dos son éxito: la reserva está confirmada.
        return {
          codigoTMT: datos.codigo,
          tracking: datos.tracking,
          total: datos.total,
        };
      }

      if (status >= 400 && status < 500) {
        // Nuestra petición está mal. Reintentar da el mismo error.
        throw new Error(`Petición inválida: ${datos.error}`);
      }
      // 500 → cae al reintento
    } catch (e) {
      if (e.message.startsWith('Petición inválida')) throw e;   // no reintentar
      if (intento === MAX_INTENTOS) throw e;
    }

    // Espera creciente entre reintentos: 1s, 2s, 4s
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (intento - 1)));
  }
}

// ── Uso ────────────────────────────────────────────────────────────────────
const precio = await obtenerPrecio({
  pasajeros: 2, hora: '23:30', aeropuerto: 'JOSE_MARIA_CORDOVA',
});
// → { costoTMT: 160000, precioHuesped: 192000, vehiculo: 'Auto 1 - 3' }

// ... cobras precioHuesped en tu pasarela ...

const creada = await crearReserva({ /* datos del huésped */ });
// → { codigoTMT: 'K7M2P9QX', tracking: 'https://...', total: 160000 }
```

---

## Contacto

Ante cualquier duda, error inesperado o si necesitas cancelar o modificar una reserva,
escríbenos por el canal acordado con el código de reserva a mano.

**Transportes Medellín Travel**
`https://www.medellintransportes.com`
