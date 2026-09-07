import { describe, it, expect } from 'vitest';
import { formatDistance, getScalePresets, formatRawDistance } from '../measurement';

describe('getScalePresets', () => {
  it('returns imperial presets for ft', () => {
    expect(getScalePresets('ft')).toEqual([5, 10, 15]);
  });

  it('returns the official 5ft=1.5m metric presets for m', () => {
    expect(getScalePresets('m')).toEqual([1.5, 3, 4.5]);
  });
});

describe('formatDistance', () => {
  it('formats an imperial value', () => {
    expect(formatDistance(30, 'ft')).toBe('30 ft');
  });

  it('formats a metric value', () => {
    expect(formatDistance(1.5, 'm')).toBe('1.5 m');
  });

  it('rounds floating-point noise to 2 decimals', () => {
    expect(formatDistance(0.1 + 0.2, 'm')).toBe('0.3 m');
  });
});

describe('formatRawDistance', () => {
  it('shows only feet when the active unit is imperial', () => {
    expect(formatRawDistance(30, 'ft')).toBe('30 ft');
  });

  it('appends the metric hint when the active unit is metric', () => {
    expect(formatRawDistance(30, 'm')).toBe('30 ft (~9 m)');
  });

  it('does not add a redundant hint for a zero value', () => {
    expect(formatRawDistance(0, 'm')).toBe('0 ft');
  });
});
