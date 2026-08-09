-- Auto-registro de conductores: link de invitación + marca en el conductor.
--
-- Estas dos cosas ya existían en `schema.prisma` y en la base de producción
-- (se aplicaron en su momento con `prisma db push`), pero nunca se generó la
-- migración. Una base levantada desde cero con `migrate deploy` se quedaba sin
-- la tabla y todo el flujo de registro respondía 500. Esta migración cierra ese
-- hueco.
--
-- Va escrita con IF NOT EXISTS a propósito: tiene que poder correr tanto sobre
-- una base vacía como sobre la de producción, donde los objetos ya están.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConductorInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConductorInvite_token_key" ON "ConductorInvite"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConductorInvite_token_idx" ON "ConductorInvite"("token");

-- AlterTable
ALTER TABLE "Conductor" ADD COLUMN IF NOT EXISTS "selfRegistered" BOOLEAN NOT NULL DEFAULT false;
