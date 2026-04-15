'use client';

import { memo, useMemo } from 'react';
import { StatCard } from '@omni-ad/ui';
import type { MonthlyRow } from '../_types';

export interface KpiSummaryRowProps {
  months: MonthlyRow[];
}

const JP = new Intl.NumberFormat('ja-JP');
const JPY = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

interface Totals {
  impressions: number;
  cv1: number;
  avgCpa1: number;
  avgDivergence: number;
}

function computeTotals(months: MonthlyRow[]): Totals {
  if (months.length === 0) {
    return { impressions: 0, cv1: 0, avgCpa1: 0, avgDivergence: 0 };
  }
  let impressions = 0;
  let cv1 = 0;
  let spend = 0;
  let divSum = 0;
  let divCount = 0;
  for (const r of months) {
    impressions += r.impressions;
    cv1 += r.cv1;
    spend += r.spend;
    if (Number.isFinite(r.divergence) && r.divergence > 0) {
      divSum += r.divergence;
      divCount += 1;
    }
  }
  const avgCpa1 = cv1 > 0 ? spend / cv1 : 0;
  const avgDivergence = divCount > 0 ? divSum / divCount : 0;
  return { impressions, cv1, avgCpa1, avgDivergence };
}

/**
 * Four StatCards summarising the visible window. Totals are memoised against
 * the `months` reference so re-renders triggered by note mutations are cheap.
 */
function KpiSummaryRowImpl({ months }: KpiSummaryRowProps): React.ReactElement {
  const totals = useMemo(() => computeTotals(months), [months]);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="合計 imp" value={JP.format(totals.impressions)} />
      <StatCard label="合計 CV①" value={JP.format(totals.cv1)} />
      <StatCard
        label="平均 CPA"
        value={totals.avgCpa1 > 0 ? JPY.format(Math.round(totals.avgCpa1)) : '—'}
      />
      <StatCard
        label="平均 乖離率 (CV②/CV①)"
        value={
          totals.avgDivergence > 0
            ? `${(totals.avgDivergence * 100).toFixed(1)}%`
            : '—'
        }
      />
    </div>
  );
}

export const KpiSummaryRow = memo(KpiSummaryRowImpl);
KpiSummaryRow.displayName = 'KpiSummaryRow';
