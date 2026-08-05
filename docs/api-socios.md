# API de Socios — TMT Travel

> **El documento que se le entrega al socio es
> [`documentacion-api-tmt.md`](./documentacion-api-tmt.md)** — más completo, con los
> formatos exactos de cada campo y las llaves incluidas. Este archivo se conserva como
> referencia resumida del contrato.

API para que tu plataforma ofrezca nuestro transporte a tus huéspedes. Tú capturas los
datos, nos consultas el precio, le cobras a tu huésped y nos envías la reserva ya pagada.
Nosotros prestamos el servicio. La liquidación entre nosotros se hace por fuera de la API.

- **Base URL:** `https://www.medellintransportes.com`
- **Moneda:** COP (pesos colombianos), siempre enteros sin decimales
- **Formato:** JSON en request y response

---

## El flujo, en dos llamadas

```
1. Tu huésped llena el formulario en tu plataforma
2. POST /api/socios/cotizar   ──▶  te devolvemos el precio
3. Tu huésped paga en tu pasarela
4. POST /api/socios/reservas  ──▶  creamos la reserva y te devolvemos el código
```

Entre el paso 2 y el 4 no hay estado que mantener de tu lado: la cotización no reserva
nada ni caduca. El precio del paso 4 se vuelve a calcular con los mismos datos, así que si
mandas lo mismo te da lo mismo.

---

## Autenticación

Todas las peticiones llevan la llave en el header `x-api-key`:

```
x-api-key: <llave entregada por TMT>
```

Sin llave, con llave desconocida o con el socio desactivado se responde `401`.

Se entregan **dos llaves**: una de pruebas y una de producción. Ambas escriben en la misma
base de datos, pero las reservas de prueba quedan marcadas aparte para que operaciones las
distinga y las elimine al terminar la integración. **Usa la llave de pruebas durante todo
el desarrollo.**

---

## 1. Cotizar

`POST /api/socios/cotizar`

Devuelve el precio del servicio. Es el mismo precio que vería un cliente en nuestra web:
incluye recargo nocturno y la tarifa del aeropuerto solicitado.

### Request

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `servicioId` | string | sí | Id del servicio. Para el traslado de aeropuerto: `cmihxd4vy00159svu4opysoho` |
| `numeroPasajeros` | entero > 0 | sí | Define qué vehículo se asigna |
| `hora` | `HH:MM` (24h) | sí | Define si aplica recargo nocturno |
| `aeropuertoNombre` | `JOSE_MARIA_CORDOVA` \| `OLAYA_HERRERA` | sí | Cada aeropuerto tiene su propia tarifa |

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

### Response `200`

```json
{
  "ok": true,
  "servicioId": "cmihxd4vy00159svu4opysoho",
  "servicioNombre": "Traslado Privado Aeropuerto",
  "vehiculo": {
    "id": "veh-auto",
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

`total` es el precio **final del vehículo completo**, no por persona. Es lo que TMT te
cobra a ti; qué le cobres tú a tu huésped es decisión tuya.

Usa siempre `total`. El `desglose` es informativo — si quieres mostrárselo a tu huésped
puedes, pero no necesitas sumarlo tú.

### Cómo se arma el precio

- **El vehículo lo elegimos nosotros** a partir de `numeroPasajeros`: se asigna el más
  económico que cubra al grupo. No tienes que escogerlo.
- **Recargo nocturno:** $20.000 entre las 22:00 y las 03:00 (ambas incluidas).
- **Cada aeropuerto tiene su tarifa.** José María Córdova es más caro que Olaya Herrera
  por la distancia.
- **Tarifa de municipio:** siempre `0` en traslados de aeropuerto.

Los precios se administran de nuestro lado y pueden cambiar. **Cotiza siempre antes de
cobrarle a tu huésped**; no guardes una tabla de precios de tu lado.

---

## 2. Crear reserva

`POST /api/socios/reservas`

Crea la reserva en nuestro sistema, ya marcada como pagada. Llámalo **después** de que tu
huésped pagó.

El precio **se recalcula en el servidor**: no se acepta un precio enviado por ti. La
respuesta trae el total definitivo, que será el mismo que te dio `cotizar` si los datos
son los mismos.

### Request

Los mismos campos de la cotización, más:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `refExterna` | string | sí | Id de la reserva en tu plataforma. Da idempotencia (ver abajo) |
| `fecha` | `YYYY-MM-DD` | sí | Fecha del servicio |
| `aeropuertoTipo` | `DESDE` \| `HACIA` | sí | `DESDE` = del aeropuerto al alojamiento. `HACIA` = del alojamiento al aeropuerto |
| `lugarRecogida` | string | sí | Dirección del alojamiento, **en ambos sentidos**. Es la dirección que recibe el conductor |
| `numeroVuelo` | string | no | Muy recomendado: permite ajustar la recogida si el vuelo se retrasa |
| `nombreCliente` | string | sí | Nombre del huésped |
| `whatsappCliente` | string | sí | **Con indicativo de país**, ej. `+573001234567`. El conductor lo usa para coordinar |
| `emailCliente` | string | sí | Recibe la confirmación con el código de reserva |
| `idioma` | `ES` \| `EN` | no | Idioma de los correos al huésped. Por defecto `ES` |
| `notas` | string | no | Cualquier cosa que deba saber el conductor |

```bash
curl -X POST https://www.medellintransportes.com/api/socios/reservas \
  -H "x-api-key: TU_LLAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "refExterna": "res_88213",
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

### Response `201`

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

- **`codigo`** es el identificador de la reserva en TMT. Guárdalo: es lo que usamos para
  cualquier comunicación sobre esa reserva.
- **`tracking`** es un link que puedes mostrarle a tu huésped para que siga el estado de
  su traslado y vea los datos del conductor cuando se le asigne.
- **`estado: CONFIRMED_UNASSIGNED`** significa **reserva confirmada, pendiente de asignar
  conductor**. La asignación la hace nuestro equipo de operación. Es el estado normal de
  una reserva recién creada; no es un error ni algo que tengas que resolver.

Al crear la reserva le enviamos a tu huésped un correo de confirmación con el código y el
link de seguimiento, en el idioma que hayas indicado. El correo le dice explícitamente que
**el traslado ya está pagado y que no debe entregarle dinero al conductor**.

### Idempotencia — cómo manejar los fallos

Si repites una petición con la misma `refExterna`, **no se crea una segunda reserva**: se
devuelve la original con status `200` y `"duplicado": true`.

Esto significa que ante un timeout, un error de red o un `500`, **puedes reintentar sin
riesgo**. Es la forma correcta de manejarlo: reintenta con la misma `refExterna` hasta
recibir una respuesta clara. Nunca generes una `refExterna` nueva para reintentar — eso sí
crearía un traslado duplicado.

---

## Errores

Todos los errores devuelven `ok: false` y un mensaje en `error`.

| Status | Qué significa | Qué hacer |
|---|---|---|
| `400` | La petición tiene algo mal: falta un campo, el formato es inválido, el servicio no existe, o ningún vehículo cubre al grupo | **Corrige y vuelve a enviar.** Reintentar igual no sirve |
| `401` | Llave ausente, desconocida o socio desactivado | Revisa el header `x-api-key`. Si persiste, contáctanos |
| `500` | Falla de nuestro lado | **Reintenta con la misma `refExterna`.** La idempotencia lo hace seguro |

```json
{ "ok": false, "error": "No hay vehículo disponible para 40 pasajeros (capacidad máxima: 18)" }
```

Los mensajes de `400` están pensados para leerse y actuar sobre ellos: si el grupo no cabe,
el error dice la capacidad máxima disponible; si un campo está mal, dice cuál.

**La distinción entre `400` y `500` importa.** Un `400` es tuyo y reintentar no lo arregla.
Un `500` es nuestro y reintentar es exactamente lo que debes hacer.

---

## Validaciones que conviene conocer

Para que no te sorprendan en producción:

| Campo | Regla |
|---|---|
| `fecha` | `YYYY-MM-DD` y **debe existir en el calendario**. `2026-02-31` se rechaza (no se corre al mes siguiente en silencio) |
| `hora` | `HH:MM` en 24 horas. `25:00` o `10:75` se rechazan |
| `emailCliente` | Debe tener forma de correo válida. Es el único canal por el que tu huésped recibe su código |
| `whatsappCliente` | Debe llevar indicativo de país y empezar con `+`. Se aceptan espacios, guiones y paréntesis: `+57 (300) 123-4567` es válido y se guarda como `+573001234567` |
| `numeroPasajeros` | Entero mayor a 0. Se acepta como número o como texto (`2` y `"2"` funcionan igual) |
| `lugarRecogida` | Requerido en los dos sentidos. En `HACIA` es de dónde se recoge; en `DESDE` es a dónde se lleva |

**No validamos que la fecha sea futura.** Si mandas una fecha pasada la reserva se crea
igual. Valida de tu lado que la fecha tenga sentido antes de cobrarle a tu huésped.

---

## Fuera de alcance en esta versión

Acordado para el arranque. Se añaden si el volumen lo justifica:

- **Cancelar o consultar por API.** Avísanos por el canal acordado y lo hacemos desde el
  panel. Tu huésped puede ver el estado en el link de `tracking`.
- **Webhooks salientes.** No notificamos cambios de estado hacia tu sistema. Si tu huésped
  cancela desde el link de tracking, tu sistema no se entera automáticamente — por eso
  conviene que las cancelaciones pasen por ti y nos avises.
- **Modificar una reserva.** Cancela la existente (avisándonos) y crea una nueva.
- **Catálogo de servicios.** El `servicioId` es fijo y va en esta guía. Si algún día
  cambia, te avisamos antes.
- **Límite de peticiones.** No hay rate limiting. Si hace falta cortar el acceso, se
  desactiva la llave.

---

## Checklist de integración

Antes de pasar a la llave de producción:

- [ ] Cotizas con la llave de **pruebas** y el precio te cuadra contra los casos de abajo
- [ ] Creas una reserva y te llega el `codigo` y el link de `tracking`
- [ ] Abres el link de `tracking` y ves la reserva
- [ ] Tu huésped de prueba recibe el correo de confirmación
- [ ] Reintentas la **misma** `refExterna` y recibes `200` con `"duplicado": true` (no se
      creó una segunda)
- [ ] Manejas `400` sin reintentar y `500` reintentando
- [ ] `refExterna` es único y estable por reserva en tu sistema
- [ ] Nos avisas para borrar las reservas de prueba

### Casos de prueba con valores esperados

Con `servicioId: cmihxd4vy00159svu4opysoho`:

| Pasajeros | Hora | Aeropuerto | Vehículo esperado | Total esperado |
|---|---|---|---|---|
| 2 | `14:30` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $140.000 |
| 2 | `23:30` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $160.000 (con nocturno) |
| 2 | `21:59` | `JOSE_MARIA_CORDOVA` | Auto 1 - 3 | $140.000 (sin nocturno) |
| 2 | `14:30` | `OLAYA_HERRERA` | Auto 1 - 3 | $80.000 |
| 4 | `14:30` | `JOSE_MARIA_CORDOVA` | Camioneta 4 | $180.000 |
| 7 | `14:30` | `JOSE_MARIA_CORDOVA` | Van 5 - 8 | $240.000 |
| 12 | `14:30` | `JOSE_MARIA_CORDOVA` | Van 9 - 15 | $300.000 |
| 45 | `14:30` | `JOSE_MARIA_CORDOVA` | — | `400`: capacidad máxima 40 |

Estos totales son los vigentes al momento de escribir esta guía. Si alguno no cuadra,
avísanos: puede ser que hayamos actualizado tarifas (por eso la regla de cotizar siempre
antes de cobrar).
