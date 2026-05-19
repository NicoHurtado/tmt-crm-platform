-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('BOLD', 'EFECTIVO');

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "metodoPago" "MetodoPago" NOT NULL DEFAULT 'BOLD';
