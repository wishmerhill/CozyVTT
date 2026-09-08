/**
 * Ambient Lighting & Environment types shared by the map create/edit modals
 * and the in-session DM ambient quick-controller.
 *
 * `ambientColor`/`ambientOpacity` are only user-editable for the "custom" and
 * "night" presets — "day", "dusk", and "pitch_black" carry fixed values from
 * AMBIENT_PRESET_DEFAULTS below so Phase B rendering can read the same two
 * fields uniformly regardless of which preset produced them.
 */

export type EnvironmentType = 'indoor' | 'outdoor';

export type AmbientLightPreset = 'day' | 'dusk' | 'night' | 'pitch_black' | 'custom';

export const AMBIENT_LIGHT_PRESETS: AmbientLightPreset[] = ['day', 'dusk', 'night', 'pitch_black', 'custom'];

/** Presets whose color/opacity the DM can adjust; the rest are fixed. */
export const ADJUSTABLE_AMBIENT_PRESETS: AmbientLightPreset[] = ['night', 'custom'];

export const AMBIENT_PRESET_DEFAULTS: Record<AmbientLightPreset, { color: string; opacity: number }> = {
  day: { color: '#ffffff', opacity: 0 },
  dusk: { color: '#f4a261', opacity: 0.35 },
  night: { color: '#0b1d3a', opacity: 0.65 },
  pitch_black: { color: '#000000', opacity: 1 },
  custom: { color: '#0b1d3a', opacity: 0.5 },
};

/**
 * How far (in grid squares) outdoor ambient light penetrates an indoor room
 * through a window or open door, fading out toward the edge. The beam shape
 * itself (see `drawDynamicLighting`'s window-light pass) is independent of
 * any token's position, but the fog reveal it produces is still masked by
 * the viewer's line of sight — see `isAmbientLightGap` in `types/walls.ts`.
 */
export const DEFAULT_WINDOW_LIGHT_RADIUS_CELLS = 2;

/**
 * Minimum tint opacity applied to the outdoor "in line-of-sight but beyond
 * the token's own light/sight radius" zone, even under the "day" preset
 * (whose own `opacity` is 0). Without this floor that zone reads as fully,
 * crisply revealed the instant a token has LOS into it — including an
 * entire wall-bounded room — rather than a soft haze a token still has to
 * approach to see clearly. See drawDynamicLighting's "Outdoor ambient
 * reveal" pass in drawLights.ts.
 */
export const OUTDOOR_HAZE_MIN_OPACITY = 0.35;

/**
 * How far (in grid squares) an indoor light source's own glow may spill
 * outward through a window or open door into the outdoor night before the
 * fog swallows the rest of its reach. Only applied outdoors when the
 * ambient preset is non-"day" (opacity > 0) — during the day the exterior
 * is already fully lit, so there is nothing to cap.
 */
export const NIGHT_LIGHT_SPILL_RADIUS_CELLS = 3;
