import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  computePlatformROAS,
  computeReallocationPlan,
  computeWeightedRoas,
  overlapMultiplier,
  safeDivide,
  type MetricRow,
  type PlatformROAS,
} from '../unified-spend-orchestrator.service.js';

function makeRow(partial: Partial<MetricRow> & { platform: MetricRow['platform'] }): MetricRow {
  return {
    spend: 0,
    revenue: 0,
    conversions: 0,
    impressions: 0,
    clicks: 0,
    ...partial,
  };
}

describe('computeWeightedRoas', () => {
  const pr = (platform: MetricRow['platform'], roas: number): PlatformROAS => ({
    platform,
    spend: 0,
    revenue: 0,
    conversions: 0,
    impressions: 0,
    clicks: 0,
    roas,
    cpa: 0,
    ctr: 0,
    dataPoints: 1,
  });

  it('returns 0 when allocation is empty', () => {
    assert.equal(computeWeightedRoas([pr('meta', 3)], {}), 0);
  });

  it('returns 0 when no platforms match', () => {
    assert.equal(
      computeWeightedRoas([pr('meta', 3)], { google: 100 }),
      0,
    );
  });

  it('returns the single platform ROAS when only one is allocated', () => {
    assert.equal(
      computeWeightedRoas([pr('meta', 2.5)], { meta: 500 }),
      2.5,
    );
  });

  it('weights ROAS by allocation amount', () => {
    const platformROAS = [pr('meta', 4.0), pr('google', 1.0)];
    const result = computeWeightedRoas(platformROAS, {
      meta: 800,
      google: 200,
    });
    // (4.0 * 800 + 1.0 * 200) / 1000 = 3.4
    assert.ok(Math.abs(result - 3.4) < 1e-9);
  });

  it('skips zero-amount allocations', () => {
    const platformROAS = [pr('meta', 4.0), pr('google', 1.0)];
    const result = computeWeightedRoas(platformROAS, {
      meta: 1000,
      google: 0,
    });
    assert.ok(Math.abs(result - 4.0) < 1e-9);
  });
});

describe('overlapMultiplier', () => {
  it('returns 1.0 when overlap is undefined', () => {
    assert.equal(overlapMultiplier(undefined), 1.0);
  });
  it('returns 1.0 when overlap is 0', () => {
    assert.equal(overlapMultiplier(0), 1.0);
  });
  it('returns 0.6 when overlap is 100', () => {
    assert.ok(Math.abs(overlapMultiplier(100) - 0.6) < 1e-9);
  });
  it('returns 0.8 when overlap is 50', () => {
    assert.ok(Math.abs(overlapMultiplier(50) - 0.8) < 1e-9);
  });
  it('clamps out-of-range values', () => {
    assert.equal(overlapMultiplier(-10), 1.0);
    assert.ok(Math.abs(overlapMultiplier(200) - 0.6) < 1e-9);
  });
  it('returns 1.0 for non-finite', () => {
    assert.equal(overlapMultiplier(Number.NaN), 1.0);
    assert.equal(overlapMultiplier(Number.POSITIVE_INFINITY), 1.0);
  });
});

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

describe('computePlatformROAS', () => {
  it('returns empty array for no rows', () => {
    assert.deepEqual(computePlatformROAS([]), []);
  });

  it('aggregates rows by platform', () => {
    const rows = [
      makeRow({ platform: 'meta', spend: 100, revenue: 300, clicks: 10, impressions: 100, conversions: 5 }),
      makeRow({ platform: 'meta', spend: 50, revenue: 150, clicks: 5, impressions: 50, conversions: 2 }),
      makeRow({ platform: 'google', spend: 200, revenue: 100, clicks: 20, impressions: 200, conversions: 1 }),
    ];
    const result = computePlatformROAS(rows);
    assert.equal(result.length, 2);
    const meta = result.find((p) => p.platform === 'meta');
    const google = result.find((p) => p.platform === 'google');
    assert.ok(meta);
    assert.ok(google);
    assert.equal(meta.spend, 150);
    assert.equal(meta.revenue, 450);
    assert.equal(meta.roas, 3);
    assert.equal(meta.dataPoints, 2);
    assert.equal(google.roas, 0.5);
  });

  it('sorts by ROAS descending', () => {
    const rows = [
      makeRow({ platform: 'google', spend: 100, revenue: 50 }),
      makeRow({ platform: 'meta', spend: 100, revenue: 500 }),
      makeRow({ platform: 'tiktok', spend: 100, revenue: 200 }),
    ];
    const result = computePlatformROAS(rows);
    assert.deepEqual(
      result.map((r) => r.platform),
      ['meta', 'tiktok', 'google'],
    );
  });

  it('handles zero spend without dividing by zero', () => {
    const rows = [
      makeRow({ platform: 'x', spend: 0, revenue: 0, impressions: 100 }),
    ];
    const result = computePlatformROAS(rows);
    assert.equal(result[0]?.roas, 0);
    assert.equal(result[0]?.cpa, 0);
  });
});

describe('computeReallocationPlan', () => {
  const base = (overrides: Partial<PlatformROAS> = {}): PlatformROAS => ({
    platform: 'meta',
    spend: 100,
    revenue: 200,
    conversions: 10,
    impressions: 1000,
    clicks: 100,
    roas: 2.0,
    cpa: 10,
    ctr: 0.1,
    dataPoints: 5,
    ...overrides,
  });

  it('produces no shifts when all platforms near target', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 2.0 }),
      base({ platform: 'google', roas: 2.1 }),
    ];
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
    });
    assert.equal(plan.shifts.length, 0);
    assert.equal(plan.predictedRoasImprovement, 0);
  });

  it('shifts budget from loser to winner', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 4.0, spend: 100, dataPoints: 10 }),
      base({ platform: 'google', roas: 0.5, spend: 100, dataPoints: 10 }),
    ];
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2.0, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 3 },
    });
    assert.ok(plan.shifts.length > 0);
    assert.equal(plan.shifts[0]?.from, 'google');
    assert.equal(plan.shifts[0]?.to, 'meta');
    assert.ok(plan.proposedAllocations['meta']! > 500);
    assert.ok(plan.proposedAllocations['google']! < 500);
    assert.ok(plan.predictedRoasImprovement > 0);
  });

  it('respects maxShiftPercent cap', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 10, dataPoints: 10 }),
      base({ platform: 'google', roas: 0.1, dataPoints: 10 }),
    ];
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2.0, maxShiftPercent: 0.1, minRoasDelta: 0.2, minDataPoints: 3 },
    });
    const shifted = plan.shifts.reduce((s, x) => s + x.amount, 0);
    assert.ok(shifted <= 100 + 0.01, `shifted ${shifted} > 100`);
  });

  it('skips platforms below minDataPoints', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 5.0, dataPoints: 2 }),
      base({ platform: 'google', roas: 0.1, dataPoints: 10 }),
    ];
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2.0, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 5 },
    });
    // google is a loser but meta is below min data points; no winners → no shifts
    assert.equal(plan.shifts.length, 0);
  });

  it('never drops a loser below 50% of its current budget', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 8.0, dataPoints: 10 }),
      base({ platform: 'google', roas: 0.05, dataPoints: 10 }),
    ];
    const plan = computeReallocationPlan({
      totalBudget: 10_000,
      currentAllocations: { meta: 5000, google: 5000 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2.0, maxShiftPercent: 0.9, minRoasDelta: 0.2, minDataPoints: 3 },
    });
    assert.ok(
      plan.proposedAllocations['google']! >= 2500 - 0.01,
      `google dropped below 50%: ${plan.proposedAllocations['google']}`,
    );
  });

  it('dampens shift amount when winner overlaps heavily with loser', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 5, dataPoints: 10 }),
      base({ platform: 'google', roas: 0.5, dataPoints: 10 }),
    ];
    const withoutOverlap = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 3 },
    });
    const withOverlap = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 3 },
      overlapMatrix: { google: { meta: 100 } },
    });
    const noOverlapTotal = withoutOverlap.shifts.reduce((s, x) => s + x.amount, 0);
    const overlapTotal = withOverlap.shifts.reduce((s, x) => s + x.amount, 0);
    assert.ok(
      overlapTotal < noOverlapTotal,
      `expected overlap shift (${overlapTotal}) to be smaller than no-overlap (${noOverlapTotal})`,
    );
  });

  it('preserves full shift when overlap is 0', () => {
    const platformROAS: PlatformROAS[] = [
      base({ platform: 'meta', roas: 5, dataPoints: 10 }),
      base({ platform: 'google', roas: 0.5, dataPoints: 10 }),
    ];
    const noOverlap = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 3 },
    });
    const zeroOverlap = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS,
      lookbackHours: 24,
      options: { targetRoas: 2, maxShiftPercent: 0.25, minRoasDelta: 0.2, minDataPoints: 3 },
      overlapMatrix: { google: { meta: 0 } },
    });
    const a = noOverlap.shifts[0]?.amount ?? 0;
    const b = zeroOverlap.shifts[0]?.amount ?? 0;
    assert.ok(Math.abs(a - b) < 0.01, `0% overlap should equal no-data case: ${a} vs ${b}`);
  });

  it('surfaces overlapPercent in shift entry when overlap is provided', () => {
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 500, google: 500 },
      platformROAS: [
        base({ platform: 'meta', roas: 5, dataPoints: 10 }),
        base({ platform: 'google', roas: 0.5, dataPoints: 10 }),
      ],
      lookbackHours: 24,
      overlapMatrix: { google: { meta: 42 } },
    });
    assert.equal(plan.shifts[0]?.overlapPercent, 42);
    assert.ok(plan.shifts[0]?.reason.includes('42%'));
  });

  it('assigns higher confidence with more data points', () => {
    const lots = Array.from({ length: 3 }, (_, i) =>
      base({
        platform: (['meta', 'google', 'tiktok'] as const)[i],
        dataPoints: 30,
        roas: i === 0 ? 4 : 0.5,
      }),
    );
    const plan = computeReallocationPlan({
      totalBudget: 1000,
      currentAllocations: { meta: 400, google: 300, tiktok: 300 },
      platformROAS: lots,
      lookbackHours: 24,
    });
    assert.equal(plan.confidence, 'high');
  });
});
