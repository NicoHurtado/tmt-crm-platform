-- Remove dead tables: ServicioAdicional, ReservaAdicional, and TipoAdicional enum
-- These tables had no admin UI and were never connected to the active extras system (DynamicFields)

DROP TABLE IF EXISTS "ReservaAdicional" CASCADE;
DROP TABLE IF EXISTS "ServicioAdicional" CASCADE;
DROP TYPE IF EXISTS "TipoAdicional";
