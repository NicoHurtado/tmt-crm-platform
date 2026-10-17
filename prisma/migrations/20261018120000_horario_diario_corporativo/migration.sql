-- Corporativo: de "salidas en fechas fijas" a "horario diario que se repite".
-- El funcionario escoge fecha y hora; la salida (TurnoCorporativo) de esa fecha/hora
-- se crea al reservar el primer cupo.

-- 1) Disponibilidad del link
ALTER TABLE "EventoCorporativo" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN     "fechaDesde" TEXT,
ADD COLUMN     "fechaHasta" TEXT;

-- 2) Horario diario
CREATE TABLE "HorarioCorporativo" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 15,
    "precioPorPersona" DOUBLE PRECISION,
    "vehiculo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorarioCorporativo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HorarioCorporativo_eventoId_hora_key" ON "HorarioCorporativo"("eventoId", "hora");
ALTER TABLE "HorarioCorporativo" ADD CONSTRAINT "HorarioCorporativo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoCorporativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TurnoCorporativo" ADD COLUMN     "horarioId" TEXT;
ALTER TABLE "TurnoCorporativo" ADD CONSTRAINT "TurnoCorporativo_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "HorarioCorporativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TurnoCorporativo_horarioId_idx" ON "TurnoCorporativo"("horarioId");

-- 3) Datos existentes: cada hora distinta de las salidas ya creadas pasa a ser una hora
--    del horario diario (con sus puestos, precio y vehículo).
INSERT INTO "HorarioCorporativo" ("id", "eventoId", "hora", "capacidad", "precioPorPersona", "vehiculo", "activo", "updatedAt")
SELECT DISTINCT ON (t."eventoId", to_char(t."fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'HH24:MI'))
       'hor_' || md5(t."eventoId" || to_char(t."fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'HH24:MI')),
       t."eventoId",
       to_char(t."fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'HH24:MI'),
       t."capacidad",
       t."precioPorPersona",
       t."vehiculo",
       t."activo",
       CURRENT_TIMESTAMP
FROM "TurnoCorporativo" t
ORDER BY t."eventoId", to_char(t."fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'HH24:MI'), t."fechaHora" DESC;

UPDATE "TurnoCorporativo" t SET "horarioId" = h."id"
FROM "HorarioCorporativo" h
WHERE h."eventoId" = t."eventoId"
  AND h."hora" = to_char(t."fechaHora" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota', 'HH24:MI');

-- 4) Las salidas sin ningún cupo ya no existen por adelantado: se borran junto con su
--    reserva vacía (solo si sigue sin asignar). Las que tienen cupos se conservan.
DELETE FROM "Reserva" r
USING "TurnoCorporativo" t
WHERE t."reservaId" = r."id"
  AND r."estado" = 'CONFIRMED_UNASSIGNED'
  AND r."conductorId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "CupoCorporativo" c WHERE c."turnoId" = t."id");

DELETE FROM "TurnoCorporativo" t
WHERE t."reservaId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "CupoCorporativo" c WHERE c."turnoId" = t."id");

-- 5) Una sola salida por evento + fecha/hora
CREATE UNIQUE INDEX "TurnoCorporativo_eventoId_fechaHora_key" ON "TurnoCorporativo"("eventoId", "fechaHora");
