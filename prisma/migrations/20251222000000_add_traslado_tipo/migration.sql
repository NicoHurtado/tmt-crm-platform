-- CreateEnum
CREATE TYPE "TrasladoTipo" AS ENUM ('DESDE_UBICACION', 'DESDE_MUNICIPIO');

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN "trasladoTipo" "TrasladoTipo",
ADD COLUMN "trasladoDestino" TEXT;
