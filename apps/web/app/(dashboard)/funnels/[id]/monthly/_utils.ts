import type { MonthlyRow, PivotMeta } from './_types';

// ---------------------------------------------------------------------------
// Number formatters — single instances shared across cells
// ---------------------------------------------------------------------------

const JP = new Intl.NumberFormat('ja-JP');
const JPY = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

export const fmtInt = (v: number): string => JP.format(Math.round(v));
export const fmtYen = (v: number): string =>
  v > 0 ? JPY.format(Math.round(v)) : '—';
export const fmtPct = (v: number): string =>
  Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : '—';

// ---------------------------------------------------------------------------
// Trailing-6 windowing + z-score anomaly flags
// ---------------------------------------------------------------------------

export type NumericKey =
  | 'impressions'
  | 'clicks'
  | 'cpc'
  | 'ctr'
  | 'cv1'
  | 'cvr1'
  | 'cpa1'
  | 'cv2'
  | 'cvr2'
  | 'cpa2'
  | 'cv3'
  | 'cvr3'
  | 'cpa3'
  | 'spend'
  | 'divergence';

export interface Trailing {
  series: number[];
  anomalyZ?: number;
}

function zscore(value: number, window: number[]): number {
  if (window.length === 0) return 0;
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance =
    window.reduce((s, v) => s + (v - mean) * (v - mean), 0) / window.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0 || !Number.isFinite(stdev)) return 0;
  return (value - mean) / stdev;
}

export function trailingFor(
  rows: MonthlyRow[],
  index: number,
  key: NumericKey,
): Trailing {
  const series = rows.slice(Math.max(0, index - 5), index + 1).map((r) => r[key]);
  const windowValues = rows
    .slice(Math.max(0, index - 6), index)
    .map((r) => r[key]);
  const current = rows[index];
  if (!current || windowValues.length < 3) return { series };
  const z = zscore(current[key], windowValues);
  return { series, anomalyZ: Math.abs(z) > 2 ? z : undefined };
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export interface ColumnDef {
  key: NumericKey;
  header: string;
  format: (v: number) => string;
}

export function buildColumns(meta: PivotMeta): ColumnDef[] {
  const s1 = meta.stages[0]?.name ?? 'CV①';
  const s2 = meta.stages[1]?.name ?? 'CV②';
  const s3 = meta.stages[2]?.name ?? 'CV③';
  return [
    { key: 'impressions', header: 'imp', format: fmtInt },
    { key: 'clicks', header: 'Click', format: fmtInt },
    { key: 'cpc', header: 'CPC', format: fmtYen },
    { key: 'ctr', header: 'CTR', format: fmtPct },
    { key: 'cv1', header: `CV① ${s1}`, format: fmtInt },
    { key: 'cvr1', header: 'CV①CVR', format: fmtPct },
    { key: 'cpa1', header: 'CV①CPA', format: fmtYen },
    { key: 'cv2', header: `CV② ${s2}`, format: fmtInt },
    { key: 'cvr2', header: 'CV②CVR', format: fmtPct },
    { key: 'cpa2', header: 'CV②CPA', format: fmtYen },
    { key: 'cv3', header: `CV③ ${s3}`, format: fmtInt },
    { key: 'cvr3', header: 'CV③CVR', format: fmtPct },
    { key: 'cpa3', header: 'CV③CPA', format: fmtYen },
    { key: 'spend', header: '消化金額', format: fmtYen },
    { key: 'divergence', header: '乖離率 (CV②/CV①)', format: fmtPct },
  ];
}

/** Derive the last YYYY-MM month key (UTC, today). */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
