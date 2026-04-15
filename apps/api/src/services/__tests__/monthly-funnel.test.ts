import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  computeAnomalies,
  computeForecast,
  deriveRowMetrics,
  linearRegress,
  safeDivide,
  zscore,
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

describe('zscore', () => {
  it('returns 0 for empty window', () => {
    assert.equal(zscore(5, []), 0);
  });

  it('returns 0 for a flat window (stdev = 0)', () => {
    assert.equal(zscore(5, [3, 3, 3, 3]), 0);
  });

  it('computes correct z-score for a simple window', () => {
    // window = [1,2,3,4,5] → mean=3, popStdev=sqrt(2)
    const z = zscore(5, [1, 2, 3, 4, 5]);
    const expected = (5 - 3) / Math.sqrt(2);
    assert.ok(Math.abs(z - expected) < 1e-9);
  });

  it('is symmetric around the mean', () => {
    const up = zscore(7, [1, 2, 3, 4, 5]);
    const down = zscore(-1, [1, 2, 3, 4, 5]);
    assert.ok(Math.abs(up + down) < 1e-9);
  });
});

describe('linearRegress', () => {
  it('recovers slope and intercept of y = 2x + 1', () => {
    const pts = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ];
    const { slope, intercept, stderr } = linearRegress(pts);
    assert.ok(Math.abs(slope - 2) < 1e-9);
    assert.ok(Math.abs(intercept - 1) < 1e-9);
    assert.ok(Math.abs(stderr) < 1e-9);
  });

  it('returns zero slope for insufficient points', () => {
    assert.deepEqual(linearRegress([]), { slope: 0, intercept: 0, stderr: 0 });
    assert.deepEqual(linearRegress([{ x: 1, y: 2 }]), {
      slope: 0,
      intercept: 0,
      stderr: 0,
    });
  });

  it('handles vertical data (den=0) without NaN', () => {
    const result = linearRegress([
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ]);
    assert.equal(result.slope, 0);
    assert.equal(result.intercept, 2);
  });
});

function blankRow(month: string, cv1: number): MonthlyRow {
  return makeRow({ month, cv1, cv2: cv1 / 2, cv3: cv1 / 4 });
}

describe('computeAnomalies', () => {
  it('returns empty flags for first row (no history)', () => {
    const rows = [blankRow('2026-01', 100)];
    const flags = computeAnomalies(rows);
    assert.equal(flags.length, 1);
    assert.deepEqual(flags[0], []);
  });

  it('flags a row that is > 2 sigma away from trailing mean', () => {
    const steady = Array.from({ length: 6 }, (_, i) =>
      blankRow(`2025-${String(i + 1).padStart(2, '0')}`, 100),
    );
    // Small jitter so stdev > 0
    steady[0] = blankRow('2025-01', 101);
    steady[1] = blankRow('2025-02', 99);
    const spike = blankRow('2025-07', 10_000);
    const flags = computeAnomalies([...steady, spike]);
    const lastFlags = flags[flags.length - 1] ?? [];
    assert.ok(lastFlags.some((f) => f.column === 'cv1' && f.zScore > 2));
  });

  it('does not flag anomaly when the value is inside the trailing 2-sigma band', () => {
    // Steady state + one small jitter per row so stdev > 0; final row stays
    // well within 2 sigma of the trailing-6 window.
    const rows: MonthlyRow[] = [];
    const base = [100, 102, 99, 101, 100, 103, 101];
    base.forEach((v, i) => {
      rows.push(blankRow(`2025-${String(i + 1).padStart(2, '0')}`, v));
    });
    const flags = computeAnomalies(rows);
    const lastFlags = flags[flags.length - 1] ?? [];
    // cv1=101 vs mean ~100.17, stdev ~1.46 → z ≈ 0.57 → no flag
    assert.ok(
      !lastFlags.some((f) => f.column === 'cv1'),
      `Unexpected cv1 anomaly: ${JSON.stringify(lastFlags)}`,
    );
  });
});

describe('computeForecast', () => {
  it('returns empty for empty input', () => {
    assert.deepEqual(computeForecast([], 3), []);
  });

  it('produces horizon points with non-negative values', () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      blankRow(`2025-${String(i + 1).padStart(2, '0')}`, 100 + i * 5),
    );
    const forecast = computeForecast(rows, 3);
    assert.equal(forecast.length, 3);
    for (const f of forecast) {
      assert.ok(f.cv1 >= 0);
      assert.ok(f.cv2 >= 0);
      assert.ok(f.cv3 >= 0);
      assert.ok(f.month.match(/^\d{4}-\d{2}$/));
    }
  });

  it('blends Y-on-Y seasonal anchor when available', () => {
    // 24 months of history with a strong seasonal pattern
    const rows: MonthlyRow[] = [];
    for (let i = 0; i < 24; i++) {
      const y = 2024 + Math.floor(i / 12);
      const m = (i % 12) + 1;
      // Big spike every December
      const cv1 = m === 12 ? 1000 : 100;
      rows.push(blankRow(`${y}-${String(m).padStart(2, '0')}`, cv1));
    }
    const forecast = computeForecast(rows, 1);
    // Last row is 2025-12, next month 2026-01 — its Y-on-Y is 2025-01 (cv1=100)
    // Regression is dominated by mid-200s; blend pulls toward 100.
    const first = forecast[0];
    assert.ok(first);
    assert.ok(first.cv1 < 400);
  });
});
