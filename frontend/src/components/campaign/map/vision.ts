// ============================================
// Vision state — raycast visibility polygons for the dynamic lighting
// pipeline, computed separately from drawing so they can be memoized
// per source.
//
// Pure: no React, no component closures.
// ============================================

import type { Token } from '@/types';
import { isAmbientLightGap, type LightSource, type WallSegment } from '@/types/walls';
import { computeVisibility, probeWallDistance, type VisibilityPolygon } from '@/utils/raycasting';
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

/**
 * A window/open-door light source, with the segment endpoints kept alongside
 * the usual visibility polygon. The renderer needs the segment's own
 * direction (to derive its normal) to project the light as a beam
 * perpendicular to the window rather than a point-source radial glow.
 */
export interface WindowLightSource extends VisionSource {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /**
   * Unit normal to the segment, already oriented to point INTO the building
   * — see `pickInwardNormal`. The renderer projects the beam along this
   * single direction rather than splitting it across both sides of the
   * window, so daylight reads as entering the room, not leaking out of it.
   */
  nx: number;
  ny: number;
}

/**
 * How far each of a window's two probe rays is cast when deciding which side
 * of the segment is the room interior. Deliberately much larger than
 * `DEFAULT_WINDOW_LIGHT_RADIUS_CELLS` (the beam's own reach) — most rooms are
 * a handful of cells across, so the side that hits a wall first within this
 * probe range is the bounded interior; the side that doesn't (or hits much
 * farther out) is the open exterior.
 */
const INWARD_PROBE_RADIUS_CELLS = 20;

/**
 * Which side of a window/open-door segment faces the building's interior.
 * Casts a short probe ray from the segment midpoint along each of the two
 * candidate normals and picks the one that hits a wall sooner — a room's
 * far wall is normally much closer than the open exterior's next obstacle
 * (or the map edge, which this probe doesn't consider a hit at all).
 *
 * Ties (or both sides open, e.g. a stray fence in a field) fall back to the
 * first candidate — direction doesn't matter when there is no room to speak
 * of either way.
 */
function pickInwardNormal(
  seg: WallSegment,
  wallSegments: readonly WallSegment[],
  gridSize: number
): { nx: number; ny: number } {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -(dy / len);
  const ny = dx / len;
  const { cx, cy } = segmentMidpoint(seg);

  const probeDist = INWARD_PROBE_RADIUS_CELLS * gridSize;
  // Nudge the probe origin off the wall line itself so it doesn't
  // immediately re-intersect the window segment it started from.
  const eps = 1;
  const angleA = Math.atan2(ny, nx);
  const angleB = Math.atan2(-ny, -nx);
  const distA = probeWallDistance(cx + nx * eps, cy + ny * eps, angleA, wallSegments, probeDist);
  const distB = probeWallDistance(cx - nx * eps, cy - ny * eps, angleB, wallSegments, probeDist);

  return distA <= distB ? { nx, ny } : { nx: -nx, ny: -ny };
}

export interface VisionState {
  /** One entry per viewer-controlled token (sight radius applied). */
  tokenVision: VisionSource[];
  /**
   * One entry per viewer-controlled token with **no** radius limit — pure line
   * of sight, bounded only by walls.
   *
   * This is what a light is allowed to reveal. A sight radius says how far you
   * can make something out in the dark; it does not stop you seeing a lit room
   * across a courtyard. Keeping the two separate is what stops a light behind a
   * wall lighting that room for someone who cannot see into it.
   */
  tokenSight: VisionSource[];
  /** One entry per enabled light source (dim radius applied). */
  lightVision: VisionSource[];
  /** Darkvision polygons for tokens that have darkvisionRadius set.
   *  These reveal the area in grayscale when no light source covers it. */
  darkvision: VisionSource[];
  /**
   * One entry per window/open-door wall segment, radius-limited — outdoor
   * ambient light beaming into a room through the gap. The beam's shape and
   * falloff are computed independent of any token's position (a sunlit room
   * looks lit even with nobody in it), but the renderer still masks the fog
   * reveal it produces against the viewer's line of sight — see
   * `drawDynamicLighting`'s window-light pass. Empty unless the caller
   * passes a positive windowLightRadiusCells.
   */
  windowLight: WindowLightSource[];
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

/** Midpoint of a wall segment (map-space px) — the window-light's origin. */
function segmentMidpoint(seg: WallSegment): { cx: number; cy: number } {
  return { cx: (seg.x1 + seg.x2) / 2, cy: (seg.y1 + seg.y2) / 2 };
}

/**
 * Compute visibility polygons for the viewer's tokens and all enabled
 * lights. Order matches the legacy render pipeline: tokens first, then
 * lights.
 *
 * `windowLightRadiusCells` <= 0 disables window-light computation entirely
 * (the caller passes 0 for indoor maps, where it is never drawn — see
 * `drawDynamicLighting`'s `isOutdoor` gate — so skipping the raycasts here
 * avoids paying for them on the common indoor path).
 */
export function computeVisionState(
  myTokens: readonly Token[],
  enabledLights: readonly LightSource[],
  wallSegments: readonly WallSegment[],
  viewport: Viewport,
  windowLightRadiusCells = 0
): VisionState {
  const { w: mapWidthPx, h: mapHeightPx } = mapSizePx(viewport);

  const tokenVision: VisionSource[] = myTokens.map((token) => {
    const { cx, cy, r } = tokenSource(token, viewport);
    const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, r);
    return { poly, cx, cy };
  });

  // A radius of 0 already means unbounded, so that polygon *is* the line of
  // sight — only a token with a real radius needs the second raycast.
  const tokenSight: VisionSource[] = myTokens.map((token, i) => {
    const { cx, cy, r } = tokenSource(token, viewport);
    if (r <= 0) return tokenVision[i];
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
      const { cx, cy, r } = tokenSource(token, viewport);
      const dvr = Math.min(token.darkvisionRadius! * viewport.gridSize, r > 0 ? r : Infinity);
      const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, dvr);
      return { poly, cx, cy };
    });

  const windowLight: WindowLightSource[] = windowLightRadiusCells > 0
    ? wallSegments
        .filter((seg) => isAmbientLightGap(seg.type))
        .map((seg) => {
          const { cx, cy } = segmentMidpoint(seg);
          const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, windowLightRadiusCells * viewport.gridSize);
          const { nx, ny } = pickInwardNormal(seg, wallSegments, viewport.gridSize);
          return { poly, cx, cy, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, nx, ny };
        })
    : [];

  return { tokenVision, tokenSight, lightVision, darkvision, windowLight, all: [...tokenVision, ...lightVision] };
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
    viewport: Viewport,
    windowLightRadiusCells?: number
  ): VisionState;
}

interface CachedSource {
  x: number;
  y: number;
  r: number;
  src: VisionSource;
}

interface CachedWindowSource {
  x: number;
  y: number;
  r: number;
  src: WindowLightSource;
}

export function createVisionCache(): VisionCache {
  let lastWalls: readonly WallSegment[] | null = null;
  const tokenCache = new Map<string, CachedSource>();
  const sightCache = new Map<string, CachedSource>();
  const lightCache = new Map<string, CachedSource>();
  const darkvisionCache = new Map<string, CachedSource>();
  const windowCache = new Map<string, CachedWindowSource>();

  return {
    compute(myTokens, enabledLights, wallSegments, viewport, windowLightRadiusCells = 0) {
      const { w: mapWidthPx, h: mapHeightPx } = mapSizePx(viewport);

      // Any wall mutation (or a map switch) replaces the array reference.
      if (wallSegments !== lastWalls) {
        tokenCache.clear();
        sightCache.clear();
        lightCache.clear();
        darkvisionCache.clear();
        windowCache.clear();
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

      // Unbounded line of sight, cached separately — see VisionState.tokenSight.
      // A token with no radius is already unbounded, so it costs nothing extra;
      // only a token with a real sight radius adds a second raycast.
      const tokenSight: VisionSource[] = myTokens.map((token, i) => {
        const { cx, cy, r } = tokenSource(token, viewport);
        if (r <= 0) return tokenVision[i];
        const hit = sightCache.get(token.id);
        if (hit && hit.x === cx && hit.y === cy) return hit.src;
        const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, 0);
        const src: VisionSource = { poly, cx, cy };
        sightCache.set(token.id, { x: cx, y: cy, r: 0, src });
        return src;
      });
      for (const id of sightCache.keys()) if (!seenTokens.has(id)) sightCache.delete(id);

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
          const { cx, cy, r } = tokenSource(token, viewport);
          const dvr = Math.min(token.darkvisionRadius! * viewport.gridSize, r > 0 ? r : Infinity);
          seenDv.add(token.id);
          const hit = darkvisionCache.get(token.id);
          if (hit && hit.x === cx && hit.y === cy && hit.r === dvr) return hit.src;
          const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, dvr);
          const src: VisionSource = { poly, cx, cy };
          darkvisionCache.set(token.id, { x: cx, y: cy, r: dvr, src });
          return src;
        });
      for (const id of darkvisionCache.keys()) if (!seenDv.has(id)) darkvisionCache.delete(id);

      // Window/open-door ambient light sources — cached per wall segment id.
      // Skipped entirely (and the cache drained) when radius <= 0, i.e. indoor
      // maps, so an indoor session never pays for these raycasts.
      let windowLight: WindowLightSource[] = [];
      if (windowLightRadiusCells > 0) {
        const r = windowLightRadiusCells * viewport.gridSize;
        const seenWindows = new Set<string>();
        windowLight = wallSegments
          .filter((seg) => isAmbientLightGap(seg.type))
          .map((seg) => {
            const { cx, cy } = segmentMidpoint(seg);
            seenWindows.add(seg.id);
            const hit = windowCache.get(seg.id);
            if (hit && hit.x === cx && hit.y === cy && hit.r === r) return hit.src;
            const poly = computeVisibility({ x: cx, y: cy }, wallSegments as WallSegment[], mapWidthPx, mapHeightPx, r);
            const { nx, ny } = pickInwardNormal(seg, wallSegments, viewport.gridSize);
            const src: WindowLightSource = { poly, cx, cy, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, nx, ny };
            windowCache.set(seg.id, { x: cx, y: cy, r, src });
            return src;
          });
        for (const id of windowCache.keys()) if (!seenWindows.has(id)) windowCache.delete(id);
      } else if (windowCache.size > 0) {
        windowCache.clear();
      }

      return { tokenVision, tokenSight, lightVision, darkvision, windowLight, all: [...tokenVision, ...lightVision] };
    },
  };
}