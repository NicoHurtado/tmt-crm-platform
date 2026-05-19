-- AlterTable
-- Add column only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Reserva' AND column_name = 'cantidadHoras'
    ) THEN
        ALTER TABLE "Reserva" ADD COLUMN "cantidadHoras" INTEGER;
    END IF;
END $$;








