-- AlterTable
ALTER TABLE "PrecioVehiculoAliado" ADD COLUMN     "comisionValorOlaya" DECIMAL(10,2),
ADD COLUMN     "precioBaseOlaya" DECIMAL(10,2),
ADD COLUMN     "tipoComisionOlaya" "TipoComision";

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "aeropuertoNombre" "AeropuertoNombre";

-- AlterTable
ALTER TABLE "ServicioVehiculo" ADD COLUMN     "precioOlaya" DECIMAL(10,2);
