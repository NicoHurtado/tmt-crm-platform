-- AlterEnum
ALTER TYPE "TipoServicio" ADD VALUE 'TRANSPORTE_POR_HORAS';

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "cantidadHoras" INTEGER;

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "esPorHoras" BOOLEAN NOT NULL DEFAULT false;
