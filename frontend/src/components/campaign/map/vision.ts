// ============================================
// Vision state — raycast visibility polygons for the dynamic lighting
// pipeline, computed separately from drawing so they can be memoized
// per source.
//
// Pure: no React, no component closures.
// ============================================

import type { Token } from '@/types';
import type { LightSource, WallSegment } from '@/types/walls';
import { computeVisibility, type VisibilityPolygon } from '@/utils/raycasting';
import { mapSizePx, type Viewport } from './layers/types';
import { gridYToCentrePx } from './coords';

/**
 * A visibility polygon plus its source center. The center is kept so
 * door line-of-sight checks can nudge the test point toward the viewer:
 * closed doors lie ON the polygon boundary, making a raw midpoint test
 * unreliable — shifting 2px inward places it safely inside the visible
 * area.
 */
export interface VisionSource {
  poly: VisibilityPolygon;
  cx: number;
  cy: number;
}

export interface VisionState {
  /** One entry per viewer-controlled token (sight radius applied). */
  tokenVision: VisionSource[];
  /** One entry per viewer-controlled token: walls-only line of sight, no
   *  distance cap. Used to gate light sources — a light in the same room
   *  but beyond the token's short unaided sightRadius must still show its
   *  own glow as long as no wall blocks it, per D&D 5e (unaided sight
   *  isn't distance-limited when something is actually lit; sightRadius
   *  here only bounds how far darkness itself can be pierced). Keeping
   *  this separate from tokenVision means the base "no light needed" dome
   *  stays radius-capped while light visibility does not. */
  tokenLOS: VisionSource[];
  /** One entry per enabled light source (dim radius applied). */
  lightVision: VisionSource[];
  /** Darkvision polygons for tokens that have darkvisionRadius set.
   *  These reveal the area in grayscale when no light source covers it. */
  darkvision: VisionSource[];
  /** Concatenated in draw order — used by the walls layer door filter. */
  all: VisionSource[];
}

/** Token center (canvas px) + sight radius (px) for a viewer token. */
function tokenSource(token: Token, viewport: Viewport): { cx: number; cy: number; r: number } {
  // Token grid coords use Y=0 at bottom; canvas pixel coords use Y=0 at top.
  return {
    cx: (token.position.x + token.size.width / 2) * viewport.gridSize,
    cy: gridYToCentrePx(token.position.y, token.size.height, viewport.mapHeight, viewport.gridSize),
    // Default sight radius of 3 grid squares (D&D 5e standard human vision).
    // 0 = unlimited (DM override).
    r: (token.sightRadius ?? 3) * viewport.gridSize,
  };
}

/**
 * Compute visibility polygons for the viewer's tokens and all enabled
 * lights. Order matches the legacy render pipeline: tokens first, then
 * lights.
 */
export function computeVisionState(
  myTokens: readonly Token[],
  enabledLights: readonly LightSource[],
  wallSegments: readonly WallSegment[],
  viewport: Viewport
): VisionState {
  const { w: mapWidthPx, h: mapHeightPx } = mapSizePx(viewport);

  const tokenVision: VisionSource[] = myTokens.map((token) => {
    const { cx, cy, r } = tokenSource(token, viewport);
    const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, r);
    return { poly, cx, cy };
  });

  // Walls-only LOS (radius 0 = unlimited, per computeVisibility) — gates
  // light-source visibility independently of the token's capped sight dome.
  const tokenLOS: VisionSource[] = myTokens.map((token) => {
    const { cx, cy } = tokenSource(token, viewport);
    const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, 0);
    return { poly, cx, cy };
  });

  const lightVision: VisionSource[] = enabledLights.map((light) => {
    const dimRadiusPx = light.dimRadius * viewport.gridSize;
    const poly = computeVisibility({ x: light.x, y: light.y }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, dimRadiusPx);
    return { poly, cx: light.x, cy: light.y };
  });

  // Darkvision polygons — use the darkvision radius from the token, clipped
  // by walls. Darkvision does not extend beyond sightRadius, so clamp it.
  const darkvision: VisionSource[] = myTokens
    .filter((t) => (t.darkvisionRadius ?? 0) > 0)
    .map((token) => {
      const { cx, cy } = tokenSource(token, viewport);
      const sr = (token.sightRadius ?? 0) * viewport.gridSize;
      const dvr = Math.min(
        token.darkvisionRadius! * viewport.gridSize,
        sr > 0 ? sr : Infinity
      );
      const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, dvr);
      return { poly, cx, cy };
    });

  return { tokenVision, tokenLOS, lightVision, darkvision, all: [...tokenVision, ...lightVision] };
}

/**
 * Memoized visibility computation. Raycasting a source
 * against every wall is the dominant per-frame cost on lit maps, so
 * cache each source's polygon and recompute ONLY when that source's
 * position/radius changes or the wall set changes.
 *
 * Wall-set identity is the invalidation key: `useWallHistory` hands back
 * a stable array reference until a wall mutation, so a plain reference
 * check clears the whole cache exactly when geometry changes. During a
 * token drag only the moved viewer token misses; all other tokens and
 * every light stay cached.
 *
 * Instantiate ONE cache per MapCanvas (a ref) — never share across maps.
 */
export interface VisionCache {
  compute(
    myTokens: readonly Token[],
    enabledLights: readonly LightSource[],
    wallSegments: readonly WallSegment[],
    viewport: Viewport
  ): VisionState;
}

interface CachedSource {
  x: number;
  y: number;
  r: number;
  src: VisionSource;
}

export function createVisionCache(): VisionCache {
  let lastWalls: readonly WallSegment[] | null = null;
  const tokenCache = new Map<string, CachedSource>();
  const losCache = new Map<string, CachedSource>();
  const lightCache = new Map<string, CachedSource>();
  const darkvisionCache = new Map<string, CachedSource>();

  return {
    compute(myTokens, enabledLights, wallSegments, viewport) {
      const { w: mapWidthPx, h: mapHeightPx } = mapSizePx(viewport);

      // Any wall mutation (or a map switch) replaces the array reference.
      if (wallSegments !== lastWalls) {
        tokenCache.clear();
        losCache.clear();
        lightCache.clear();
        darkvisionCache.clear();
        lastWalls = wallSegments;
      }

      const seenTokens = new Set<string>();
      const tokenVision: VisionSource[] = myTokens.map((token) => {
        const { cx, cy, r } = tokenSource(token, viewport);
        seenTokens.add(token.id);
        const hit = tokenCache.get(token.id);
        if (hit && hit.x === cx && hit.y === cy && hit.r === r) return hit.src;
        const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, r);
        const src: VisionSource = { poly, cx, cy };
        tokenCache.set(token.id, { x: cx, y: cy, r, src });
        return src;
      });
      for (const id of tokenCache.keys()) if (!seenTokens.has(id)) tokenCache.delete(id);

      // Walls-only LOS (unlimited radius) — cached per token id, keyed on
      // position only since the radius is always 0/unlimited.
      const seenLOS = new Set<string>();
      const tokenLOS: VisionSource[] = myTokens.map((token) => {
        const { cx, cy } = tokenSource(token, viewport);
        seenLOS.add(token.id);
        const hit = losCache.get(token.id);
        if (hit && hit.x === cx && hit.y === cy) return hit.src;
        const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, 0);
        const src: VisionSource = { poly, cx, cy };
        losCache.set(token.id, { x: cx, y: cy, r: 0, src });
        return src;
      });
      for (const id of losCache.keys()) if (!seenLOS.has(id)) losCache.delete(id);

      const seenLights = new Set<string>();
      const lightVision: VisionSource[] = enabledLights.map((light) => {
        const r = light.dimRadius * viewport.gridSize;
        seenLights.add(light.id);
        const hit = lightCache.get(light.id);
        if (hit && hit.x === light.x && hit.y === light.y && hit.r === r) return hit.src;
        const poly = computeVisibility({ x: light.x, y: light.y }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, r);
        const src: VisionSource = { poly, cx: light.x, cy: light.y };
        lightCache.set(light.id, { x: light.x, y: light.y, r, src });
        return src;
      });
      for (const id of lightCache.keys()) if (!seenLights.has(id)) lightCache.delete(id);

      // Darkvision polygons — cached per token id.
      const seenDv = new Set<string>();
      const darkvision: VisionSource[] = myTokens
        .filter((t) => (t.darkvisionRadius ?? 0) > 0)
        .map((token) => {
          const { cx, cy } = tokenSource(token, viewport);
          const sr = (token.sightRadius ?? 0) * viewport.gridSize;
          const dvr = Math.min(
            token.darkvisionRadius! * viewport.gridSize,
            sr > 0 ? sr : Infinity
          );
          seenDv.add(token.id);
          const hit = darkvisionCache.get(token.id);
          if (hit && hit.x === cx && hit.y === cy && hit.r === dvr) return hit.src;
          const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, dvr);
          const src: VisionSource = { poly, cx, cy };
          darkvisionCache.set(token.id, { x: cx, y: cy, r: dvr, src });
          return src;
        });
      for (const id of darkvisionCache.keys()) if (!seenDv.has(id)) darkvisionCache.delete(id);

      return { tokenVision, tokenLOS, lightVision, darkvision, all: [...tokenVision, ...lightVision] };
    },
  };
}