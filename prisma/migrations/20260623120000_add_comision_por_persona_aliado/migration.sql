-- Comisión configurable por aliado para tours POR_PERSONA.
-- null = comportamiento automático por tipo de aliado (HOTEL/AIRBNB +10%, AGENCIA −10%).
ALTER TABLE "ServicioAliado" ADD COLUMN "comisionPorPersonaTipo" "TipoComision";
ALTER TABLE "ServicioAliado" ADD COLUMN "comisionPorPersonaValor" DECIMAL(10,2);
