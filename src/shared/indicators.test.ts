import { describe, expect, it } from 'vitest';
import { ema, sma } from './indicators';

describe('sma', () => {
  it('nulls the warm-up window, then averages a trailing window', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('treats period 1 as the identity (every point is its own average)', () => {
    expect(sma([4, 8, 2], 1)).toEqual([4, 8, 2]);
  });

  it('is all-null when there are fewer points than the period', () => {
    expect(sma([10, 20], 5)).toEqual([null, null]);
  });

  it('rejects a non-positive or non-integer period as all-null', () => {
    expect(sma([1, 2, 3], 0)).toEqual([null, null, null]);
    expect(sma([1, 2, 3], -2)).toEqual([null, null, null]);
    expect(sma([1, 2, 3], 1.5)).toEqual([null, null, null]);
  });

  it('matches a hand-computed window on a longer series', () => {
    const out = sma([2, 4, 6, 8, 10, 12], 4);
    // windows: [2,4,6,8]=5, [4,6,8,10]=7, [6,8,10,12]=9
    expect(out).toEqual([null, null, null, 5, 7, 9]);
  });
});

describe('ema', () => {
  it('nulls the warm-up window and seeds with the SMA of the first period', () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(2, 10); // seed = mean(1,2,3)
  });

  it('applies the smoothing factor after the seed', () => {
    // period 3 → k = 0.5. seed at idx2 = 2; idx3 = 4*0.5 + 2*0.5 = 3; idx4 = 5*0.5 + 3*0.5 = 4
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[3]).toBeCloseTo(3, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });

  it('is all-null when there are fewer points than the period', () => {
    expect(ema([10, 20], 5)).toEqual([null, null]);
  });

  it('reacts faster than the SMA on the bar right after a step change', () => {
    const values = [10, 10, 10, 10, 20, 20, 20, 20];
    const e = ema(values, 4);
    const s = sma(values, 4);
    const jump = 4; // first bar at the new level
    // EMA weights the new point more, so it leads the trailing SMA immediately
    // after the jump (SMA only catches up once its window fully rolls over).
    expect(e[jump]).toBeGreaterThan(s[jump] as number); // 14 > 12.5
  });
});
