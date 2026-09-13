-- Global darkvision overlay opacity — the DM's single dial for how dark/gray
-- the darkvision-only zone (revealed by darkvisionRadius, not by real light)
-- renders for every token on the map. Non-destructive: 0.2 matches the
-- existing renderer's intended default so maps created before this column
-- existed keep the same look.
ALTER TABLE "Map" ADD COLUMN "darkvisionOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.2;
