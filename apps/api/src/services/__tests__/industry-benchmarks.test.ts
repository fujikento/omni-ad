import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  classifyBand,
  percentile,
} from '../industry-benchmarks.service.js';

describe('percentile', () => {
  it('returns null for empty array', () => {
    assert.equal(percentile([], 0.5), null);
  });
  it('returns the single value for length 1', () => {
    assert.equal(percentile([5], 0.25), 5);
  });
  it('returns p50 of odd-length sorted array', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  });
  it('interpolates p50 of even-length sorted array', () => {
    assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  });
  it('returns p25 correctly', () => {
    // Four elements: idx = 0.25 * 3 = 0.75, between 1 and 2 → 1.75
    assert.equal(percentile([1, 2, 3, 4], 0.25), 1.75);
  });
  it('returns p75 correctly', () => {
    assert.equal(percentile([1, 2, 3, 4], 0.75), 3.25);
  });
  it('clamps out-of-range p', () => {
    assert.equal(percentile([1, 2, 3], -1), 1);
    assert.equal(percentile([1, 2, 3], 2), 3);
  });
});

describe('classifyBand', () => {
  it('returns unknown when p50 is null', () => {
    assert.equal(classifyBand(3, 1, null, 5), 'unknown');
  });
  it('top_quartile when value >= p75', () => {
    assert.equal(classifyBand(5, 1, 2, 4), 'top_quartile');
    assert.equal(classifyBand(4, 1, 2, 4), 'top_quartile');
  });
  it('above_median when p50 <= value < p75', () => {
    assert.equal(classifyBand(3, 1, 2, 4), 'above_median');
    assert.equal(classifyBand(2, 1, 2, 4), 'above_median');
  });
  it('below_median when p25 <= value < p50', () => {
    assert.equal(classifyBand(1.5, 1, 2, 4), 'below_median');
    assert.equal(classifyBand(1, 1, 2, 4), 'below_median');
  });
  it('bottom_quartile when value < p25', () => {
    assert.equal(classifyBand(0.5, 1, 2, 4), 'bottom_quartile');
  });
  it('handles missing p75 gracefully', () => {
    assert.equal(classifyBand(3, 1, 2, null), 'above_median');
  });
  it('handles missing p25 gracefully', () => {
    assert.equal(classifyBand(1.5, null, 2, 4), 'bottom_quartile');
  });
});
