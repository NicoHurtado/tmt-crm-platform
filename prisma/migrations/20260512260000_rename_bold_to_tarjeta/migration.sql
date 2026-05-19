-- Rename MetodoPago enum value BOLD → TARJETA
ALTER TYPE "MetodoPago" RENAME VALUE 'BOLD' TO 'TARJETA';

-- Update default values on Reserva and Pedido tables
ALTER TABLE "Reserva" ALTER COLUMN "metodoPago" SET DEFAULT 'TARJETA';
ALTER TABLE "Pedido" ALTER COLUMN "metodoPago" SET DEFAULT 'TARJETA';
