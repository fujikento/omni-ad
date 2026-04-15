import { db } from '@omni-ad/db';
import {
  funnels,
  funnelStagesSchema,
  type FunnelStage,
} from '@omni-ad/db/schema';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One row of the monthly pivot — the first three stages of the funnel are
 * surfaced as cv1/cv2/cv3 counts plus derived rate/cost metrics.
 */
export interface MonthlyRow {
  month: string; // ISO month prefix "YYYY-MM"
  impressions: number;
  clicks: number;
  spend: number;
  revenue: number;
  cv1: number;
  cv2: number;
  cv3: number;
  // derived (populated by deriveRowMetrics)
  cpc: number;
  ctr: number;
  cvr1: number;
  cpa1: number;
  cvr2: number;
  cpa2: number;
  cvr3: number;
  cpa3: number;
  divergence: number;
}

export interface PivotMeta {
  stages: FunnelStage[];
  eventNames: string[];
}

export interface MonthlyPivot {
  months: MonthlyRow[];
  meta: PivotMeta;
}

export class FunnelNotFoundError extends Error {
  constructor(funnelId: string) {
    super(`Funnel not found: ${funnelId}`);
    this.name = 'FunnelNotFoundError';
  }
}

export class FunnelConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FunnelConfigurationError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely divide a/b, returning 0 for divide-by-zero / non-finite. */
export function safeDivide(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  const result = a / b;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Pure helper: given raw counters on a MonthlyRow, compute the full set of
 * derived rate/cost metrics in place and return a new immutable row.
 */
export function deriveRowMetrics(row: MonthlyRow): MonthlyRow {
  const cpc = safeDivide(row.spend, row.clicks);
  const ctr = safeDivide(row.clicks, row.impressions);
  const cvr1 = safeDivide(row.cv1, row.clicks);
  const cpa1 = safeDivide(row.spend, row.cv1);
  const cvr2 = safeDivide(row.cv2, row.cv1);
  const cpa2 = safeDivide(row.spend, row.cv2);
  const cvr3 = safeDivide(row.cv3, row.cv2);
  const cpa3 = safeDivide(row.spend, row.cv3);
  const divergence = safeDivide(row.cv2, row.cv1);
  return {
    ...row,
    cpc,
    ctr,
    cvr1,
    cpa1,
    cvr2,
    cpa2,
    cvr3,
    cpa3,
    divergence,
  };
}

/** Load and validate the funnel + first three stages. */
async function loadFunnelStages(
  orgId: string,
  funnelId: string,
): Promise<FunnelStage[]> {
  const row = await db.query.funnels.findFirst({
    where: and(eq(funnels.id, funnelId), eq(funnels.organizationId, orgId)),
  });
  if (!row) throw new FunnelNotFoundError(funnelId);

  const parsed = funnelStagesSchema.safeParse(row.stages);
  if (!parsed.success) {
    throw new FunnelConfigurationError(
      `Funnel ${funnelId} has invalid stages JSONB: ${parsed.error.message}`,
    );
  }
  if (parsed.data.length < 3) {
    throw new FunnelConfigurationError(
      `Funnel ${funnelId} must define at least 3 stages (got ${parsed.data.length})`,
    );
  }
  return parsed.data;
}

interface PivotQueryRow extends Record<string, unknown> {
  month_key: string;
  impressions: string | number | null;
  clicks: string | number | null;
  spend: string | number | null;
  revenue: string | number | null;
  cv1: string | number | null;
  cv2: string | number | null;
  cv3: string | number | null;
}

/** Coerce potentially-string numeric column output into a finite number. */
function asNumber(value: string | number | null): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function toMonthKey(endMonth: string, offsetMonths: number): string {
  const [y, m] = endMonth.split('-').map(Number);
  if (!y || !m) return endMonth;
  const target = new Date(Date.UTC(y, m - 1 - offsetMonths, 1));
  const yyyy = target.getUTCFullYear();
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Monthly pivot for a funnel: one row per calendar month for the trailing
 * `monthCount` months ending at `endMonth` (inclusive, format "YYYY-MM").
 */
export async function getPivot(
  orgId: string,
  funnelId: string,
  endMonth: string,
  monthCount = 12,
): Promise<MonthlyPivot> {
  const stages = await loadFunnelStages(orgId, funnelId);
  const eventNames = stages.slice(0, 3).map((s) => s.eventName);
  const [e1, e2, e3] = eventNames;

  // Month bucket bounds. "YYYY-MM-01" works as a date literal in Postgres.
  const endMonthStart = `${endMonth}-01`;
  const rawRows = await db.execute<PivotQueryRow>(sql`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', ${endMonthStart}::date) - (${monthCount - 1} || ' months')::interval,
        date_trunc('month', ${endMonthStart}::date),
        '1 month'::interval
      )::date AS month_start
    ),
    metrics_agg AS (
      SELECT
        date_trunc('month', md.date)::date AS month_start,
        SUM(md.impressions)::bigint AS impressions,
        SUM(md.clicks)::bigint AS clicks,
        SUM(md.spend)::numeric AS spend,
        SUM(md.revenue)::numeric AS revenue
      FROM metrics_daily md
      JOIN campaigns c ON c.id = md.campaign_id
      WHERE c.organization_id = ${orgId}
        AND md.date >= date_trunc('month', ${endMonthStart}::date) - (${monthCount - 1} || ' months')::interval
        AND md.date <  date_trunc('month', ${endMonthStart}::date) + interval '1 month'
      GROUP BY 1
    ),
    events_agg AS (
      SELECT
        date_trunc('month', ce.created_at)::date AS month_start,
        SUM(CASE WHEN ce.event_name = ${e1} THEN 1 ELSE 0 END)::bigint AS cv1,
        SUM(CASE WHEN ce.event_name = ${e2} THEN 1 ELSE 0 END)::bigint AS cv2,
        SUM(CASE WHEN ce.event_name = ${e3} THEN 1 ELSE 0 END)::bigint AS cv3
      FROM conversion_events ce
      WHERE ce.organization_id = ${orgId}
        AND ce.created_at >= date_trunc('month', ${endMonthStart}::date) - (${monthCount - 1} || ' months')::interval
        AND ce.created_at <  date_trunc('month', ${endMonthStart}::date) + interval '1 month'
      GROUP BY 1
    )
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS month_key,
      COALESCE(ma.impressions, 0) AS impressions,
      COALESCE(ma.clicks, 0) AS clicks,
      COALESCE(ma.spend, 0) AS spend,
      COALESCE(ma.revenue, 0) AS revenue,
      COALESCE(ea.cv1, 0) AS cv1,
      COALESCE(ea.cv2, 0) AS cv2,
      COALESCE(ea.cv3, 0) AS cv3
    FROM months m
    LEFT JOIN metrics_agg ma ON ma.month_start = m.month_start
    LEFT JOIN events_agg ea ON ea.month_start = m.month_start
    ORDER BY m.month_start ASC;
  `);

  const dbRows = Array.isArray(rawRows)
    ? (rawRows as PivotQueryRow[])
    : ((rawRows as { rows?: PivotQueryRow[] }).rows ?? []);

  const byMonth = new Map<string, PivotQueryRow>();
  for (const r of dbRows) byMonth.set(String(r.month_key), r);

  const months: MonthlyRow[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const key = toMonthKey(endMonth, i);
    const r = byMonth.get(key);
    const base: MonthlyRow = {
      month: key,
      impressions: asNumber(r?.impressions ?? 0),
      clicks: asNumber(r?.clicks ?? 0),
      spend: asNumber(r?.spend ?? 0),
      revenue: asNumber(r?.revenue ?? 0),
      cv1: asNumber(r?.cv1 ?? 0),
      cv2: asNumber(r?.cv2 ?? 0),
      cv3: asNumber(r?.cv3 ?? 0),
      cpc: 0,
      ctr: 0,
      cvr1: 0,
      cpa1: 0,
      cvr2: 0,
      cpa2: 0,
      cvr3: 0,
      cpa3: 0,
      divergence: 0,
    };
    months.push(deriveRowMetrics(base));
  }

  return {
    months,
    meta: { stages, eventNames },
  };
}

// ---------------------------------------------------------------------------
// Anomaly detection (trailing 6-month z-score per column)
// ---------------------------------------------------------------------------

export interface AnomalyFlag {
  column: keyof MonthlyRow;
  zScore: number;
  mean: number;
  stdev: number;
}

/** Columns we evaluate for anomalies. Non-numeric/identity columns excluded. */
const ANOMALY_COLUMNS: Array<keyof MonthlyRow> = [
  'impressions',
  'clicks',
  'spend',
  'revenue',
  'cv1',
  'cv2',
  'cv3',
  'cpc',
  'ctr',
  'cvr1',
  'cpa1',
  'cvr2',
  'cpa2',
  'cvr3',
  'cpa3',
  'divergence',
];

/** Compute the z-score of `value` against a sample `window`. Returns 0 for empty/flat windows. */
export function zscore(value: number, window: number[]): number {
  if (!window.length) return 0;
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance =
    window.reduce((s, v) => s + (v - mean) * (v - mean), 0) / window.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0 || !Number.isFinite(stdev)) return 0;
  return (value - mean) / stdev;
}

/** Compute the trailing-window mean and sample stdev. */
function windowStats(window: number[]): { mean: number; stdev: number } {
  if (!window.length) return { mean: 0, stdev: 0 };
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance =
    window.reduce((s, v) => s + (v - mean) * (v - mean), 0) / window.length;
  return { mean, stdev: Math.sqrt(variance) };
}

/**
 * Per-row, per-column anomaly flags: for each month, look at the trailing
 * six-month window (excluding the current row) and flag any column whose
 * |z-score| exceeds 2.
 */
export function computeAnomalies(rows: MonthlyRow[]): AnomalyFlag[][] {
  const out: AnomalyFlag[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const flags: AnomalyFlag[] = [];
    const windowStart = Math.max(0, i - 6);
    const windowRows = rows.slice(windowStart, i);
    if (!windowRows.length) {
      out.push(flags);
      continue;
    }
    const current = rows[i];
    if (!current) {
      out.push(flags);
      continue;
    }
    for (const col of ANOMALY_COLUMNS) {
      const windowValues = windowRows.map((r) => r[col] as number);
      const { mean, stdev } = windowStats(windowValues);
      const value = current[col] as number;
      const z = zscore(value, windowValues);
      if (Math.abs(z) > 2) flags.push({ column: col, zScore: z, mean, stdev });
    }
    out.push(flags);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forecasting (linear regression + Y-on-Y seasonal blend)
// ---------------------------------------------------------------------------

export interface ForecastPoint {
  month: string;
  cv1: number;
  cv2: number;
  cv3: number;
}

/** Linear regression: returns slope, intercept, and residual stderr. */
export function linearRegress(
  points: { x: number; y: number }[],
): { slope: number; intercept: number; stderr: number } {
  if (points.length < 2) return { slope: 0, intercept: 0, stderr: 0 };
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }
  if (den === 0) return { slope: 0, intercept: meanY, stderr: 0 };
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  let sse = 0;
  for (const p of points) {
    const pred = slope * p.x + intercept;
    sse += (p.y - pred) * (p.y - pred);
  }
  const stderr = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { slope, intercept, stderr };
}

/** Shift a "YYYY-MM" month key forward by `delta` months. */
function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function blendSeasonal(
  regressed: number,
  rows: MonthlyRow[],
  targetMonth: string,
  stage: keyof Pick<MonthlyRow, 'cv1' | 'cv2' | 'cv3'>,
): number {
  const yoyKey = shiftMonth(targetMonth, -12);
  const yoyRow = rows.find((r) => r.month === yoyKey);
  if (!yoyRow) return regressed;
  const yoyValue = yoyRow[stage];
  // Naive blend: 60% regression, 40% Y-on-Y anchor.
  return 0.6 * regressed + 0.4 * yoyValue;
}

/**
 * Per-stage forecast (cv1, cv2, cv3) for the next `horizon` months, blending
 * a simple OLS trend with a Y-on-Y seasonal anchor when available.
 */
export function computeForecast(
  rows: MonthlyRow[],
  horizon = 3,
): ForecastPoint[] {
  if (rows.length === 0) return [];
  const lastMonth = rows[rows.length - 1]?.month ?? '1970-01';

  const stages: Array<keyof Pick<MonthlyRow, 'cv1' | 'cv2' | 'cv3'>> = [
    'cv1',
    'cv2',
    'cv3',
  ];
  const regressions = stages.map((stage) =>
    linearRegress(rows.map((r, idx) => ({ x: idx, y: r[stage] }))),
  );

  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const x = rows.length - 1 + h;
    const month = shiftMonth(lastMonth, h);
    const point: ForecastPoint = { month, cv1: 0, cv2: 0, cv3: 0 };
    stages.forEach((stage, i) => {
      const reg = regressions[i];
      if (!reg) return;
      const regressed = Math.max(0, reg.slope * x + reg.intercept);
      point[stage] = blendSeasonal(regressed, rows, month, stage);
    });
    out.push(point);
  }
  return out;
}
