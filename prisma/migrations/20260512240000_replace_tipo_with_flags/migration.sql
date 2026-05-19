-- Add esMunicipal flag to replace tipo=TRANSPORTE_MUNICIPAL
ALTER TABLE "Servicio" ADD COLUMN "esMunicipal" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data: mark current TRANSPORTE_MUNICIPAL services
UPDATE "Servicio" SET "esMunicipal" = true WHERE "tipo" = 'TRANSPORTE_MUNICIPAL';

-- Make tipo nullable (no longer a required field)
ALTER TABLE "Servicio" ALTER COLUMN "tipo" DROP NOT NULL;
ALTER TABLE "Servicio" ALTER COLUMN "tipo" DROP DEFAULT;
