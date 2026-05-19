-- AlterTable
ALTER TABLE "Calificacion" ADD COLUMN     "destacada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ordenDestacada" INTEGER;

-- CreateIndex
CREATE INDEX "Calificacion_destacada_idx" ON "Calificacion"("destacada");
