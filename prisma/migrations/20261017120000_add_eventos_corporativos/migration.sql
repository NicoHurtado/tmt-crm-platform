-- AlterTable
ALTER TABLE "Aliado" ADD COLUMN     "corporativoActivo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EventoCorporativo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "aliadoId" TEXT,
    "empresa" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'Aeropuerto José María Córdova',
    "destino" TEXT NOT NULL DEFAULT 'Medellín',
    "precioPorPersona" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "servicioId" TEXT,
    "contactoNombre" TEXT,
    "contactoEmail" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoCorporativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoCorporativo" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 14,
    "vehiculo" TEXT DEFAULT 'Van 14 pasajeros',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "precioPorPersona" DOUBLE PRECISION,
    "reservaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurnoCorporativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupoCorporativo" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "numeroVuelo" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CupoCorporativo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoCorporativo_codigo_key" ON "EventoCorporativo"("codigo");

-- CreateIndex
CREATE INDEX "EventoCorporativo_aliadoId_idx" ON "EventoCorporativo"("aliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TurnoCorporativo_reservaId_key" ON "TurnoCorporativo"("reservaId");

-- CreateIndex
CREATE INDEX "TurnoCorporativo_eventoId_idx" ON "TurnoCorporativo"("eventoId");

-- CreateIndex
CREATE INDEX "CupoCorporativo_turnoId_idx" ON "CupoCorporativo"("turnoId");

-- CreateIndex
CREATE UNIQUE INDEX "CupoCorporativo_eventoId_email_key" ON "CupoCorporativo"("eventoId", "email");

-- AddForeignKey
ALTER TABLE "EventoCorporativo" ADD CONSTRAINT "EventoCorporativo_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCorporativo" ADD CONSTRAINT "TurnoCorporativo_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCorporativo" ADD CONSTRAINT "TurnoCorporativo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoCorporativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupoCorporativo" ADD CONSTRAINT "CupoCorporativo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoCorporativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupoCorporativo" ADD CONSTRAINT "CupoCorporativo_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCorporativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Servicio corporativo por cupos: todos los aliados arrancan desactivados,
-- excepto LOVELYTICS (código 197157), el primer cliente corporativo.
UPDATE "Aliado" SET "corporativoActivo" = true WHERE "codigo" = '197157';
