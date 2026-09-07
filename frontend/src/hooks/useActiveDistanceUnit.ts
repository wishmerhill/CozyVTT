// ============================================
// useActiveDistanceUnit — instance-wide default distance unit
// ============================================
//
// Character sheets (speed/reach/range) are not tied to any one map, so they
// display against the instance-wide default (Setup Wizard) rather than a
// specific map's override. Map rendering itself reads distanceUnit straight
// off the active Map instead — see formatDistance in utils/measurement.ts.

import { useServerConfigQuery } from './queries';
import type { DistanceUnit } from '@/utils/measurement';

export function useActiveDistanceUnit(): DistanceUnit {
  const { data } = useServerConfigQuery();
  return data?.distanceUnit ?? 'ft';
}
