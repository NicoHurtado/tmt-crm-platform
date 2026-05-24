-- Refactor: precio por capacidad de vehículo, comisión por (servicio, vehículo) en aliados
-- Decisión: mantener ServicioVehiculo.precio nullable para no perder filas existentes;
-- el código de admin valida >0 al crear/editar y priceCalculator lanza error si no hay precio
-- configurado para el par (servicio, vehículo) en una reserva.

-- Quitar precio base del vehículo
ALTER TABLE "Vehiculo" DROP COLUMN IF EXISTS "precioBase";

-- Quitar precio base del servicio
ALTER TABLE "Servicio" DROP COLUMN IF EXISTS "precioBase";

-- TarifaAliado pasa a ser flag legacy (la comisión real se almacena por vehículo en PrecioVehiculoAliado)
ALTER TABLE "TarifaAliado" DROP COLUMN IF EXISTS "comisionPorcentaje";
ALTER TABLE "TarifaAliado" DROP COLUMN IF EXISTS "descuentoEspecial";
ALTER TABLE "TarifaAliado" DROP COLUMN IF EXISTS "tipoComision";
ALTER TABLE "TarifaAliado" DROP COLUMN IF EXISTS "precioEspecial";

-- Agregar comisión por vehículo dentro de PrecioVehiculoAliado
ALTER TABLE "PrecioVehiculoAliado"
    ADD COLUMN IF NOT EXISTS "comisionValor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "tipoComision" "TipoComision" NOT NULL DEFAULT 'PORCENTAJE';
