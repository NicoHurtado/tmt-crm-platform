# API de Socios — TMT Travel

API para que aplicaciones externas ofrezcan nuestro transporte dentro de su propia
plataforma. El socio captura los datos del cliente, le cobra directamente y nos envía la
reserva ya pagada. La liquidación entre el socio y TMT se hace por fuera de la API.

Primer socio: **Housy**. Piloto: traslados de aeropuerto (llegada y salida).

- **Base URL:** `https://www.medellintransportes.com`
- **Moneda:** COP (pesos colombianos), siempre enteros sin decimales
- **Formato:** JSON en request y response

---

## Autenticación

Todas las peticiones llevan la llave en el header `x-api-key`:

```
x-api-key: <llave entregada por TMT>
```

Sin llave, con llave desconocida o con el socio desactivado se responde `401`.

Se entregan **dos llaves**: una de pruebas y una de producción. Ambas escriben en la
misma base de datos, pero las reservas de prueba quedan marcadas aparte para que
operaciones las distinga y las elimine al terminar la integración. **Usa la llave de
pruebas durante todo el desarrollo.**

---

## 1. Cotizar

`POST /api/socios/cotizar`

Devuelve el precio de un servicio. Es el mismo precio que vería un cliente en nuestra
web: incluye recargo nocturno y la tarifa correspondiente al aeropuerto solicitado.

### Request

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `servicioId` | string | sí | Id del servicio. Para el piloto: `cmihxd4vy00159svu4opysoho` |
| `numeroPasajeros` | entero > 0 | sí | Define qué vehículo se asigna |
| `hora` | `HH:MM` (24h) | sí | Define si aplica recargo nocturno |
| `aeropuertoNombre` | `JOSE_MARIA_CORDOVA` \| `OLAYA_HERRERA` | sí (en servicios de aeropuerto) | Cada aeropuerto tiene su propia tarifa |
| `datosDinamicos` | objeto | no | Adicionales del servicio. En el piloto no se usa |

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

`total` es el precio **final del vehículo completo**, no por persona. Es lo que TMT le
cobra al socio; qué le cobre el socio a su huésped es decisión suya.

**Recargo nocturno:** $20.000 entre las 22:00 y las 03:00.
**Tarifa de municipio:** siempre `0` en traslados de aeropuerto.

---

## 2. Crear reserva

`POST /api/socios/reservas`

Crea la reserva en el sistema de TMT. El precio **se recalcula en el servidor**: no se
acepta un precio enviado por el socio. La respuesta trae el total definitivo.

### Request

Además de los campos de la cotización:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `refExterna` | string | sí | Id de la reserva en tu plataforma. Da idempotencia (ver abajo) |
| `fecha` | `YYYY-MM-DD` | sí | Fecha del servicio |
| `aeropuertoTipo` | `DESDE` \| `HACIA` | sí (en aeropuerto) | `DESDE` = del aeropuerto al alojamiento. `HACIA` = del alojamiento al aeropuerto |
| `lugarRecogida` | string | sí (en aeropuerto) | Dirección del alojamiento, en ambos sentidos. Es la dirección que recibe el conductor |
| `numeroVuelo` | string | no | Muy recomendado: permite ajustar la recogida si el vuelo se retrasa |
| `nombreCliente` | string | sí | Nombre del huésped |
| `whatsappCliente` | string | sí | Con indicativo, ej. `+573001234567`. El conductor lo usa para coordinar |
| `emailCliente` | string | sí | Recibe la confirmación con el código de reserva |
| `idioma` | `ES` \| `EN` | no | Idioma de los correos. Por defecto `ES` |
| `notas` | string | no | Cualquier cosa que deba saber el conductor |

```bash
curl -X POST https://www.medellintransportes.com/api/socios/reservas \
  -H "x-api-key: TU_LLAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "refExterna": "hsy_88213",
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

`codigo` es el identificador de la reserva en TMT: úsalo para cualquier comunicación con
nosotros. `tracking` es un link que puedes mostrarle al huésped para que siga el estado
de su traslado y vea los datos del conductor cuando se asigne.

`CONFIRMED_UNASSIGNED` significa **reserva confirmada, pendiente de asignar conductor**.
La asignación la hace nuestro equipo de operación.

### Idempotencia

Si repites una petición con la misma `refExterna`, **no se crea una segunda reserva**: se
devuelve la original con status `200` y `"duplicado": true`.

Esto significa que ante un timeout o un error de red **puedes reintentar sin riesgo**.
Es la forma correcta de manejar fallos: reintenta con la misma `refExterna`.

---

## Errores

Todos los errores devuelven `ok: false` y un mensaje en `error`.

| Status | Cuándo |
|---|---|
| `400` | Falta un campo, el formato es inválido, el servicio no existe, o ningún vehículo cubre el grupo |
| `401` | Llave ausente, desconocida o socio desactivado |
| `500` | Error inesperado del servidor. Reintenta con la misma `refExterna` |

```json
{ "ok": false, "error": "No hay vehículo disponible para 40 pasajeros (capacidad máxima: 18)" }
```

Los mensajes están pensados para leerse: si el grupo no cabe, el error dice la capacidad
máxima disponible.

---

## Fuera de alcance en esta versión

Acordado para el piloto. Se añaden si el volumen lo justifica:

- **Cancelar o consultar por API.** Avísanos por el canal acordado y lo hacemos desde el
  panel. El huésped puede ver el estado en el link de `tracking`.
- **Webhooks salientes.** No notificamos cambios de estado hacia el socio.
- **Modificar una reserva.** Cancela la existente y crea una nueva.
- **Catálogo de servicios.** El `servicioId` del piloto es fijo y va en esta guía.
- **Límite de peticiones.** No hay rate limiting. Si hace falta cortar el acceso, se
  desactiva la llave.

---

## Notas internas (TMT)

Estas notas no van en la guía que se entrega al socio.

### Puesta en marcha

```bash
# 1. Aplicar la migración (solo crea las tablas Socio y SocioReserva)
npx prisma migrate deploy

# 2. Sembrar los socios y obtener sus llaves
npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

El seed es idempotente: si el socio ya existe **conserva su llave**, no la rota. Para
rotarla a propósito:

```bash
SOCIO_HOUSY_API_KEY=nueva_llave npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

Las llaves se entregan por canal seguro y no se suben al repositorio.

### Cómo entran las reservas

| Campo | Valor | Por qué |
|---|---|---|
| `origen` | `socio:housy` / `socio:housy-test` | Filtrar en el admin y para la liquidación mensual |
| `clientePaga` | `false` | El huésped ya le pagó al socio: no se le cobra al llegar |
| `estadoPago` | `APROBADO` | Se asume pagada, según lo acordado |
| `metodoPago` | `EFECTIVO` | No pasa por Bold, así que no se aplica la comisión del 6% |
| `estado` | `CONFIRMED_UNASSIGNED` | Entra directo a la cola de asignación de conductor |
| `esReservaAliado` | `false`, `aliadoId: null` | Un socio de API no es un aliado: no tiene comisión ni página co-branded |
| `municipio` | `null` | Los traslados de aeropuerto no cobran tarifa de zona, igual que en la web |

Las reservas de prueba salen con `origen = 'socio:housy-test'`. Al cerrar la integración,
se filtran por ese valor en el admin y se borran.

### Precio

Sale de `recalcularPrecioWebDirecto()` en `lib/priceCalculator.ts`, la misma función que
usa `POST /api/reservas` para recalcular precios server-side. **No hay tabla de tarifas
paralela**: si cambia el precio del servicio en el admin, el socio lo ve al instante.

### Trazabilidad

Cada reserva creada por un socio tiene una fila en `SocioReserva` con el request original
en `payload`. Para conciliar un mes:

```sql
SELECT r.codigo, r.fecha, r."precioTotal", sr."refExterna"
FROM "Reserva" r
JOIN "SocioReserva" sr ON sr."reservaId" = r.id
JOIN "Socio" s ON s.id = sr."socioId"
WHERE s.codigo = 'housy'
  AND r.fecha >= '2026-09-01' AND r.fecha < '2026-10-01'
  AND r.estado <> 'CANCELLED';
```
