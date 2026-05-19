-- Drop the tipo column from Servicio — replaced by boolean flags (esAeropuerto, esCompartido, esMunicipal)
ALTER TABLE "Servicio" DROP COLUMN IF EXISTS "tipo";
