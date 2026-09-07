-- Ambient Lighting & Environment (Outdoor/Indoor + ambient presets) — Phase A: schema only
--
-- Non-destructive: every existing map already behaves as "indoor" with full
-- darkness outside dynamic lighting, so the defaults (indoor / pitch_black /
-- opacity 1.0) preserve current behavior for maps created before this column
-- existed. Rendering the overlay is Phase B — this only adds the data model.
ALTER TABLE "Map" ADD COLUMN "environmentType" TEXT NOT NULL DEFAULT 'indoor';
ALTER TABLE "Map" ADD COLUMN "ambientLightPreset" TEXT NOT NULL DEFAULT 'pitch_black';
ALTER TABLE "Map" ADD COLUMN "ambientColor" TEXT;
ALTER TABLE "Map" ADD COLUMN "ambientOpacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
