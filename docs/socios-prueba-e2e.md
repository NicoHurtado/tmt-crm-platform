# Probar la API de socios de inicio a fin

Guía interna para verificar el flujo completo — el mismo que hará la agencia — contra
**producción**, usando la llave de pruebas.

> **Qué es seguro y qué no.**
> `cotizar` es de **solo lectura**: puedes correrlo las veces que quieras sin efecto.
> `reservas` **crea una reserva de verdad**: manda un correo real al `emailCliente` que
> pongas y crea un evento real en el Google Calendar de operación. Por eso se usa la
> llave `housy-test`, que marca la reserva con `origen = 'socio:housy-test'` para poder
> borrarla después (paso 6).

---

## 0. Conseguir la llave de pruebas

```bash
psql "$DATABASE_URL" -A -t -c "select \"apiKey\" from \"Socio\" where codigo='housy-test';"
```

O, si prefieres el seed (es idempotente, **no rota la llave existente**):

```bash
npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

Guárdala en una variable para los comandos de abajo:

```bash
export LLAVE="<la llave de housy-test>"
export API="https://www.medellintransportes.com"
export SVC="cmihxd4vy00159svu4opysoho"
```

---

## 1. Cotizar — lo que hará la agencia antes de cobrarle a su huésped

```bash
curl -s -X POST "$API/api/socios/cotizar" \
  -H "x-api-key: $LLAVE" -H "Content-Type: application/json" \
  -d "{\"servicioId\":\"$SVC\",\"numeroPasajeros\":2,\"hora\":\"23:30\",\"aeropuertoNombre\":\"JOSE_MARIA_CORDOVA\"}"
```

**Esperado:** `total: 160000` (140.000 de base + 20.000 de recargo nocturno), vehículo
`Auto 1 - 3`.

Vale la pena probar también estas, que es lo que la agencia va a combinar:

| Comando (cambia solo lo marcado) | Total esperado |
|---|---|
| `"hora":"14:30"` | $140.000 (sin nocturno) |
| `"aeropuertoNombre":"OLAYA_HERRERA"`, `"hora":"14:30"` | $80.000 |
| `"numeroPasajeros":4` | $180.000 (Camioneta) |
| `"numeroPasajeros":7` | $240.000 (Van 5-8) |
| `"numeroPasajeros":45` | `400` — no hay vehículo, capacidad máxima 40 |

---

## 2. Crear la reserva — lo que hará después de que su huésped pague

**Cambia `emailCliente` por un correo tuyo**, que ahí llega la confirmación y es lo que
vas a revisar en el paso 4.

```bash
curl -s -X POST "$API/api/socios/reservas" \
  -H "x-api-key: $LLAVE" -H "Content-Type: application/json" \
  -d "{
    \"refExterna\": \"prueba-$(date +%s)\",
    \"servicioId\": \"$SVC\",
    \"numeroPasajeros\": 2,
    \"fecha\": \"2026-09-14\",
    \"hora\": \"23:30\",
    \"aeropuertoNombre\": \"JOSE_MARIA_CORDOVA\",
    \"aeropuertoTipo\": \"DESDE\",
    \"lugarRecogida\": \"Cra 43A #7-50, Apto 1204, El Poblado\",
    \"numeroVuelo\": \"AV8432\",
    \"nombreCliente\": \"Prueba Integracion\",
    \"whatsappCliente\": \"+573001234567\",
    \"emailCliente\": \"TU_CORREO@ejemplo.com\",
    \"idioma\": \"ES\",
    \"notas\": \"RESERVA DE PRUEBA - BORRAR\"
  }"
```

**Esperado:** `201` con `codigo` (8 caracteres), `estado: CONFIRMED_UNASSIGNED`,
`total: 160000` y un link de `tracking`. Guarda el código:

```bash
export CODIGO="<el codigo que devolvió>"
```

---

## 3. Idempotencia — que un reintento no duplique el traslado

Repite **exactamente el mismo comando del paso 2**, pero con la `refExterna` fija en vez
de `$(date +%s)`. Corre el mismo comando **dos veces** con `"refExterna": "prueba-fija-1"`.

**Esperado:**
- 1ª vez → `201`, `"duplicado": false`, código nuevo
- 2ª vez → `200`, `"duplicado": true`, **el mismo código**

Esto es lo que hace seguro que la agencia reintente ante un timeout.

---

## 4. Correo al huésped — el punto que estaba mal

Revisa la bandeja del correo que pusiste. **Debe decir:**

> ✅ **Pago ya realizado.** Este traslado ya está pagado: **no debes entregarle dinero al
> conductor.**

**NO debe decir** "Pago en Efectivo · Ten listos $160.000 para pagar al conductor". Si dice
eso, el fix no llegó al deploy.

El correo también trae el código de reserva y el link de seguimiento.

---

## 5. Que se comporte como cualquier otra reserva

| Dónde | Qué revisar |
|---|---|
| `$API/tracking/$CODIGO` | Se ve la reserva, el estado y la línea de tiempo. Sin paso "pendiente de pago" |
| `/admin/dashboard/reservas` | Aparece con badge **`housy-test`** en la columna "Aliado / Socio" y **"No paga"** en "Pago cliente". El filtro "Todos los socios" la aísla |
| Detalle de la reserva | Campo **"Reservada por: housy-test · vía API · ya pagada"** |
| `/admin/dashboard/calendario` | Aparece en el día y hora correctos (14 de septiembre, 23:30) |
| Google Calendar | El evento dice **`💳 Método de Pago: YA PAGADO — NO COBRAR AL CLIENTE`** |
| Asignar conductor desde el admin | Funciona igual; el estado pasa a `CONFIRMED_ASSIGNED` y le llega el correo al huésped |
| Cambiar estados | `IN_PROGRESS` → `COMPLETED` funcionan normal |

Si todo eso pasa, la reserva es indistinguible de una de la web salvo por el origen y por
que nadie le cobra al cliente — que es exactamente lo que se buscaba.

---

## 6. Limpiar las reservas de prueba

Primero **mira qué vas a borrar**:

```sql
SELECT r.codigo, r.fecha, r."nombreCliente", r."precioTotal", sr."refExterna"
FROM "Reserva" r
JOIN "SocioReserva" sr ON sr."reservaId" = r.id
JOIN "Socio" s ON s.id = sr."socioId"
WHERE s.codigo = 'housy-test'
ORDER BY r."createdAt" DESC;
```

Solo cuando la lista sea la esperada, y **una por una** por su código:

```sql
DELETE FROM "Reserva" WHERE codigo = 'EL_CODIGO_EXACTO';
```

`SocioReserva` se borra sola en cascada. Borra también el evento del Google Calendar a
mano, que no se elimina con la fila.

> ⚠️ Nunca borres por `origen LIKE 'socio:%'` sin el filtro de `housy-test`: eso incluiría
> reservas reales del socio en producción.

---

## Errores que puedes provocar a propósito

Para comprobar que el manejo de errores es el que dice la guía de la agencia:

```bash
# 400 — la agencia debe corregir, no reintentar
curl -s -X POST "$API/api/socios/reservas" -H "x-api-key: $LLAVE" \
  -H "Content-Type: application/json" \
  -d "{\"refExterna\":\"x1\",\"servicioId\":\"$SVC\",\"numeroPasajeros\":2,\"fecha\":\"2026-02-31\",\"hora\":\"14:30\",\"aeropuertoNombre\":\"JOSE_MARIA_CORDOVA\",\"aeropuertoTipo\":\"DESDE\",\"lugarRecogida\":\"X\",\"nombreCliente\":\"X\",\"whatsappCliente\":\"+573001234567\",\"emailCliente\":\"x@y.com\"}"
# → "fecha inexistente en el calendario: 2026-02-31"   (NO se corre al 3 de marzo)

# 400 — correo mal escrito
#   cambia emailCliente por "juan@test"  → "emailCliente no es una dirección de correo válida"

# 400 — WhatsApp sin indicativo
#   cambia whatsappCliente por "3001234567" → "debe ir en formato internacional con indicativo"

# 401 — llave revocada
#   UPDATE "Socio" SET activo = false WHERE codigo = 'housy-test';   (y vuelve a ponerlo en true)
```

Ninguno de estos crea reserva.
