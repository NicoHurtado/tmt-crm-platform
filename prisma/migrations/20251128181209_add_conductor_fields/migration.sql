/*
  Warnings:

  - You are about to drop the column `cantidadHoras` on the `Reserva` table. All the data in the column will be lost.
  - Added the required column `documento` to the `Conductor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placa` to the `Conductor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telefono` to the `Conductor` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add columns as nullable first
ALTER TABLE "Conductor" ADD COLUMN "telefono" TEXT;
ALTER TABLE "Conductor" ADD COLUMN "documento" TEXT;
ALTER TABLE "Conductor" ADD COLUMN "placa" TEXT;
ALTER TABLE "Conductor" ADD COLUMN "foto" TEXT;

-- Step 2: Update existing records with default values
-- Use the whatsapp number as telefono for existing conductores
UPDATE "Conductor" SET "telefono" = "whatsapp" WHERE "telefono" IS NULL;
UPDATE "Conductor" SET "documento" = 'POR_ACTUALIZAR' WHERE "documento" IS NULL;
UPDATE "Conductor" SET "placa" = 'POR_ACTUALIZAR' WHERE "placa" IS NULL;

-- Step 3: Make columns NOT NULL (except foto which is optional)
ALTER TABLE "Conductor" ALTER COLUMN "telefono" SET NOT NULL;
ALTER TABLE "Conductor" ALTER COLUMN "documento" SET NOT NULL;
ALTER TABLE "Conductor" ALTER COLUMN "placa" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reserva" DROP COLUMN "cantidadHoras";
