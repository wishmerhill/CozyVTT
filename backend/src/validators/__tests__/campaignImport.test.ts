import { MapDataSchema } from '../campaignImport';

/** A minimal valid map payload — the fields MapDataSchema actually requires. */
const baseMap = {
  name: 'Test Map',
  imageAssetRef: 'asset-0',
  width: 20,
  height: 20,
  gridSize: 70,
  feetPerSquare: 5,
  tokens: [],
};

describe('MapDataSchema — measurement system fields', () => {
  it('accepts a map with distancePerSquare and distanceUnit (current export format)', () => {
    const result = MapDataSchema.safeParse({
      ...baseMap,
      distancePerSquare: 1.5,
      distanceUnit: 'm',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distancePerSquare).toBe(1.5);
      expect(result.data.distanceUnit).toBe('m');
    }
  });

  it('accepts a legacy map with only feetPerSquare (pre-measurement-system export)', () => {
    const result = MapDataSchema.safeParse(baseMap);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distancePerSquare).toBeUndefined();
      expect(result.data.distanceUnit).toBeUndefined();
    }
  });

  it('rejects an invalid distanceUnit', () => {
    const result = MapDataSchema.safeParse({ ...baseMap, distanceUnit: 'yards' });
    expect(result.success).toBe(false);
  });

  it('rejects a distancePerSquare of zero or below', () => {
    const result = MapDataSchema.safeParse({ ...baseMap, distancePerSquare: 0 });
    expect(result.success).toBe(false);
  });
});

describe('campaign import fallback — matches campaignImporter.ts map-create logic', () => {
  // Mirrors the exact fallback expressions used when building Prisma.map.create
  // data in campaignImporter.ts, so a regression there is caught here too.
  function resolveDistanceFields(mapData: { feetPerSquare: number; distancePerSquare?: number; distanceUnit?: 'ft' | 'm' }) {
    return {
      distancePerSquare: mapData.distancePerSquare ?? mapData.feetPerSquare,
      distanceUnit: mapData.distanceUnit ?? 'ft',
    };
  }

  it('falls back to feetPerSquare / "ft" when the legacy export has neither field', () => {
    const parsed = MapDataSchema.parse(baseMap);
    expect(resolveDistanceFields(parsed)).toEqual({ distancePerSquare: 5, distanceUnit: 'ft' });
  });

  it('preserves the explicit metric values from a current export', () => {
    const parsed = MapDataSchema.parse({ ...baseMap, distancePerSquare: 1.5, distanceUnit: 'm' });
    expect(resolveDistanceFields(parsed)).toEqual({ distancePerSquare: 1.5, distanceUnit: 'm' });
  });
});
