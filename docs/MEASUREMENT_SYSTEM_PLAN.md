# Measurement System (Metric / Imperial) — Implementation Plan

Not started yet — analysis only. Branch `feat/measurement-system` exists but has
no diff against `main`. This doc is the plan to pick up when work begins; move
the relevant part to `CHANGELOG.md` as each phase ships and delete it from here.

## Problem

CozyVTT only supports the imperial grid (`feetPerSquare`, hardcoded "ft"
labels everywhere). Most of the world uses metric (1 square = 1.5 m). Need a
per-instance default (chosen in the Setup Wizard) with a per-map override.

## Design decision: unit-per-square, not runtime conversion

`feetPerSquare` is stored as an `Int` (1–100) on `Map` and validated as such
throughout (`backend/src/routes/maps.ts`, `backend/src/validators/campaignImport.ts`).
Converting ft↔m at runtime produces dirty rounded numbers (5 ft = 1.524 m).

Instead, follow the Foundry VTT model: a map stores **distance-per-square +
unit** (`distancePerSquare: Float`, `distanceUnit: 'ft' | 'm'`), not just a
feet count. A metric GM creates a map with `1.5` / `"m"`, an imperial GM with
`5` / `"ft"` — no conversion, just different labels and presets.

## Scope decisions (confirmed)

- **Character sheet stats** (speed, reach, range in D&D5e/PF2e stat blocks):
  stay stored in feet — these are game-rule numbers (RAW), not map measurements.
  Add a **display-only** conversion: show "30 ft (~9 m)" when the active unit
  is metric. No change to stored data or validation.
- **Existing maps**: migration marks all of them `distanceUnit='ft'` with the
  same numeric value, unchanged. No auto-conversion of live data.
- **Preference scope**: `SystemSettings` holds the instance-wide default (set
  in the Setup Wizard), but each map can still override ft/m independently in
  Create/Edit Map Modal.

## Phases (one verified commit each)

1. **Schema + types**
   - `backend/prisma/schema.prisma`: add `distanceUnit` to `SystemSettings`
     (instance default) and `distancePerSquare` + `distanceUnit` to `Map`.
   - Migration: backfill existing rows from `feetPerSquare` → `distanceUnit='ft'`,
     `distancePerSquare = feetPerSquare`. Non-destructive.
   - Update Zod/validators (`backend/src/routes/maps.ts`,
     `backend/src/validators/campaignImport.ts`) and TS types
     (`frontend/src/types/index.ts`: `Map`, `CreateMapRequest`, `UpdateMapRequest`).

2. **Shared formatting utility**
   - `formatDistance(value, unit)` and `getScalePresets(unit)` (e.g. `[5, 10]`
     ft vs `[1.5, 3]` m), used by `frontend/src/utils/geometry.ts`,
     `frontend/src/components/campaign/map/aoeGeometry.ts`, and
     `frontend/src/components/campaign/map/layers/drawOverlays.ts` (ruler +
     AoE labels) instead of hardcoded `ft` strings.
   - Separate display-only helper for character-sheet stat blocks (D&D5e,
     Pathfinder2e) that appends the metric equivalent without touching stored
     values.

3. **UI + i18n**
   - Setup Wizard (`frontend/src/pages/SetupWizardPage.tsx`, Step 3): add unit
     choice as the instance default.
   - `CreateMapModal.tsx` / `EditMapModal.tsx`: dynamic presets based on the
     selected unit, with per-map override of the instance default.
   - New i18n keys in the relevant namespaces, both locales (English source,
     Italian translation — per repo convention, code/docs stay English, only
     locale JSON carries Italian).

4. **Import/export**
   - `campaignExporter.ts` / `campaignImporter.ts`: carry `distanceUnit` with
     the exported value, not just the number.
   - Import of older campaign exports (only `feetPerSquare` present) must keep
     working unchanged (defaults to `'ft'`).

## Files touched (reference)

| Layer | Files |
|---|---|
| Schema/DB | `backend/prisma/schema.prisma` + migration |
| Validation | `backend/src/routes/maps.ts`, `backend/src/validators/campaignImport.ts` |
| Import/export | `backend/src/services/campaignExporter.ts`, `campaignImporter.ts` |
| System settings | `backend/src/services/systemSettings.ts`, `backend/src/utils/setupConfig.ts`, `frontend/src/pages/SetupWizardPage.tsx` |
| Calculation | `frontend/src/utils/geometry.ts`, `frontend/src/components/campaign/map/aoeGeometry.ts` |
| Rendering | `frontend/src/components/campaign/map/layers/drawOverlays.ts`, `drawGrid.ts` |
| Map UI | `frontend/src/components/campaign/CreateMapModal.tsx`, `EditMapModal.tsx` |
| Types | `frontend/src/types/index.ts` |
