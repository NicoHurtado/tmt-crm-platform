-- CreateTable
CREATE TABLE "Socio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocioReserva" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "refExterna" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocioReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Socio_codigo_key" ON "Socio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_apiKey_key" ON "Socio"("apiKey");

-- CreateIndex
CREATE INDEX "Socio_apiKey_idx" ON "Socio"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "SocioReserva_reservaId_key" ON "SocioReserva"("reservaId");

-- CreateIndex
CREATE INDEX "SocioReserva_socioId_idx" ON "SocioReserva"("socioId");

-- CreateIndex
CREATE UNIQUE INDEX "SocioReserva_socioId_refExterna_key" ON "SocioReserva"("socioId", "refExterna");

-- AddForeignKey
ALTER TABLE "SocioReserva" ADD CONSTRAINT "SocioReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioReserva" ADD CONSTRAINT "SocioReserva_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

