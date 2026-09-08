/**
 * Wall and Fog of War Types — Backend
 *
 * IMPORTANT: Keep this file in sync with frontend/src/types/walls.ts.
 * These types define the data structures for the wall segment and fog of war
 * systems. Any changes here must be mirrored in the frontend type file.
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

/** Every wall type, in a stable canonical order — the source of truth for validation lists. */
export const ALL_WALL_TYPES: readonly WallType[] = [
  'wall', 'door-closed', 'door-open', 'door-locked', 'door-secret-closed', 'door-secret-open', 'window',
];

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
  fogCols: number;    // number of fog cells horizontally
  fogRows: number;    // number of fog cells vertically
  cellPx: number;     // fog cell size in map pixels (default 32)
  revealed: boolean[]; // length = fogCols * fogRows
}

export type FogOperation =
  | { op: 'reveal'; cells: number[] }    // cell indices to reveal
  | { op: 'hide'; cells: number[] }      // cell indices to hide
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
