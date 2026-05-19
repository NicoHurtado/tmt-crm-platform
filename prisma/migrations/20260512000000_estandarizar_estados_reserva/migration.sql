-- Step 1: Add origen column
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'web_directa';

-- Step 2: Convert estado column to text temporarily
ALTER TABLE "Reserva" ALTER COLUMN "estado" TYPE TEXT;

-- Step 3: Migrate data (old values → new values)
UPDATE "Reserva" SET "estado" = 'CONFIRMED_UNASSIGNED' WHERE "estado" = 'PENDIENTE_COTIZACION';
UPDATE "Reserva" SET "estado" = 'PENDING_PAYMENT' WHERE "estado" = 'CONFIRMADA_PENDIENTE_PAGO';
UPDATE "Reserva" SET "estado" = 'CONFIRMED_UNASSIGNED' WHERE "estado" = 'PAGADA_PENDIENTE_ASIGNACION';
UPDATE "Reserva" SET "estado" = 'CONFIRMED_UNASSIGNED' WHERE "estado" = 'CONFIRMADA_PENDIENTE_ASIGNACION';
UPDATE "Reserva" SET "estado" = 'CONFIRMED_ASSIGNED' WHERE "estado" = 'ASIGNADA_PENDIENTE_COMPLETAR';
UPDATE "Reserva" SET "estado" = 'COMPLETED' WHERE "estado" = 'COMPLETADA';
UPDATE "Reserva" SET "estado" = 'CANCELLED' WHERE "estado" = 'CANCELADA';
UPDATE "Reserva" SET "estado" = 'CONFIRMED_UNASSIGNED' WHERE "estado" = 'HOTEL_CONFIRMADO';
-- Catch-all: any unknown legacy value → CONFIRMED_UNASSIGNED
UPDATE "Reserva" SET "estado" = 'CONFIRMED_UNASSIGNED' WHERE "estado" NOT IN ('PENDING_PAYMENT','CONFIRMED_UNASSIGNED','CONFIRMED_ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED','PAYMENT_FAILED');

-- Step 4: Drop old enum type
DROP TYPE IF EXISTS "EstadoReserva";

-- Step 5: Create new enum type
CREATE TYPE "EstadoReserva" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED_UNASSIGNED', 'CONFIRMED_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED');

-- Step 6: Convert estado column back to use new enum
ALTER TABLE "Reserva" ALTER COLUMN "estado" TYPE "EstadoReserva" USING "estado"::"EstadoReserva";
