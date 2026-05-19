-- AlterTable: add esTraslado flag to Servicio
ALTER TABLE "Servicio" ADD COLUMN "esTraslado" BOOLEAN NOT NULL DEFAULT false;
