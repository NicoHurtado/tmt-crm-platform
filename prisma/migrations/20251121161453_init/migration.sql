-- CreateEnum
CREATE TYPE "TipoAliado" AS ENUM ('HOTEL', 'AIRBNB');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('TRANSPORTE_AEROPUERTO', 'CITY_TOUR', 'TOUR_GUATAPE', 'TOUR_PARAPENTE', 'TOUR_ATV', 'TOUR_HACIENDA_NAPOLES', 'TOUR_OCCIDENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE_COTIZACION', 'CONFIRMADA_PENDIENTE_PAGO', 'PAGADA_PENDIENTE_ASIGNACION', 'ASIGNADA_PENDIENTE_COMPLETAR', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'PROCESANDO');

-- CreateEnum
CREATE TYPE "Idioma" AS ENUM ('ES', 'EN');

-- CreateEnum
CREATE TYPE "Municipio" AS ENUM ('MEDELLIN', 'SABANETA', 'BELLO', 'ITAGUI', 'ENVIGADO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'PASAPORTE', 'TI', 'CE');

-- CreateEnum
CREATE TYPE "TipoAdicional" AS ENUM ('FIJO', 'POR_PERSONA', 'POR_CANTIDAD');

-- CreateEnum
CREATE TYPE "AeropuertoTipo" AS ENUM ('DESDE', 'HACIA');

-- CreateEnum
CREATE TYPE "AeropuertoNombre" AS ENUM ('JOSE_MARIA_CORDOVA', 'OLAYA_HERRERA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aliado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoAliado" NOT NULL,
    "codigo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoServicio" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "imagen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "duracion" TEXT,
    "incluye" TEXT[],
    "precioBase" DECIMAL(10,2) NOT NULL,
    "aplicaRecargoNocturno" BOOLEAN NOT NULL DEFAULT false,
    "recargoNocturnoInicio" TEXT,
    "recargoNocturnoFin" TEXT,
    "montoRecargoNocturno" DECIMAL(10,2),
    "requiereLugarRecogida" BOOLEAN NOT NULL DEFAULT false,
    "requiereInfoVuelo" BOOLEAN NOT NULL DEFAULT false,
    "requiereAeropuerto" BOOLEAN NOT NULL DEFAULT false,
    "requiereDireccionAeropuerto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidadMinima" INTEGER NOT NULL,
    "capacidadMaxima" INTEGER NOT NULL,
    "imagen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioVehiculo" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ServicioVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conductor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fotosVehiculo" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombreCliente" TEXT NOT NULL,
    "whatsappCliente" TEXT NOT NULL,
    "emailCliente" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT NOT NULL,
    "idioma" "Idioma" NOT NULL,
    "municipio" "Municipio" NOT NULL,
    "otroMunicipio" TEXT,
    "numeroPasajeros" INTEGER NOT NULL,
    "vehiculoId" TEXT,
    "aeropuertoTipo" "AeropuertoTipo",
    "aeropuertoNombre" "AeropuertoNombre",
    "numeroVuelo" TEXT,
    "lugarRecogida" TEXT,
    "guiaCertificado" BOOLEAN NOT NULL DEFAULT false,
    "vueltaBote" BOOLEAN NOT NULL DEFAULT false,
    "cantidadAlmuerzos" INTEGER NOT NULL DEFAULT 0,
    "cantidadMotos" INTEGER NOT NULL DEFAULT 0,
    "cantidadParticipantes" INTEGER NOT NULL DEFAULT 0,
    "precioBase" DECIMAL(10,2) NOT NULL,
    "precioAdicionales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "recargoNocturno" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tarifaMunicipio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descuentoAliado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "precioTotal" DECIMAL(10,2) NOT NULL,
    "comisionBold" DECIMAL(10,2),
    "comisionAliado" DECIMAL(10,2),
    "estado" "EstadoReserva" NOT NULL,
    "estadoPago" "EstadoPago",
    "conductorId" TEXT,
    "conductorAsignadoAt" TIMESTAMP(3),
    "aliadoId" TEXT,
    "esReservaAliado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "notasInternas" TEXT,
    "hashPago" TEXT,
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceladaAt" TIMESTAMP(3),

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistente" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioAdicional" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "tipo" "TipoAdicional" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicioAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaAdicional" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "adicionalId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "precioTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReservaAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaAliado" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "precioEspecial" DECIMAL(10,2),
    "comisionPorcentaje" DECIMAL(5,2) NOT NULL,
    "descuentoEspecial" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "nombreCliente" TEXT NOT NULL,
    "esPublica" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Aliado_codigo_key" ON "Aliado"("codigo");

-- CreateIndex
CREATE INDEX "Aliado_codigo_idx" ON "Aliado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioVehiculo_servicioId_vehiculoId_key" ON "ServicioVehiculo"("servicioId", "vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_codigo_key" ON "Reserva"("codigo");

-- CreateIndex
CREATE INDEX "Reserva_codigo_idx" ON "Reserva"("codigo");

-- CreateIndex
CREATE INDEX "Reserva_estado_idx" ON "Reserva"("estado");

-- CreateIndex
CREATE INDEX "Reserva_fecha_idx" ON "Reserva"("fecha");

-- CreateIndex
CREATE INDEX "Reserva_servicioId_idx" ON "Reserva"("servicioId");

-- CreateIndex
CREATE INDEX "Reserva_aliadoId_idx" ON "Reserva"("aliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaAdicional_reservaId_adicionalId_key" ON "ReservaAdicional"("reservaId", "adicionalId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaAliado_aliadoId_servicioId_key" ON "TarifaAliado"("aliadoId", "servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_reservaId_key" ON "Calificacion"("reservaId");

-- CreateIndex
CREATE INDEX "Calificacion_esPublica_idx" ON "Calificacion"("esPublica");

-- CreateIndex
CREATE INDEX "Calificacion_createdAt_idx" ON "Calificacion"("createdAt");

-- AddForeignKey
ALTER TABLE "ServicioVehiculo" ADD CONSTRAINT "ServicioVehiculo_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioVehiculo" ADD CONSTRAINT "ServicioVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistente" ADD CONSTRAINT "Asistente_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAdicional" ADD CONSTRAINT "ServicioAdicional_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaAdicional" ADD CONSTRAINT "ReservaAdicional_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaAdicional" ADD CONSTRAINT "ReservaAdicional_adicionalId_fkey" FOREIGN KEY ("adicionalId") REFERENCES "ServicioAdicional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaAliado" ADD CONSTRAINT "TarifaAliado_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaAliado" ADD CONSTRAINT "TarifaAliado_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
