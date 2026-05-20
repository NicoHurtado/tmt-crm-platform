-- CreateEnum
CREATE TYPE "TipoAliado" AS ENUM ('HOTEL', 'AIRBNB', 'AGENCIA');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('FIJO', 'PORCENTAJE');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('TRANSPORTE_AEROPUERTO', 'CITY_TOUR', 'TOUR_GUATAPE', 'TOUR_PARAPENTE', 'TOUR_ATV', 'TOUR_HACIENDA_NAPOLES', 'TOUR_OCCIDENTE', 'OTRO', 'TRANSPORTE_POR_HORAS', 'TRANSPORTE_MUNICIPAL', 'TOUR_COMPARTIDO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED_UNASSIGNED', 'CONFIRMED_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'PROCESANDO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TARJETA', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "Idioma" AS ENUM ('ES', 'EN');

-- CreateEnum
CREATE TYPE "Municipio" AS ENUM ('MEDELLIN', 'SABANETA', 'BELLO', 'ITAGUI', 'ENVIGADO', 'OTRO', 'POBLADO', 'LAURELES');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'PASAPORTE', 'TI', 'CE');

-- CreateEnum
CREATE TYPE "TipoAdicional" AS ENUM ('FIJO', 'POR_PERSONA', 'POR_CANTIDAD');

-- CreateEnum
CREATE TYPE "TipoCampo" AS ENUM ('TEXT', 'SELECT', 'SWITCH', 'COUNTER', 'TEXTAREA');

-- CreateEnum
CREATE TYPE "AeropuertoTipo" AS ENUM ('DESDE', 'HACIA');

-- CreateEnum
CREATE TYPE "TrasladoTipo" AS ENUM ('DESDE_UBICACION', 'DESDE_MUNICIPIO');

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
    "linkToken" TEXT,
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
    "tipoServicio" "TipoServicio" NOT NULL DEFAULT 'OTRO',
    "esMunicipal" BOOLEAN NOT NULL DEFAULT false,
    "imagen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "duracion" TEXT,
    "precioBase" DECIMAL(10,2) NOT NULL,
    "aplicaRecargoNocturno" BOOLEAN NOT NULL DEFAULT false,
    "recargoNocturnoInicio" TEXT,
    "recargoNocturnoFin" TEXT,
    "montoRecargoNocturno" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "configuracion" JSONB NOT NULL DEFAULT '{}',
    "destinoAutoFill" TEXT,
    "esAeropuerto" BOOLEAN NOT NULL DEFAULT false,
    "esTraslado" BOOLEAN NOT NULL DEFAULT false,
    "nombre" JSONB NOT NULL,
    "descripcion" JSONB NOT NULL,
    "incluye" JSONB NOT NULL,
    "esPorHoras" BOOLEAN NOT NULL DEFAULT false,
    "esCompartido" BOOLEAN NOT NULL DEFAULT false,
    "guiaEspanolDisponible" BOOLEAN NOT NULL DEFAULT false,
    "precioGuiaEspanol" DECIMAL(10,2),
    "guiaInglesDisponible" BOOLEAN NOT NULL DEFAULT false,
    "precioGuiaIngles" DECIMAL(10,2),
    "orden" INTEGER NOT NULL DEFAULT 999,

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
    "precioBase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioVehiculo" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "precio" DECIMAL(10,2),

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
    "telefono" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "foto" TEXT,

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
    "municipio" "Municipio",
    "otroMunicipio" TEXT,
    "numeroPasajeros" INTEGER NOT NULL,
    "vehiculoId" TEXT,
    "datos" JSONB NOT NULL DEFAULT '{}',
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
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TARJETA',
    "googleCalendarEventId" TEXT,
    "esCotizacion" BOOLEAN NOT NULL DEFAULT false,
    "linkCotizacion" TEXT,
    "precioManual" BOOLEAN NOT NULL DEFAULT false,
    "clientePaga" BOOLEAN NOT NULL DEFAULT true,
    "esPedido" BOOLEAN NOT NULL DEFAULT false,
    "origen" TEXT NOT NULL DEFAULT 'web_directa',
    "municipioConfigId" TEXT,
    "pedidoId" TEXT,

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
    "email" TEXT,
    "telefono" TEXT,

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
    "incluidoPorDefecto" BOOLEAN NOT NULL DEFAULT false,
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
    "comisionPorcentaje" DECIMAL(10,2) NOT NULL,
    "descuentoEspecial" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipoComision" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TARJETA',
    "hashPago" TEXT,
    "pagoId" TEXT,
    "aliadoId" TEXT,
    "esReservaAliado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
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
    "destacada" BOOLEAN NOT NULL DEFAULT false,
    "ordenDestacada" INTEGER,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioAliado" (
    "id" TEXT NOT NULL,
    "aliadoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aplicaRecargoNocturno" BOOLEAN,
    "montoRecargoNocturno" DECIMAL(10,2),
    "recargoNocturnoFin" TEXT,
    "recargoNocturnoInicio" TEXT,
    "sobrescribirRecargoNocturno" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServicioAliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioVehiculoAliado" (
    "id" TEXT NOT NULL,
    "servicioAliadoId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
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
CREATE TABLE "MunicipioConfig" (
    "id" TEXT NOT NULL,
    "nombreES" TEXT NOT NULL,
    "nombreEN" TEXT NOT NULL,
    "recargo" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MunicipioConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_antigua" (
    "id" SERIAL NOT NULL,
    "hora_reserva" TIMESTAMP(3),
    "canal" TEXT,
    "nombre" TEXT,
    "idioma" TEXT,
    "fecha" DATE,
    "hora" TIME(6),
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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Aliado_codigo_key" ON "Aliado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Aliado_linkToken_key" ON "Aliado"("linkToken");

-- CreateIndex
CREATE INDEX "Aliado_codigo_idx" ON "Aliado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ServicioVehiculo_servicioId_vehiculoId_key" ON "ServicioVehiculo"("servicioId", "vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_codigo_key" ON "Reserva"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_linkCotizacion_key" ON "Reserva"("linkCotizacion");

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
CREATE INDEX "Reserva_linkCotizacion_idx" ON "Reserva"("linkCotizacion");

-- CreateIndex
CREATE INDEX "Reserva_pedidoId_idx" ON "Reserva"("pedidoId");

-- CreateIndex
CREATE INDEX "Reserva_municipioConfigId_idx" ON "Reserva"("municipioConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaAdicional_reservaId_adicionalId_key" ON "ReservaAdicional"("reservaId", "adicionalId");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaAliado_aliadoId_servicioId_key" ON "TarifaAliado"("aliadoId", "servicioId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_codigo_key" ON "Pedido"("codigo");

-- CreateIndex
CREATE INDEX "Pedido_codigo_idx" ON "Pedido"("codigo");

-- CreateIndex
CREATE INDEX "Pedido_estadoPago_idx" ON "Pedido"("estadoPago");

-- CreateIndex
CREATE INDEX "Pedido_createdAt_idx" ON "Pedido"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_reservaId_key" ON "Calificacion"("reservaId");

-- CreateIndex
CREATE INDEX "Calificacion_esPublica_idx" ON "Calificacion"("esPublica");

-- CreateIndex
CREATE INDEX "Calificacion_createdAt_idx" ON "Calificacion"("createdAt");

-- CreateIndex
CREATE INDEX "Calificacion_destacada_idx" ON "Calificacion"("destacada");

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
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");

-- CreateIndex
CREATE INDEX "SiteContent_key_idx" ON "SiteContent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_municipio_servicio_servicioId_municipio_key" ON "tarifas_municipio_servicio"("servicioId", "municipio");

-- AddForeignKey
ALTER TABLE "ServicioVehiculo" ADD CONSTRAINT "ServicioVehiculo_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioVehiculo" ADD CONSTRAINT "ServicioVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_municipioConfigId_fkey" FOREIGN KEY ("municipioConfigId") REFERENCES "MunicipioConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "Conductor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistente" ADD CONSTRAINT "Asistente_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAdicional" ADD CONSTRAINT "ServicioAdicional_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaAdicional" ADD CONSTRAINT "ReservaAdicional_adicionalId_fkey" FOREIGN KEY ("adicionalId") REFERENCES "ServicioAdicional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaAdicional" ADD CONSTRAINT "ReservaAdicional_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaAliado" ADD CONSTRAINT "TarifaAliado_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaAliado" ADD CONSTRAINT "TarifaAliado_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_aliadoId_fkey" FOREIGN KEY ("aliadoId") REFERENCES "Aliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

