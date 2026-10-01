-- Aliados que solo aceptan pago con tarjeta (Bold), p. ej. Housy.
-- IF NOT EXISTS para poder correr también sobre producción si ya se aplicó con db push.
ALTER TABLE "Aliado" ADD COLUMN IF NOT EXISTS "soloPagoTarjeta" BOOLEAN NOT NULL DEFAULT false;
