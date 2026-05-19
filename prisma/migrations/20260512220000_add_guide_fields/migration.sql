-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN "guiaEspanolDisponible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Servicio" ADD COLUMN "precioGuiaEspanol" DECIMAL(10,2);
ALTER TABLE "Servicio" ADD COLUMN "guiaInglesDisponible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Servicio" ADD COLUMN "precioGuiaIngles" DECIMAL(10,2);
