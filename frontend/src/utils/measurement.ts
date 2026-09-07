// ============================================
// Shared map-distance formatting.
// Single source of truth for how a distance-per-square value is labelled
// and which scale presets are offered, so ft/m never gets hardcoded again
// in geometry or rendering code.
// ============================================

export type DistanceUnit = 'ft' | 'm';

/**
 * Preset grid scales offered when picking a map's distance-per-square.
 * The metric values are the official D&D5e/PF2e conversion (5 ft = 1.5 m),
 * not a raw ft→m conversion of the imperial presets — that keeps the
 * numbers the ones players actually expect at a metric table.
 */
const SCALE_PRESETS: Record<DistanceUnit, number[]> = {
  ft: [5, 10, 15],
  m: [1.5, 3, 4.5],
};

export function getScalePresets(unit: DistanceUnit): number[] {
  return SCALE_PRESETS[unit];
}

/** Format a distance-per-square (or any map distance) with its unit, e.g. `30 ft` / `4.5 m`. */
export function formatDistance(value: number, unit: DistanceUnit): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

const FEET_TO_METERS = 0.3048;

/**
 * Display-only helper for character-sheet RAW distances (speed, reach,
 * range): those stay stored in feet regardless of the active map/instance
 * unit — only the label gains a metric hint. Never use this to convert a
 * value that gets saved back.
 */
export function formatRawDistance(feetValue: number, activeUnit: DistanceUnit): string {
  if (activeUnit !== 'm' || feetValue === 0) return `${feetValue} ft`;
  const meters = Math.round(feetValue * FEET_TO_METERS);
  return `${feetValue} ft (~${meters} m)`;
}
