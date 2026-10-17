-- Aliados que solo aceptan pago en efectivo (sin tarjeta/Bold).
-- IF NOT EXISTS para poder correr también sobre producción si ya se aplicó con db push.
ALTER TABLE "Aliado" ADD COLUMN IF NOT EXISTS "soloPagoEfectivo" BOOLEAN NOT NULL DEFAULT false;
