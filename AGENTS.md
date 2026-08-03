# Transportes Medellín Travel

## Propósito
Plataforma de reservas de transporte y turismo en Medellín (Colombia). 3 roles: **cliente final** (reserva online), **aliado** (hotel/airbnb/agencia con página co-branded y comisiones propias), **admin** (backoffice completo). Además, **socios de API**: apps externas que venden nuestro transporte desde su plataforma (ver `docs/api-socios.md`).

## Stack
Next.js 14 (App Router) · TypeScript · Prisma 5 · PostgreSQL (Neon/Railway) · NextAuth v4 · Tailwind · Shadcn/ui · Vercel

## Estructura
```
app/
  (público)         landing, /reservas/*, /cotizacion/[linkId], /hotel/[codigo], /tracking, /payment/result, /rate/[id]
  aliados/[codigo]/ páginas co-branded
  admin/            backoffice (dashboard, reservas, servicios, aliados, conductores, estadísticas, calendario, cotizaciones, municipios, términos)
  api/              72 rutas REST, agrupadas por consumidor:
                    public/* (bot, sin auth) · n8n/* · external/* (marketing) · socios/* (apps aliadas)
components/
  admin/    landing/    reservas/wizard/ (7 pasos)    ui/ (shadcn barrel export)
lib/
  bold.ts · priceCalculator.ts · state-transitions.ts · email-service.ts · email-templates.ts
  google-calendar-service.ts · prisma.ts (singleton) · auth.ts · exportUtils.ts
  socios/ (cotizar · crear-reserva)
  hooks/useAliado · hooks/useAliadoCommission · hooks/useLanguage
  i18n/es.json · i18n/en.json
prisma/schema.prisma (18 modelos) · middleware.ts (NextAuth Edge)
```

## Modelos Prisma
`Reserva` es el modelo central — conecta Servicio, Vehiculo, Conductor, Aliado, Pedido, MunicipioConfig.

```
Aliado → ServicioAliado → TarifaAliado | PrecioVehiculoAliado | TarifaMunicipioAliado
Servicio → ServicioVehiculo | ServicioAdicional | TarifaMunicipioServicio | Calificacion
Reserva → Asistente | ReservaAdicional | Calificacion
Pedido (agrupa reservas multi-servicio)
Socio → SocioReserva → Reserva (app externa que consume /api/socios/*)
Conductor · MunicipioConfig · SiteContent (CMS clave-valor) · User (admin) · BdAntigua (legacy)
```

**Socio ≠ Aliado.** Un `Aliado` es un hotel/agencia con página co-branded y comisión sobre el precio. Un `Socio` es solo un consumidor de API: cobra por su cuenta y nos manda la reserva ya pagada (`clientePaga: false`, `estadoPago: APROBADO`, `origen: socio:<codigo>`). No lleva comisión ni `aliadoId`.

**EstadoReserva:** `PENDING_PAYMENT → CONFIRMED_UNASSIGNED → CONFIRMED_ASSIGNED → IN_PROGRESS → COMPLETED / CANCELLED / PAYMENT_FAILED`

**Enums:** TipoAliado (HOTEL·AIRBNB·AGENCIA) · TipoServicio (11 tipos) · MetodoPago (TARJETA·EFECTIVO) · Idioma (ES·EN) · Municipio (8 ciudades) · TipoComision

## Integraciones Externas
| Servicio | Uso | Env vars |
|----------|-----|----------|
| **Bold** | Pagos (hash HMAC SHA256, 6% comisión) | `BOLD_SECRET_KEY`, `BOLD_PUBLIC_KEY`, `BOLD_MODE` |
| **Google Calendar** | Sync al confirmar/cancelar reservas | `GOOGLE_*` |
| **Nodemailer/Resend** | Correos confirmación, asignación, cancelación | `SMTP_*` |
| **Cloudinary/Vercel Blob** | Imágenes servicios y vehículos | `BLOB_READ_WRITE_TOKEN` |
| **n8n** | Webhooks automatización (`x-api-key`) | `N8N_API_KEY` |
| **Neon/Railway** | PostgreSQL serverless | `DATABASE_URL` |
| **NextAuth** | Auth admin JWT | `NEXTAUTH_SECRET` |

## Convenciones Clave
- API mutantes (POST/PUT/DELETE): `getServerSession(authOptions)` obligatorio
- Webhooks n8n: `checkApiKey()` de `lib/api/n8n/_auth.ts`
- API de socios: `resolveSocio()` de `app/api/socios/_auth.ts` (llave por socio en BD, revocable con `activo: false`)
- `'use client'` solo cuando hay estado/efectos; default Server Component
- Prisma exclusivamente vía singleton `@/lib/prisma`
- Campos multiidioma: `Json { es: string, en: string }`
- Precios: `priceCalculator.ts` — el precio base de la reserva viene de `ServicioVehiculo.precio` (por capacidad de vehículo). Se suman adicionales (`camposDinamicos`), recargo nocturno y tarifa de municipio. En modo aliado la comisión viene de `PrecioVehiculoAliado` (porcentaje o fijo) por par (servicio, vehículo)
- Estados: solo `state-transitions.ts` cambia `estado` de reserva
- Seeds: `upsert` en todo (idempotentes)
- Tests: Vitest (unitarios/integración) + Playwright (E2E)

## Paleta y Estilo
Negro `#0A0A0A` · Dorado `#D6A75D` · Dorado claro `#F2C94C`
Público: fondo negro/dorado (estética lujo) · Admin: blanco/gris (funcional)
Iconos: `react-icons/fi` admin · `@tabler/icons-react` landing · Toast: `sonner`

## Diagramas
Los diagramas fuente viven en `docs/diagrams/`. Edita el `.mmd` y corre `npm run diagrams` para regenerar los links de mermaid.ai en esta tabla.

| Diagrama | Fuente |
|----------|--------|
| Base de datos (ERD) | `docs/diagrams/base-de-datos.mmd` |
| Arquitectura | `docs/diagrams/arquitectura.mmd` |

> **OBLIGATORIO:** Cada vez que se haga un cambio en `prisma/schema.prisma` (nuevos modelos, campos, relaciones) o en la arquitectura general (nuevas rutas, servicios, integraciones externas), se deben actualizar los diagramas:
> 1. Editar el `.mmd` correspondiente en `docs/diagrams/`
> 2. Correr `npm run diagrams` para regenerar los links de mermaid.ai
> Esto aplica para cualquier agente AI o desarrollador que modifique el proyecto.
