# API de Socios — resumen de la implementación

Rama: `feat/api-socios` · 4 commits

Documento de entrega para el equipo. El **contrato de la API** (endpoints, campos,
ejemplos, errores) está en [`api-socios.md`](./api-socios.md); esto es el resumen de qué
se construyó, por qué, y cómo levantarlo en tu máquina.

---

## Qué se construyó

Dos endpoints para que aplicaciones externas vendan nuestro transporte desde su propia
plataforma. El primer socio es **Housy** (~4000 Airbnbs) y el piloto son traslados de
aeropuerto. El socio captura al cliente, le cobra y nos manda la reserva ya pagada.

```
POST /api/socios/cotizar    precio del servicio para N pasajeros y una hora
POST /api/socios/reservas   crea la reserva, idempotente por refExterna
```

---

## Tres decisiones que vale la pena conocer

**Un socio no es un aliado.** `Aliado` es un hotel con página co-branded y comisión sobre
el precio. `Socio` es solo un consumidor de API: cobra por su cuenta, no lleva comisión y
no tiene `aliadoId`. Son cosas distintas y se modelaron aparte.

**El precio no se duplicó.** Sale de `recalcularPrecioWebDirecto()` en
`lib/priceCalculator.ts`, la misma función que usa `POST /api/reservas`. El socio recibe
exactamente el precio de nuestra web, con recargo nocturno y precio alterno de Olaya
incluidos. Si mañana cambian las tarifas en el admin, el socio las ve al instante — no
hay tabla paralela que mantener.

**La reserva entra a la tabla `Reserva` de siempre.** Es lo que hace que aparezca en el
admin, genere evento de calendario y se le pueda asignar conductor. Lo nuevo son solo dos
tablas de soporte:

- **`Socio`** — la app autorizada y su llave. Socio nuevo = una fila, no un deploy. Se
  revoca con `activo: false`.
- **`SocioReserva`** — vincula la reserva con el socio y guarda el request original.
  El par `(socioId, refExterna)` es único: eso da la idempotencia.

La migración son **dos `CREATE TABLE`**. Ningún `ALTER TABLE` sobre tablas existentes.

Cómo entra cada reserva: `origen = 'socio:<codigo>'` · `clientePaga = false` (ya le pagó
al socio) · `estadoPago = APROBADO` · `metodoPago = EFECTIVO` (no pasa por Bold, así que
no se aplica la comisión del 6%) · `estado = CONFIRMED_UNASSIGNED`.

---

## Archivos

| Archivo | Qué es |
|---|---|
| `prisma/schema.prisma` | Modelos `Socio` y `SocioReserva` |
| `prisma/migrations/20260803120000_add_socios_api/` | La migración |
| `prisma/seed-socios.ts` | Crea los socios y sus llaves (idempotente) |
| `prisma/seed-socios-local.ts` | Datos de prueba para una base local |
| `app/api/socios/_auth.ts` | Resuelve `x-api-key` → socio activo |
| `lib/socios/cotizar.ts` | Vehículo según pasajeros + precio |
| `lib/socios/crear-reserva.ts` | Transacción, idempotencia, correo y calendario |
| `app/api/socios/{cotizar,reservas}/route.ts` | Las dos rutas |
| `tests/integration/socios.test.ts` | 17 casos |
| `docs/api-socios.md` | El contrato para el socio |

---

## Levantarlo en tu máquina

Necesitas Docker. **Tu `.env.local` apunta a producción**, por eso todas las variables van
por delante del comando: así el entorno de pruebas queda aislado.

```bash
git checkout feat/api-socios
npm install

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
`/admin/login` con `admin` / `admin`.

Para apagar: `docker rm -f tmt-local-db`.

### Probarlo

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

### Verlo en el navegador

| | |
|---|---|
| Panel de operación | `localhost:3000/admin/login` — `admin` / `admin`, sección Reservas |
| Seguimiento del cliente | `localhost:3000/tracking/<codigo>` |
| Tablas `Socio` y `SocioReserva` | `DATABASE_URL="$LOCAL_DB" npx prisma studio` → `localhost:5555` |

En `SocioReserva`, el campo `payload` guarda el request exacto del socio, para soporte y
conciliación.

---

## Qué se probó

Todo esto se ejercitó contra la base local:

- **Precios**, contra los datos reales de producción: JMC $140.000, Olaya $80.000,
  recargo nocturno +$20.000, cambio de vehículo según pasajeros, adicional del póster.
- **Fronteras del recargo nocturno**: 21:59 sin, 22:00 con, 00:00 con, 03:00 con, 03:01 sin.
- **Seguridad**: mandando `precioTotal`, `precioBase`, `clientePaga`, `estado`, `origen`,
  `aliadoId`, `comisionBold` y `codigo` en el body. Ninguno se coló; todo se recalcula o
  se fija en el servidor.
- **Concurrencia**: 5 peticiones simultáneas con el mismo `refExterna` → una sola reserva.
- **Texto hostil**: comillas, `DROP TABLE`, emoji y caracteres chinos.
- **Entradas inválidas**: pasajeros en 0/negativos/decimales, horas imposibles,
  aeropuertos inventados, JSON malformado, GET en vez de POST.

### Un bug encontrado y corregido

`"fecha": "2026-02-31"` pasaba la validación y se guardaba como **2026-03-03**.
JavaScript no da error con un día que no existe: lo corre al mes siguiente. Un error de
tipeo del socio habría creado el traslado tres días después sin avisar. Se corrigió
comparando el ida y vuelta de la fecha (commit `c147561`). El 29 de febrero de un año
bisiesto sigue siendo válido.

### Dos comportamientos a decidir

- **Se aceptan fechas en el pasado.** Es claramente un error del socio, pero no se
  restringió para no meter validaciones de más en el piloto. Es una línea si se quiere.
- **`numeroPasajeros: "3"` como texto se acepta** y un `idioma` desconocido cae a `ES` en
  silencio. Tolerancia intencional para que integrar sea fácil.

---

## Deuda conocida (preexistente, no de esta rama)

**Los tests no se pudieron ejecutar.** Vitest 4 requiere Node ≥20.12 y la máquina donde
se desarrolló tiene Node 18.19.1: el runner ni arranca. Afecta a toda la suite, no solo a
la nueva (se comprobó con `tests/unit/bold.test.ts`). El archivo
`tests/integration/socios.test.ts` **está sin ejecutar**: correrlo con Node 20+ es lo
primero que debería hacer quien tome esto.

**Migraciones desincronizadas.** `prisma migrate status` reporta 5 migraciones aplicadas
en producción que no están en `prisma/migrations/`:

```
20260604151007_add_precio_olaya_aeropuerto
20260619120000_add_aliado_imagen
20260622164500_add_categoria_modelo_precio
20260623120000_add_comision_por_persona_aliado
20260624120000_remove_servicio_orden
```

La causa probable: `.gitignore` incluye `*.sql`, así que las migraciones solo llegan al
repo si se fuerzan con `git add -f`, y esas cinco no se forzaron. **Conviene recuperarlas
antes de correr cualquier comando de migración contra producción.**

**`prisma/seed-sandbox.ts` está roto** — llama a `prisma.reservaAdicional`, un modelo que
ya no existe. Por eso se escribió `seed-socios-local.ts`.

---

## Para desplegar

```bash
npx prisma migrate deploy    # dos CREATE TABLE, no tocan datos existentes
npx tsx -r dotenv/config prisma/seed-socios.ts dotenv_config_path=.env.local
```

El seed imprime las llaves y **conserva la existente** si el socio ya está creado, así que
es seguro repetirlo. Las llaves se entregan por canal seguro; no van al repositorio.

Se crean dos socios: `housy` y `housy-test`. El segundo es para que integren sin ensuciar
la operación: sus reservas salen con `origen = 'socio:housy-test'` y se filtran y borran
desde el admin al terminar.

Antes de correr `migrate deploy` en producción, resolver lo de las migraciones
desincronizadas.
