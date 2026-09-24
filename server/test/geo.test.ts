import { describe, expect, it } from 'vitest';
import { LAGOS_DAY, LAGOS_NOW, boundingBox, isOpenNow } from '../src/services/geo.js';

describe('boundingBox', () => {
  it('is a square around the point at the equator', () => {
    const box = boundingBox(0, 5, 10);
    const span = 10 / 111.32;

    expect(box.minLat).toBeCloseTo(-span, 6);
    expect(box.maxLat).toBeCloseTo(span, 6);
    // One degree of longitude is a full ~111 km at the equator, so the two spans match.
    expect(box.minLng).toBeCloseTo(5 - span, 6);
    expect(box.maxLng).toBeCloseTo(5 + span, 6);
  });

  it('widens east-west as the point moves away from the equator', () => {
    const lagos = boundingBox(6.5, 3.34, 10);
    const latSpan = lagos.maxLat - lagos.minLat;
    const lngSpan = lagos.maxLng - lagos.minLng;

    // Degrees of longitude shrink by cos(lat), so the box must stretch to keep its width in
    // km. Too small here and the box would cut off markets the radius contains.
    expect(lngSpan).toBeGreaterThan(latSpan);
    expect(lngSpan).toBeCloseTo(latSpan / Math.cos((6.5 * Math.PI) / 180), 6);
  });

  it('is symmetric, so the point is always at its centre', () => {
    const box = boundingBox(6.5955, 3.3433, 25);

    expect((box.minLat + box.maxLat) / 2).toBeCloseTo(6.5955, 9);
    expect((box.minLng + box.maxLng) / 2).toBeCloseTo(3.3433, 9);
  });

  it('stays finite near a pole, where degrees of longitude collapse', () => {
    const box = boundingBox(89.99, 0, 10);

    // cos(89.99°) is about 1.7e-4, so the east-west half-width is ~500 degrees. Clamping to
    // the world's own width is what keeps the SQL comparable instead of Infinity.
    expect(Number.isFinite(box.maxLng)).toBe(true);
    expect(box.maxLng).toBeLessThanOrEqual(180);
    expect(box.minLng).toBeGreaterThanOrEqual(-180);
  });
});

describe('isOpenNow', () => {
  it('names the timezone rather than trusting the server clock', () => {
    const sql = isOpenNow('markets');

    expect(sql).toContain("at time zone 'Africa/Lagos'");
    expect(sql).not.toContain('now()::');
    // `time(...)` looks harmless and is a syntax error: `time` is a type name, not a function.
    expect(sql).toContain("'Africa/Lagos')::time between");
    expect(sql).toContain('markets.opens_at');
    expect(sql).toContain('markets.closes_at');
  });

  it('derives the weekday without depending on a locale', () => {
    // `to_char(..., 'Dy')` is affected by lc_time, which would silently stop matching the
    // `{sat,sun}` arrays on a cluster with a different locale. isodow is a number.
    expect(LAGOS_DAY).toContain('extract(isodow');
    expect(LAGOS_DAY).toContain("'mon','tue','wed','thu','fri','sat','sun'");
    expect(isOpenNow('m')).toContain('m.operating_days @> array[');
  });

  it('reads the same instant for the day and the time', () => {
    const sql = isOpenNow('markets');
    const uses = sql.split(LAGOS_NOW).length - 1;

    // A day from one clock reading and a time from the next could disagree across a midnight
    // boundary; one shared expression cannot.
    expect(uses).toBeGreaterThanOrEqual(2);
  });
});
