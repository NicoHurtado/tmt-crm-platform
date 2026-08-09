-- Add optional image/logo column to Aliado for public hotel cards.
-- Additive, non-destructive: nullable column, no data loss.
ALTER TABLE "Aliado" ADD COLUMN "imagen" TEXT;
