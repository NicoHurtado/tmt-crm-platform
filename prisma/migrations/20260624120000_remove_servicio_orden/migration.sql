-- Elimina el campo de posición manual del catálogo de reservas.
-- El orden de presentación ahora es canónico por categoría (lib/servicio-categoria.ts),
-- decidido en el cliente (components/reservas/ServiceCatalog.tsx).
DROP INDEX IF EXISTS "Servicio_orden_idx";
ALTER TABLE "Servicio" DROP COLUMN IF EXISTS "orden";
