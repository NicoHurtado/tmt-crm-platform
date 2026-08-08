# Responsive del panel admin — resumen para retomar

Rama: `feat/responsive`. Trabajo en curso, no mergeado a `main`.

## Qué se hizo

El admin (`/admin/dashboard/*`) no era usable en móvil: el layout general tenía
un bug estructural que rompía casi todas las pantallas, varias vistas
desbordaban horizontalmente, y muchos controles eran demasiado chicos para
tocar con el dedo (mínimo recomendado: 44px).

Se arregló, en este orden:

1. **Layout general** (`components/admin/AdminLayout.tsx`) — el contenedor
   raíz era `flex` en fila; en móvil la barra superior quedaba al lado del
   contenido en vez de encima. Este solo cambio arregló la mayoría de páginas.
2. **Desbordes puntuales** en `reservas`, `conductores`, `aliados`, el panel
   lateral y la página de detalle de una reserva, y `terminos`.
3. **Calendario** (`CalendarioView.tsx`) — barra de FullCalendar reorganizada
   para móvil + botones a 44px solo bajo `pointer: coarse` (o sea, con mouse
   no cambia nada).
4. **Objetivos táctiles** — menú móvil, formulario de crear servicio, e
   iconos de acción en tablas (editar/eliminar/etc). Se usa una utilidad
   nueva en `globals.css`: `.area-tactil` / `.area-tactil-completa`, que solo
   aplica en pantallas táctiles.

## Cómo se verificó

Hay un test e2e nuevo: `tests/e2e/responsive.spec.ts`. Recorre las páginas
públicas y las del admin en dos tamaños de teléfono (iPhone 14 y Pixel 7) y
falla si el ancho del documento excede el de la pantalla — eso detecta
desbordes automáticamente. Correrlo con:

```bash
npx playwright test responsive --project=mobile-iphone
npx playwright test responsive --project=mobile-android
```

Cada commit se verificó además con capturas manuales en móvil y escritorio, y
smoke tests de la funcionalidad afectada (que los filtros sigan filtrando, que
los diálogos sigan abriendo, etc). Escritorio no debería haber cambiado en
nada — todo el trabajo usa clases `sm:`/`lg:`/`pointer: coarse` para no tocar
el layout de escritorio.

**Estado de la suite:** una corrida anterior tuvo timeouts por presión de
memoria en la máquina de desarrollo (el servidor `next dev` llevaba horas
corriendo y acumuló ~3.3GB de RAM). Se reinició el servidor de dev y se corrió
la suite completa de nuevo en limpio: **27/27 pasando, 2.8 minutos** (antes
tardaba 18-19 min con varios timeouts). Confirma que los timeouts eran del
entorno, no de la app — en ninguna corrida, ni la lenta ni la limpia, hubo un
solo error real de desborde.

## Segunda etapa: el admin pensado para móvil, módulo por módulo

La primera etapa solo quitó desbordes. Esta cambia cómo se muestra la
información por debajo de `lg` (1024px), sin tocar escritorio y sin instalar
nada nuevo.

### Las tres decisiones de fondo

1. **Las tablas se vuelven tarjetas.** Una tabla de 8–12 columnas en 375px no
   tiene salida honesta: o se encoge la letra hasta lo ilegible, o se esconde
   media tabla tras un scroll horizontal donde uno pierde de vista a qué fila
   pertenece lo que está leyendo. Cada fila pasa a ser una tarjeta con los
   campos etiquetados y jerarquizados: lo que identifica al registro arriba,
   el resto como pares etiqueta/valor, el dinero y las acciones en el pie.
2. **Los filtros se van a un bottom sheet, con chips de lo aplicado.** En la
   barra solo quedan la búsqueda y un botón "Filtros (N)". El sheet ocupa el
   ancho entero con cada control a 44px. Los chips debajo de la barra existen
   porque con el sheet cerrado no se ve qué está filtrado, y una lista de 1700
   reservas mostrando 3 es justo el caso donde uno cree que "no hay datos".
3. **Los objetivos táctiles suben a 44px.** Filas de 5–7 iconos de 26px pegados
   (aliados, cotizaciones) se reparten en botones separados.

### Qué cambió en cada módulo

| Módulo | En móvil |
|---|---|
| **Reservas** | Tabla de 12 columnas → tarjetas. Filtros (7) → sheet + chips. "Pago conductor" pasa de un cuadrito de 28px a botón con etiqueta: es la acción que más se hace en ruta. Paginación con Anterior/Siguiente de 44px. |
| **Cotizaciones** | Tabla de 10 columnas → tarjetas. Los 3 iconos de acción (ver, copiar link, abrir tracking) → botones de 44px. Pestañas con scroll horizontal. |
| **Calendario** | Rejilla de mes → **agenda**: días en lista vertical con cabecera pegajosa y, dentro de cada día, sus reservas con hora. En 375px una celda de mes mide ~50px y todo terminaba en "+3 más". La leyenda de 8 estados se pliega en un desplegable. |
| **Estadísticas** | KPIs a 2 por fila (la sparkline se esconde: a 60px no comunica nada y le roba espacio al número). Padding de tarjetas y filas de capacidad reflowed. |
| **Servicios** | Filtros → sheet. Pestañas y franja de categorías con scroll horizontal en vez de envolverse en cuatro renglones. |
| **Vehículos** | Rejilla de columnas fijas (64+160+80+88px) → tarjetas con Editar/Eliminar a 44px. |
| **Aliados** | Tabla de 8 columnas → tarjetas. Los 7 iconos de acción → "Editar" + 4 botones de 44px. |
| **Conductores** | Tabla de 8 columnas → tarjetas con foto, placa y estados arriba; WhatsApp como botón propio. |
| **Estado General** | Padding y tamaño de título. |
| **Tour Compartido** | Las dos columnas fijas (272px + lista) se apilan; era el último desborde que quedaba (614px). |

### Las piezas compartidas

Viven en `components/admin/responsive/`:

- `AdminPage` / `AdminPageHeader` / `AdminTabs` — contenedor, encabezado y pestañas
- `FilterShell` + `FilterField` — barra de filtros que en móvil se vuelve sheet
- `ComboboxFilter` — selector con buscador **con su estado de apertura por dentro**
- `DataCard` y compañía — las piezas del modo tarjeta
- `Pagination` — paginación que cambia de forma según el ancho

> **Ojo con `FilterShell`:** monta sus hijos dos veces (barra de escritorio y
> sheet de móvil). El estado vive en la página, así que las dos copias no se
> pueden desincronizar, pero **ningún control de adentro debe recibir su `open`
> desde afuera**: un Popover con apertura controlada abriría sus dos portales a
> la vez y el escondido aparecería flotando. Por eso existe `ComboboxFilter`.

En `globals.css` se agregó `.filtros-movil`, que estira los controles del sheet
a todo el ancho y 44px de alto sin tener que tocar el className de cada filtro.

### Cómo se verificó

- `npx playwright test responsive` — **54/54 en verde** (iPhone 14 y Pixel 7).
- Captura de las 9 pantallas a 375px: **0px de desborde en todas**.
- Regresión de escritorio a 1440px: reservas sigue con 12 columnas y 20 filas,
  aliados con 8 y conductores con 8; **ninguna tarjeta de móvil se ve** a ese
  ancho, y no hay desborde.

### Pendiente conocido

`components/ui/button.tsx` no reenvía refs (`function Button` sin
`forwardRef`), lo que llena la consola de "Function components cannot be given
refs" en las páginas con `PopoverTrigger asChild`. Es **previo** a este trabajo
—el mismo patrón ya estaba en reservas— pero conviene arreglarlo: sin ref,
Radix no puede posicionar el popover contra el trigger real.

## Acceso al admin desde la landing

El enlace visible **"Acceso Admin"** del footer se quitó: exponía
`/admin/login` a cualquier visitante. Ahora no hay ningún `<a href="/admin…">`
en el HTML de la landing.

En su lugar, en el **menú móvil** (`components/landing/Header.tsx`) el
separador decorativo que está entre "Testimonios" y el selector de idioma es
un disparador oculto: **5 toques seguidos** sobre esa línea abren
`/admin/login`. Si pasan más de 2 segundos entre toques, la cuenta se
reinicia. No tiene etiqueta, ni cursor de mano, ni feedback visual — es a
propósito, para que solo lo sepa quien lo tenga que saber. El área táctil real
es de 144×41px aunque la línea visible siga siendo de 1px.

En escritorio no hay acceso desde la UI: se entra escribiendo
`/admin/login` en la barra del navegador.

> Esto es ofuscación, no seguridad. Lo que protege el admin sigue siendo
> NextAuth + `middleware.ts`; el gesto solo evita que la puerta esté a la
> vista.

## Falta por hacer

- Botones `size="sm"` de shadcn (24–36px) en varias pantallas del admin
- Landing y `/reservas` públicos también tienen controles bajo 44px
- Limpiar los scripts `tmp-*.ts` de la raíz (son de diagnóstico, no se
  commitearon, pero conviene borrarlos del working tree)
