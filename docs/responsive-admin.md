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

**Pendiente:** la última corrida completa de la suite tuvo varios timeouts por
presión de memoria en la máquina de desarrollo (no por desbordes reales — cero
errores de "desborda" en los logs). Vale la pena correr la suite una vez más
en un entorno descansado antes de mergear.

## Falta por hacer

- Botones `size="sm"` de shadcn (24–36px) en varias pantallas del admin
- Landing y `/reservas` públicos también tienen controles bajo 44px
- Limpiar los scripts `tmp-*.ts` de la raíz (son de diagnóstico, no se
  commitearon, pero conviene borrarlos del working tree)
- Confirmar la suite completa en verde una vez más
