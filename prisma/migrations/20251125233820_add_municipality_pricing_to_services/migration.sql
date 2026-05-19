/*
  Warnings:

  - You are about to drop the column `requiereAeropuerto` on the `Servicio` table. All the data in the column will be lost.
  - You are about to drop the column `requiereDireccionAeropuerto` on the `Servicio` table. All the data in the column will be lost.
  - You are about to drop the column `requiereInfoVuelo` on the `Servicio` table. All the data in the column will be lost.
  - You are about to drop the column `requiereLugarRecogida` on the `Servicio` table. All the data in the column will be lost.
  - Changed the type of `nombre` on the `Servicio` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `descripcion` on the `Servicio` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `incluye` on the `Servicio` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoCampo" AS ENUM ('TEXT', 'SELECT', 'SWITCH', 'COUNTER', 'TEXTAREA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Municipio" ADD VALUE 'POBLADO';
ALTER TYPE "Municipio" ADD VALUE 'LAURELES';

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "datosDinamicos" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "Servicio" DROP COLUMN "requiereAeropuerto",
DROP COLUMN "requiereDireccionAeropuerto",
DROP COLUMN "requiereInfoVuelo",
DROP COLUMN "requiereLugarRecogida",
ADD COLUMN     "camposPersonalizados" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "destinoAutoFill" TEXT,
ADD COLUMN     "esAeropuerto" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "nombre",
ADD COLUMN     "nombre" JSONB NOT NULL,
DROP COLUMN "descripcion",
ADD COLUMN     "descripcion" JSONB NOT NULL,
DROP COLUMN "incluye",
ADD COLUMN     "incluye" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "ServicioAliado" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicioAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioVehiculoAliado" (
    "id" TEXT NOT NULL,
    "servicioAliadoId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "comision" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioVehiculoAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaMunicipioAliado" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "municipio" "Municipio" NOT NULL,
    "valorExtra" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaMunicipioAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_antigua" (
    "id" SERIAL NOT NULL,
    "hora_reserva" TIMESTAMP(3),
    "canal" TEXT,
    "nombre" TEXT,
    "idioma" TEXT,
    "fecha" DATE,
    "hora" TIME,
    "servicio" TEXT,
    "vehiculo" TEXT,
    "numero_vuelo" TEXT,
    "numero_contacto" TEXT,
    "cotizacion" TEXT,
    "comision" TEXT,
    "informacion_adicional" TEXT,
    "estado_servicio" TEXT,
    "estado_pago" TEXT,
    "conductor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bd_antigua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_municipio_servicio" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "municipio" "Municipio" NOT NULL,
    "valorExtra" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "tarifas_municipio_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicioAliado_aliadoId_idx" ON "ServicioAliado"("aliadoId");

-- CreateIndex
CREATE INDEX "ServicioAliado_servicioId_idx" ON "ServicioAliado"("servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioAliado_aliadoId_servicioId_key" ON "ServicioAliado"("aliadoId", "servicioId");

-- CreateIndex
CREATE INDEX "PrecioVehiculoAliado_servicioAliadoId_idx" ON "PrecioVehiculoAliado"("servicioAliadoId");

-- CreateIndex
CREATE INDEX "PrecioVehiculoAliado_vehiculoId_idx" ON "PrecioVehiculoAliado"("vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioVehiculoAliado_servicioAliadoId_vehiculoId_key" ON "PrecioVehiculoAliado"("servicioAliadoId", "vehiculoId");

-- CreateIndex
CREATE INDEX "TarifaMunicipioAliado_aliadoId_idx" ON "TarifaMunicipioAliado"("aliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaMunicipioAliado_aliadoId_municipio_key" ON "TarifaMunicipioAliado"("aliadoId", "municipio");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_municipio_servicio_servicioId_municipio_key" ON "tarifas_municipio_servicio"("servicioId", "municipio");

-- AddForeignKey
ALTER TABLE "ServicioAliado" ADD CONSTRAINT "ServicioAliado_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAliado" ADD CONSTRAINT "ServicioAliado_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioVehiculoAliado" ADD CONSTRAINT "PrecioVehiculoAliado_servicioAliadoId_fkey" FOREIGN KEY ("servicioAliadoId") REFERENCES "ServicioAliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioVehiculoAliado" ADD CONSTRAINT "PrecioVehiculoAliado_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaMunicipioAliado" ADD CONSTRAINT "TarifaMunicipioAliado_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifas_municipio_servicio" ADD CONSTRAINT "tarifas_municipio_servicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
