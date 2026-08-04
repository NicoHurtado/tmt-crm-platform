# API de Socios — notas internas

Documento interno. **El contrato que se le entrega al socio es
[`api-socios.md`](./api-socios.md)** — ese sí se comparte; este no.

---

## Qué es

Dos endpoints para que una app externa venda nuestro transporte desde su propia
plataforma. Primer socio: **Housy** (~4000 Airbnbs). El socio captura al cliente, le
cobra en su pasarela y nos manda la reserva ya pagada.

```
POST /api/socios/cotizar    precio del servicio para N pasajeros y una hora
POST /api/socios/reservas   crea la reserva, idempotente por refExterna
```

---

## Dónde se configuran los precios

**`/admin/dashboard/servicios/<servicioId>/editar`**, sección de vehículos. Es la misma
pantalla de siempre: **no hay tarifas paralelas para socios**.

| Campo en el admin | Qué controla en la API |
|---|---|
| `precio` de cada vehículo | Tarifa de José María Córdova (y default de servicios no-aeropuerto) |
| `precioOlaya` de cada vehículo | Tarifa de Olaya Herrera. Si queda vacío, cae al `precio` |
| Recargo nocturno (monto + franja) | El `recargoNocturno` del desglose |
| Rango de capacidad del vehículo | Qué vehículo se asigna según `numeroPasajeros` |

Un cambio ahí lo ve el socio **al instante**, sin desplegar nada. El precio sale de
`recalcularPrecioWebDirecto()` en `lib/priceCalculator.ts`, la misma función que usa
`POST /api/reservas` para el flujo web.

Servicio del piloto en producción: **`cmihxd4vy00159svu4opysoho`** (Traslado Privado
Aeropuerto). Tarifas vigentes:

| Vehículo | Pax | JMC | Olaya |
|---|---|---|---|
| Auto | 1–3 | $140.000 | $80.000 |
| Camioneta | 4 | $180.000 | $80.000 |
| Van | 5–8 | $240.000 | $120.000 |
| Van | 9–15 | $300.000 | $170.000 |
| Van | 16–18 | $370.000 | $200.000 |
| Bus | 19–25 | $680.000 | $350.000 |
| Bus | 26–40 | $750.000 | $450.000 |

Recargo nocturno: +$20.000 entre 22:00 y 03:00.

> ⚠️ **Si se recrea el servicio de aeropuerto en el admin, su id cambia** y la integración
> del socio deja de funcionar (`400 Servicio no encontrado o inactivo`). Edita el servicio
> existente en vez de borrarlo y crearlo de nuevo. Si hay que cambiarlo, avísale al socio
> antes.

---

## Decisiones de diseño

**Un socio no es un aliado.** `Aliado` es un hotel con página co-branded y comisión sobre
el precio. `Socio` es solo un consumidor de API: cobra por su cuenta, no lleva comisión y
no tiene `aliadoId`. Se modelaron aparte a propósito.

**El precio no se duplicó.** Sale de `recalcularPrecioWebDirecto()`. No hay tabla paralela
que mantener y no se puede desincronizar de la web.

**La reserva entra a la tabla `Reserva` de siempre.** Es lo que hace que aparezca en el
admin, genere evento de calendario, salga en el calendario de la app, se le pueda asignar
conductor, cambiar de estado y hacer tracking. Lo nuevo son solo dos tablas de soporte:

- **`Socio`** — la app autorizada y su llave. Socio nuevo = una fila, no un deploy. Se
  revoca con `activo: false`.
- **`SocioReserva`** — vincula la reserva con el socio y guarda el request original en
  `payload`. El par `(socioId, refExterna)` es único: eso da la idempotencia.

La migración son **dos `CREATE TABLE`**. Ningún `ALTER TABLE` sobre tablas existentes.

### Cómo entra cada reserva

| Campo | Valor | Por qué |
|---|---|---|
| `origen` | `socio:housy` / `socio:housy-test` | Filtrar en el admin y para la liquidación mensual |
| `clientePaga` | `false` | El huésped ya le pagó al socio: **no se le cobra al llegar** |
| `estadoPago` | `APROBADO` | Entra ya pagada, según lo acordado |
| `metodoPago` | `EFECTIVO` | No pasa por Bold, así que no se aplica la comisión del 6% |
| `estado` | `CONFIRMED_UNASSIGNED` | Entra directo a la cola de asignación de conductor |
| `esReservaAliado` | `false`, `aliadoId: null` | Un socio de API no es un aliado |
| `municipio` | `null` | Los traslados de aeropuerto no cobran tarifa de zona, igual que en la web |

> **`metodoPago: EFECTIVO` es un detalle contable, no una instrucción de cobro.** Lo que
> manda es `clientePaga: false`. El correo al huésped y la descripción del evento de
> calendario miran `clientePaga`, no `metodoPago` — si algún día se toca eso, revisa
> `tplReservaConfirmada` en `lib/email-templates.ts` y `formatLineaPago` en
> `lib/google-calendar-service.ts`.

---

## Dónde se ven en el admin

- **Lista de reservas** (`/admin/dashboard/reservas`): columna **"Aliado / Socio"** muestra
  el código del socio en un badge ámbar. Hay un filtro **"Todos los socios"** que solo
  aparece cuando existen reservas de socio. La columna "Pago cliente" muestra **"No paga"**.
- **Detalle de la reserva**: campo **"Reservada por"** con el socio y la nota "vía API ·
  ya pagada".
- **Calendario de la app** (`/admin/dashboard/calendario`): aparecen como cualquier otra.
- **Google Calendar**: el evento dice `💳 Método de Pago: YA PAGADO — NO COBRAR AL CLIENTE`.

Para la liquidación mensual por SQL:

```sql
SELECT r.codigo, r.fecha, r."precioTotal", sr."refExterna"
FROM "Reserva" r
JOIN "SocioReserva" sr ON sr."reservaId" = r.id
JOIN "Socio" s ON s.id = sr."socioId"
WHERE s.codigo = 'housy'
  AND r.fecha >= '2026-09-01' AND r.fecha < '2026-10-01'
  AND r.estado <> 'CANCELLED';
```

---

## Archivos

| Archivo | Qué es |
|---|---|
| `prisma/schema.prisma` | Modelos `Socio` y `SocioReserva` |
| `prisma/migrations/20260803120000_add_socios_api/` | La migración |
| `prisma/seed-socios.ts` | Crea los socios y sus llaves (idempotente) |
| `prisma/seed-socios-local.ts` | Datos de prueba para una base local |
| `app/api/socios/_auth.ts` | Resuelve `x-api-key` → socio activo |
| `lib/socios/errors.ts` | `SocioRequestError` — separa el `400` del `500` |
| `lib/socios/cotizar.ts` | Parseo de entradas, vehículo según pasajeros, precio |
| `lib/socios/crear-reserva.ts` | Transacción, idempotencia, correo y calendario |
| `app/api/socios/{cotizar,reservas}/route.ts` | Las dos rutas |
| `tests/integration/socios.test.ts` | 25 casos |
| `docs/api-socios.md` | **El contrato que se le entrega al socio** |

---

## Manejo de las llaves

Se entregan por canal seguro y **no van al repositorio**. Para volver a verlas:

```bash
npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

Es idempotente y **conserva la llave existente**, así que se puede correr sin miedo a
invalidarle el acceso a un socio ya integrado. Tampoco reactiva un socio desactivado.

Para rotar una llave a propósito:

```bash
SOCIO_HOUSY_API_KEY=nueva_llave npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

Para **revocar** el acceso de un socio: `activo: false` en su fila de `Socio`. No hace
falta desplegar nada, y su histórico de reservas se conserva.

---

## Probar en local (sin tocar producción)

Necesitas Docker. **`.env.local` apunta a producción**, por eso todas las variables van
por delante del comando: así el entorno de pruebas queda aislado.

```bash
# 1. Base de datos local
docker run -d --name tmt-local-db \
  -e POSTGRES_PASSWORD=tmt -e POSTGRES_USER=tmt -e POSTGRES_DB=tmt \
  -p 5433:5432 postgres:16-alpine

export LOCAL_DB="postgresql://tmt:tmt@localhost:5433/tmt?schema=public"

# 2. Esquema. Se usa db push, no migrate: el historial de migraciones del repo
#    está incompleto (ver "Deuda conocida")
DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" npx prisma db push

# 3. Datos: servicio de aeropuerto con tarifas reales, socios y usuario admin
DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" npx tsx prisma/seed-socios-local.ts
DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" SOCIO_HOUSY_TEST_API_KEY=llave-local \
  npx tsx prisma/seed-socios.ts
DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" npx tsx prisma/seed.ts

# 4. Servidor. Calendario apagado y SMTP inválido para no mandar correos reales
DATABASE_URL="$LOCAL_DB" DIRECT_URL="$LOCAL_DB" \
  DISABLE_CALENDAR_SYNC=true GMAIL_APP_PASSWORD=invalida \
  npm run dev
```

Quedas con: `servicioId` = `local-aeropuerto`, llave = `llave-local`, admin en
`/admin/login` con `admin` / `admin`. Para apagar: `docker rm -f tmt-local-db`.

```bash
# Cotizar — 23:30 entra en la franja nocturna, así que suma $20.000
curl -s -X POST http://localhost:3000/api/socios/cotizar \
  -H "x-api-key: llave-local" -H "Content-Type: application/json" \
  -d '{"servicioId":"local-aeropuerto","numeroPasajeros":2,"hora":"23:30","aeropuertoNombre":"JOSE_MARIA_CORDOVA"}'

# Crear reserva — cambia refExterna en cada prueba
curl -s -X POST http://localhost:3000/api/socios/reservas \
  -H "x-api-key: llave-local" -H "Content-Type: application/json" \
  -d '{"refExterna":"prueba_001","servicioId":"local-aeropuerto","numeroPasajeros":2,
       "fecha":"2026-09-20","hora":"23:30","aeropuertoNombre":"JOSE_MARIA_CORDOVA",
       "aeropuertoTipo":"DESDE","lugarRecogida":"Cra 43A #7-50, El Poblado",
       "numeroVuelo":"AV8432","nombreCliente":"Maria Gomez",
       "whatsappCliente":"+573001234567","emailCliente":"maria@ejemplo.com"}'
```

**Si necesitas probar contra la base de producción, hazlo solo en lectura**: llama a
`cotizar()` de `lib/socios/cotizar.ts` desde un script con `npx tsx`, sin levantar el
servidor. Crear reservas contra producción dispara correos reales y eventos de calendario
reales.

---

## Qué se probó

`npm test` → **25 casos** en `tests/integration/socios.test.ts`, más el resto de la suite.

- **Precios**, contra los datos reales de producción (verificación en modo lectura): JMC
  $140.000, Olaya $80.000, camioneta $180.000, van $240.000/$300.000, bus $750.000.
- **Fronteras del recargo nocturno**: 21:59 sin, 22:00 con, 03:00 con, 03:01 sin.
- **Seguridad**: mandando `precioTotal`, `precioBase`, `clientePaga`, `estado`, `origen`,
  `aliadoId`, `comisionBold` y `codigo` en el body. Ninguno se cuela; todo se recalcula o
  se fija en el servidor.
- **Concurrencia**: peticiones simultáneas con el mismo `refExterna` → una sola reserva.
- **Códigos de error**: `400` cuando la petición del socio está mal, `500` cuando la falla
  es nuestra, sin filtrar el detalle interno.
- **Contacto**: correo con formato inválido y WhatsApp sin indicativo se rechazan; el
  WhatsApp se normaliza a `+<dígitos>` y el correo a minúsculas.
- **Fechas**: `2026-02-31` se rechaza en vez de correrse a marzo; la fecha se guarda al
  mediodía UTC para que el día no se desplace en calendario ni correos.
- **Entradas inválidas**: pasajeros en 0/negativos/decimales, horas imposibles,
  aeropuertos inventados, JSON malformado, texto hostil (`DROP TABLE`, emoji, comillas).

---

## Tolerancias intencionales

No son descuidos: se decidieron así.

- **Se aceptan fechas en el pasado.** El socio valida de su lado. Está documentado en el
  contrato que se le entrega.
- **`numeroPasajeros: "3"` como texto se acepta** (se convierte a número) y un `idioma`
  desconocido cae a `ES` en silencio, para que integrar sea fácil.
- **No hay rate limiting.** Un socio confiable con llave revocable. Si hace falta cortar,
  se pone `activo: false`.
- **El huésped puede auto-cancelar desde el link de tracking** (>24h antes) y el socio no
  se entera: no hay webhooks salientes. Está advertido en el contrato. Si el volumen lo
  justifica, ahí es donde entraría un webhook.

---

## Deuda conocida (preexistente, no de esta rama)

**Faltan archivos de migraciones antiguas en el repo.** `prisma migrate status` reporta 5
migraciones **aplicadas en la base** cuyo `.sql` no está en el repo (`.gitignore` incluye
`*.sql`):

```
20260604151007_add_precio_olaya_aeropuerto
20260619120000_add_aliado_imagen
20260622164500_add_categoria_modelo_precio
20260623120000_add_comision_por_persona_aliado
20260624120000_remove_servicio_orden
```

Ojo con la dirección: **los cambios sí están en producción**; lo que se perdió son los
archivos. Consecuencias:

- `prisma migrate deploy` **funciona normal**: aplica solo las del repo que falten e ignora
  las que sobran en la base.
- `prisma migrate dev` **no se debe usar contra producción** — querría resetear.
- Para bases nuevas (local, staging), usar `prisma db push`.

**`prisma/seed-sandbox.ts` está roto** — llama a `prisma.reservaAdicional`, un modelo que
ya no existe. Por eso se escribió `seed-socios-local.ts`.

**Un test preexistente falla** en `tests/unit/emailTemplates.test.ts` ("contiene link de
calificación"). Falla igual en `main`, es anterior a esta rama.

---

## Para quien retome esto

**Lo que NO se debe tocar.** Esta API es independiente a propósito. No modifiques
`/api/external/*` (marketing), `/api/n8n/*` (bot de WhatsApp) ni `/api/public/*`
(cotizador del bot): son otros consumidores con sus propios contratos y tests.

**De dónde sale el precio.** De `recalcularPrecioWebDirecto()` en `lib/priceCalculator.ts`.
Esa función la comparte `POST /api/reservas`: tocarla afecta el flujo web de clientes
finales. Hay una trampa conocida — si le pasas `municipio: 'OTRO'` sin `municipioConfigId`,
devuelve todo en cero. Por eso `lib/socios/cotizar.ts` le pasa `municipio: null`.

**Antes de dar por bueno un cambio:**

```bash
npm test                          # 25 casos de socios + el resto de la suite
npx tsc --noEmit                  # 16 errores preexistentes en tests, ninguno en app/ ni lib/
npx next lint --dir app --dir lib # debe salir limpio
npm run build
```

**Si cambias `prisma/schema.prisma`**, genera la migración sin conectarte a ninguna base:

```bash
git show main:prisma/schema.prisma > /tmp/old.prisma
npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

Revisa el SQL antes de guardarlo, y fuerza el archivo al repo con `git add -f` porque
`.gitignore` ignora `*.sql`.
