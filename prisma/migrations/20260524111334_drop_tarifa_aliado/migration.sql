-- DropForeignKey
ALTER TABLE "TarifaAliado" DROP CONSTRAINT "TarifaAliado_aliadoId_fkey";

-- DropForeignKey
ALTER TABLE "TarifaAliado" DROP CONSTRAINT "TarifaAliado_servicioId_fkey";

-- DropTable
DROP TABLE "TarifaAliado";
