/**
 * Wall and Fog of War Types — Frontend
 *
 * IMPORTANT: Keep this file in sync with backend/src/types/walls.ts.
 * These types define the data structures for the wall segment and fog of war
 * systems. Any changes here must be mirrored in the backend type file.
 */

// ── Wall Segments ─────────────────────────────────────────────────────────────

export type WallType =
  | 'wall'
  | 'door-closed'
  | 'door-open'
  | 'door-locked'
  | 'door-secret-closed'
  | 'door-secret-open'
  | 'window';

/** Every wall type, in the order the DM tools present them. */
export const ALL_WALL_TYPES: readonly WallType[] = [
  'wall', 'door-closed', 'door-open', 'door-locked', 'door-secret-closed', 'door-secret-open', 'window',
];

export function isDoorType(type: WallType): boolean {
  return type === 'door-closed' || type === 'door-open' || type === 'door-locked'
      || type === 'door-secret-closed' || type === 'door-secret-open';
}

/** A secret door renders distinctly for the DM only — players are never shown its true type. */
export function isSecretDoorType(type: WallType): boolean {
  return type === 'door-secret-closed' || type === 'door-secret-open';
}

/**
 * Wall types that block token movement. There is currently no movement-
 * collision system in the engine (tokens are placed freely), so nothing
 * reads this yet — it documents the intended semantics: everything blocks
 * except an open door (secret or not). A window blocks movement even
 * though it lets vision and light through — see `blocksVision`.
 */
export function blocksMovement(type: WallType): boolean {
  return type !== 'door-open' && type !== 'door-secret-open';
}

/**
 * Wall types that block vision and light raycasting: solid walls and any
 * CLOSED door (including locked and secret ones — a lock or a hidden latch
 * doesn't make a door less solid). Windows and OPEN doors let rays pass
 * through untouched, independent of whether they block movement.
 */
export function blocksVision(type: WallType): boolean {
  return type === 'wall' || type === 'door-closed' || type === 'door-locked' || type === 'door-secret-closed';
}

/**
 * Wall types that act as a directional ambient-light gap — an outdoor
 * environment's daylight/moonlight beams through these into an indoor
 * room. Deliberately excludes secret doors even when open: a shaft of
 * light pouring out of an apparently blank wall would announce the secret
 * door's existence to players, defeating the point of it being secret.
 */
export function isAmbientLightGap(type: WallType): boolean {
  return type === 'window' || type === 'door-open';
}

export interface WallSegment {
  id: string;   // UUID, assigned on creation
  x1: number;   // map-space pixels, origin top-left
  y1: number;
  x2: number;
  y2: number;
  type: WallType;
}

// ── Fog of War ────────────────────────────────────────────────────────────────

/**
 * Fog state: a flat array of booleans, one per fog cell.
 * Cell (col, row) maps to index: row * fogCols + col.
 * true = revealed to players, false = hidden.
 */
export interface FogState {
  fogCols: number;     // number of fog cells horizontally
  fogRows: number;     // number of fog cells vertically
  cellPx: number;      // fog cell size in map pixels (default 32)
  revealed: boolean[]; // length = fogCols * fogRows
}

export type FogOperation =
  | { op: 'reveal'; cells: number[] }   // cell indices to reveal
  | { op: 'hide'; cells: number[] }     // cell indices to hide
  | { op: 'reveal_all' }
  | { op: 'hide_all' };

// ── Light Sources ────────────────────────────────────────────────────────────

export interface LightSource {
  id: string;          // UUID, assigned on creation
  x: number;           // map-space pixels, origin top-left
  y: number;
  brightRadius: number; // bright-light radius in grid squares (full visibility, strong glow)
  dimRadius: number;    // dim-light radius in grid squares (lightly obscured, faint glow; >= brightRadius)
  color: string;        // hex color e.g. '#ffcc66' (warm amber default)
  enabled: boolean;     // toggle without deleting (extinguished torch)
}

/**
 * A light source carried by a token (a lit torch, a lantern) rather than
 * placed on the map. Has no x/y of its own — the renderer derives its
 * position from the token's live position every frame, so the light moves
 * with the token instead of needing to be synced like a standalone LightSource.
 */
export interface TokenLightEmit {
  enabled: boolean;      // toggle without losing the configured radii/color
  brightRadius: number;  // grid squares
  dimRadius: number;     // grid squares, >= brightRadius
  color: string;         // hex color e.g. '#ffcc66'
}
