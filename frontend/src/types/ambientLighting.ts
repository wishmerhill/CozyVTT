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
