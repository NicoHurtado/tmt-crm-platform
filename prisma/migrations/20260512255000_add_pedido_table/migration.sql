-- CreateTable: Pedido (was missing from migration history)
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombreCliente" TEXT NOT NULL,
    "whatsappCliente" TEXT NOT NULL,
    "emailCliente" TEXT NOT NULL,
    "idioma" "Idioma" NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "comisionBold" DECIMAL(10,2) NOT NULL,
    "precioTotal" DECIMAL(10,2) NOT NULL,
    "estadoPago" "EstadoPago",
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'BOLD',
    "hashPago" TEXT,
    "pagoId" TEXT,
    "aliadoId" TEXT,
    "esReservaAliado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Pedido_codigo_key" ON "Pedido"("codigo");
CREATE INDEX "Pedido_codigo_idx" ON "Pedido"("codigo");
CREATE INDEX "Pedido_estadoPago_idx" ON "Pedido"("estadoPago");
CREATE INDEX "Pedido_createdAt_idx" ON "Pedido"("createdAt");

-- FK: Pedido → Aliado
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_aliadoId_fkey"
    FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add pedidoId to Reserva
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;
CREATE INDEX IF NOT EXISTS "Reserva_pedidoId_idx" ON "Reserva"("pedidoId");

-- FK: Reserva → Pedido
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
