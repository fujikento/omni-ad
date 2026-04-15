import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  deriveRowMetrics,
  safeDivide,
  type MonthlyRow,
} from '../monthly-funnel.service.js';

function makeRow(partial: Partial<MonthlyRow>): MonthlyRow {
  return {
    month: '2026-04',
    impressions: 0,
    clicks: 0,
    spend: 0,
    revenue: 0,
    cv1: 0,
    cv2: 0,
    cv3: 0,
    cpc: 0,
    ctr: 0,
    cvr1: 0,
    cpa1: 0,
    cvr2: 0,
    cpa2: 0,
    cvr3: 0,
    cpa3: 0,
    divergence: 0,
    ...partial,
  };
}

describe('safeDivide', () => {
  it('returns 0 when denominator is 0', () => {
    assert.equal(safeDivide(10, 0), 0);
  });

  it('returns 0 for non-finite inputs', () => {
    assert.equal(safeDivide(Number.NaN, 5), 0);
    assert.equal(safeDivide(5, Number.POSITIVE_INFINITY), 0);
  });

  it('computes normal quotient', () => {
    assert.equal(safeDivide(10, 4), 2.5);
  });
});

describe('deriveRowMetrics', () => {
  it('computes all derived metrics for a healthy funnel row', () => {
    const row = makeRow({
      impressions: 10_000,
      clicks: 500,
      spend: 5000,
      revenue: 7500,
      cv1: 100,
      cv2: 40,
      cv3: 10,
    });
    const out = deriveRowMetrics(row);
    assert.equal(out.cpc, 10);
    assert.equal(out.ctr, 0.05);
    assert.equal(out.cvr1, 0.2);
    assert.equal(out.cpa1, 50);
    assert.equal(out.cvr2, 0.4);
    assert.equal(out.cpa2, 125);
    assert.equal(out.cvr3, 0.25);
    assert.equal(out.cpa3, 500);
    assert.equal(out.divergence, 0.4);
  });

  it('zeros out all derived metrics when every counter is zero', () => {
    const out = deriveRowMetrics(makeRow({}));
    assert.equal(out.cpc, 0);
    assert.equal(out.ctr, 0);
    assert.equal(out.cvr1, 0);
    assert.equal(out.cpa1, 0);
    assert.equal(out.cvr2, 0);
    assert.equal(out.cpa2, 0);
    assert.equal(out.cvr3, 0);
    assert.equal(out.cpa3, 0);
    assert.equal(out.divergence, 0);
  });

  it('guards against divide-by-zero when an upstream stage has no conversions', () => {
    const out = deriveRowMetrics(
      makeRow({
        impressions: 1000,
        clicks: 0,
        spend: 500,
        cv1: 0,
        cv2: 10,
        cv3: 5,
      }),
    );
    // clicks=0 → ctr/cvr1/cpc all zero
    assert.equal(out.cpc, 0);
    assert.equal(out.ctr, 0);
    assert.equal(out.cvr1, 0);
    // cv1=0 → divergence/cvr2/cpa1 all zero
    assert.equal(out.cpa1, 0);
    assert.equal(out.cvr2, 0);
    assert.equal(out.divergence, 0);
    // cv2>0 so cpa2/cvr3 do compute
    assert.equal(out.cpa2, 50);
    assert.equal(out.cvr3, 0.5);
  });
});
