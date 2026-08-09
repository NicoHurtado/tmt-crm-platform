-- CreateEnum
CREATE TYPE "CategoriaServicio" AS ENUM ('AEROPUERTO', 'TOUR_PERSONA', 'COMPARTIDO', 'TRASLADO', 'MUNICIPAL', 'OTRO');

-- CreateEnum
CREATE TYPE "ModeloPrecio" AS ENUM ('POR_VEHICULO', 'POR_HORAS', 'POR_PERSONA_TRAMOS', 'COMPARTIDO_POR_PERSONA');

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "categoriaServicio" "CategoriaServicio",
ADD COLUMN     "modeloPrecio" "ModeloPrecio";

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "categoria" "CategoriaServicio",
ADD COLUMN     "modeloPrecio" "ModeloPrecio";

-- CreateIndex
CREATE INDEX "Servicio_categoria_idx" ON "Servicio"("categoria");
