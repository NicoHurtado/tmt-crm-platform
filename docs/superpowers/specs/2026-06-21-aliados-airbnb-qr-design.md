# Aliados en /reservas, QR de referido y thumbnails en admin — Diseño

Fecha: 2026-06-21

## Contexto

La página pública de reservas (`app/reservas/page.tsx`) muestra hoy una sola sección
"Hoteles aliados" alimentada por `GET /api/aliados/hoteles` (solo `tipo: HOTEL`).
Cada card lleva un botón verde de WhatsApp (`#25D366` + `FaWhatsapp`) que abre el chat
del propio aliado (`wa.me/<contacto>?text=...`).

El backoffice de aliados (`app/admin/dashboard/aliados/page.tsx`) lista los aliados en
una tabla sin imagen, aunque el modelo `Aliado` ya tiene un campo `imagen String?`.

Este diseño cubre cuatro cambios solicitados por el dueño del producto.

## Objetivos

1. Mostrar **Airbnbs** además de Hoteles en la página de reservas, en **dos filas
   separadas** ("Hoteles" y "Airbnbs"). Agencias quedan fuera por ahora, pero la
   consulta debe ser trivial de extender.
2. Hacer las cards de aliados **más minimalistas y sobrias**: sin verde y sin logo de
   WhatsApp. Al hacer clic se sigue abriendo el mismo enlace de WhatsApp que hoy.
3. En el admin de aliados, mostrar una **miniatura** de cada aliado si tiene `imagen`;
   si no, un **placeholder tipo skeleton** indicando que no tiene.
4. Nueva funcionalidad: el admin puede generar un **QR descargable** (y por tanto
   compartible como imagen) que lleva a un chat de WhatsApp con **Transportes Medellín
   Travel (+57 317 5177409)** con el texto:
   `"Holaa vengo de parte de {aliado} y quiero informacion para servicios de transporte"`.
   Disponible para **todo** aliado sin importar el tipo (HOTEL/AIRBNB/AGENCIA).

## No-objetivos

- No mostrar agencias en /reservas todavía.
- No cambiar el comportamiento del clic en las cards (sigue abriendo el `wa.me` del aliado).
- No tocar `prisma/schema.prisma` (se reutilizan `Aliado.imagen` y `Aliado.nombre`).

## Diseño

### 1. API: `GET /api/aliados/hoteles`

- Cambiar el `where` de `{ tipo: 'HOTEL', activo: true }` a
  `{ tipo: { in: ['HOTEL', 'AIRBNB'] }, activo: true }`.
- Añadir `tipo: true` al `select` para que el cliente pueda separar las filas.
- Respuesta: `{ success, data: [{ id, nombre, contacto, imagen, tipo }] }`.
- Se mantiene la ruta y el nombre del endpoint para no romper otros consumidores.

### 2. Página de reservas (`app/reservas/page.tsx`)

- `HotelAliado` gana `tipo: 'HOTEL' | 'AIRBNB'`.
- Derivar `hoteles = data.filter(tipo==='HOTEL')` y `airbnbs = data.filter(tipo==='AIRBNB')`.
- Renderizar dos `CarouselRow` independientes (cada una solo si tiene items):
  - `reservas.seccion_hoteles` (existente)
  - `reservas.seccion_airbnbs` (nuevo) — ES "Airbnbs", EN "Airbnbs".
- **Card sobria** (componente helper `renderPartnerCard(partner)` reutilizado por ambas filas):
  - Toda la card es un `<a href={waUrl}>` (misma URL/mensaje que hoy).
  - Quitar el botón verde y `FaWhatsapp`.
  - Pie de card: enlace sutil `Más información →` (`text-neutral-500 group-hover:text-[#D6A75D]`),
    con un `FiArrowRight`/chevron tenue. Borde suave (`border border-neutral-100`),
    sombra leve, más aire.
  - Si no hay `contacto` válido: mostrar texto tenue "Contacto no disponible" (igual que hoy).
- El mensaje y el cálculo de `waUrl` se conservan tal cual (`reservas.hoteles_mensaje`,
  `wa.me/<digits>?text=...`).

### 3. Admin aliados — miniatura (`app/admin/dashboard/aliados/page.tsx`)

- En la celda "Nombre" anteponer un contenedor de 36–40px:
  - Si `aliado.imagen`: `<img>` redondeado (`rounded-md object-cover`).
  - Si no: placeholder skeleton (`bg-neutral-100 border border-dashed border-neutral-200`)
    con un icono tenue (`ImageIcon`/`Building2` de lucide) centrado.
- Layout de la celda: `flex items-center gap-3` (thumbnail + nombre).

### 4. QR de referido (admin)

- Dependencia nueva: `qrcode` (+ `@types/qrcode`). Generación client-side a `<canvas>`,
  descarga vía `canvas.toDataURL('image/png')`. Sin llamadas externas.
- Constante compartida del número TMT: `573175177409` (de +57 317 5177409).
- Helper para construir el enlace:
  `https://wa.me/573175177409?text=` + `encodeURIComponent("Holaa vengo de parte de " + nombre + " y quiero informacion para servicios de transporte")`.
- Nuevo componente `components/admin/AliadoQRModal.tsx`:
  - Props: `{ open, onClose, aliado: { nombre } | null }`.
  - Renderiza el QR (~256px) en un canvas, con el nombre del aliado como caption debajo.
  - Botón **Descargar PNG**: exporta el canvas (idealmente con el nombre como pie incrustado
    dibujando en un canvas compuesto) como `qr-<codigo|nombre-slug>.png`.
  - Botón **Copiar enlace** opcional (barato, mejora "compartible") — incluirlo si no añade complejidad.
- En la tabla de aliados, nuevo botón de acción con icono `QrCode` (lucide) que abre el modal
  para ese aliado. Disponible para todos los tipos.

## Componentes y límites

- `AliadoQRModal` es autónomo: recibe el nombre del aliado, genera/descarga el QR; no conoce la tabla.
- `renderPartnerCard` aísla la UI de la card del partner; ambas filas la reutilizan.
- El endpoint sigue siendo la única fuente de partners públicos.

## Manejo de errores

- API: try/catch existente; devuelve 500 con `success:false` (sin cambios).
- QR: si `qrcode` falla al renderizar, mostrar mensaje de error en el modal y deshabilitar Descargar.
- Card: `waUrl` nulo → estado "Contacto no disponible".

## Pruebas

- Unit: helper de construcción del enlace de WhatsApp (número fijo + nombre con espacios/acentos
  correctamente encodeados).
- Unit/integration: filtro de partners (HOTEL + AIRBNB, excluye AGENCIA e inactivos).
- Manual/preview: dos filas en /reservas, card sin verde abre el `wa.me` correcto;
  thumbnails + skeleton en admin; modal QR genera y descarga PNG; el QR escaneado abre
  el chat con TMT y el texto correcto.

## Impacto en esquema/diagramas

Ninguno. No hay cambios en `prisma/schema.prisma` ni nuevas rutas/integraciones externas,
por lo que no se regeneran los diagramas.
