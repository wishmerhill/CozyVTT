/**
 * Server-side raycasting — wall-type blocking behavior.
 *
 * This is the authoritative security boundary (see the file header in
 * serverRaycasting.ts), so it needs its own coverage of which wall types
 * occlude vision — separate from the frontend's raycasting.test.ts, even
 * though the algorithm is an intentional port.
 */

import { computeVisibility, isPointVisible } from './serverRaycasting';
import type { WallSegment } from '../types/walls';

const MAP_W = 800;
const MAP_H = 600;

function wall(type: WallSegment['type'], x1: number, y1: number, x2: number, y2: number): WallSegment {
  return { id: 'test', x1, y1, x2, y2, type };
}

describe('computeVisibility wall-type blocking', () => {
  const viewer = { x: 400, y: 300 };
  const behind = { x: 50, y: 300 };

  it('a plain wall blocks vision', () => {
    const result = computeVisibility(viewer, [wall('wall', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(false);
  });

  it('a window does not block vision', () => {
    const result = computeVisibility(viewer, [wall('window', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(true);
  });

  it('an open door does not block vision', () => {
    const result = computeVisibility(viewer, [wall('door-open', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(true);
  });

  it('a closed door blocks vision', () => {
    const result = computeVisibility(viewer, [wall('door-closed', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(false);
  });

  it('a locked door blocks vision', () => {
    const result = computeVisibility(viewer, [wall('door-locked', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(false);
  });

  it('a closed secret door blocks vision, same as a closed door', () => {
    const result = computeVisibility(viewer, [wall('door-secret-closed', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(false);
  });

  it('an open secret door does not block vision', () => {
    const result = computeVisibility(viewer, [wall('door-secret-open', 200, 0, 200, MAP_H)], MAP_W, MAP_H);
    expect(isPointVisible(behind, result)).toBe(true);
  });

  it('sunlight through a window reaches into an otherwise enclosed room, bounded by its interior walls', () => {
    // A closed 4-wall room with one wall replaced by a window: the outdoor
    // viewer's line of sight should reach inside, but only as far as the
    // room's solid walls allow — never through the far wall.
    const room: WallSegment[] = [
      wall('window', 300, 200, 500, 200), // top — the window the light enters through
      wall('wall', 500, 200, 500, 400),   // right
      wall('wall', 500, 400, 300, 400),   // bottom (the "far" wall, opposite the window)
      wall('wall', 300, 400, 300, 200),   // left
    ];
    const outdoorViewer = { x: 400, y: 100 }; // outside, above the window
    const result = computeVisibility(outdoorViewer, room, MAP_W, MAP_H);

    // Just inside the window: visible
    expect(isPointVisible({ x: 400, y: 220 }, result)).toBe(true);
    // Beyond the room's far (solid) wall: not visible
    expect(isPointVisible({ x: 400, y: 500 }, result)).toBe(false);
  });
});
