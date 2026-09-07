-- Measurement System (Metric / Imperial) — Phase 1: schema + backfill
--
-- Map: distancePerSquare + distanceUnit replace the imperial-only feetPerSquare
-- as the source of truth for grid scale. feetPerSquare is kept (unused by new
-- code) so nothing that still reads it breaks.
ALTER TABLE "Map" ADD COLUMN "distancePerSquare" DOUBLE PRECISION NOT NULL DEFAULT 5;
ALTER TABLE "Map" ADD COLUMN "distanceUnit" TEXT NOT NULL DEFAULT 'ft';

-- Backfill: every existing map keeps its current numeric scale, now labeled 'ft'.
UPDATE "Map" SET "distancePerSquare" = "feetPerSquare"::double precision, "distanceUnit" = 'ft';

-- SystemSettings: instance-wide default unit, chosen in the Setup Wizard.
ALTER TABLE "SystemSettings" ADD COLUMN "distanceUnit" TEXT NOT NULL DEFAULT 'ft';
