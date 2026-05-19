-- AlterTable
ALTER TABLE "ServicioAliado" ADD COLUMN     "aplicaRecargoNocturno" BOOLEAN,
ADD COLUMN     "montoRecargoNocturno" DECIMAL(10,2),
ADD COLUMN     "recargoNocturnoFin" TEXT,
ADD COLUMN     "recargoNocturnoInicio" TEXT,
ADD COLUMN     "sobrescribirRecargoNocturno" BOOLEAN NOT NULL DEFAULT false;
