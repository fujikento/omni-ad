import { db } from '@omni-ad/db';
import {
  funnels,
  funnelStagesSchema,
  type FunnelStage,
} from '@omni-ad/db/schema';
import { and, eq, sql } from 'drizzle-orm';

// Attribution model type — matches the queue's ComputeAttributionJob shape
// without forcing callers to import the worker package.
export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based';

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

// ---------------------------------------------------------------------------
// Cohort matrix — stage-1 → stage-2 transitions by (hashed_email, clickId, ip)
// ---------------------------------------------------------------------------

export interface StageTransition {
  fromStage: string;
  toStage: string;
  lagMonths: number[];
  pct: number;
}

export interface CohortRow {
  cohortMonth: string; // "YYYY-MM"
  stageTransitions: StageTransition[];
}

interface CohortQueryRow extends Record<string, unknown> {
  cohort_month: string;
  lag_months: number | string | null;
  matched: string | number | null;
  cohort_total: string | number | null;
}

/**
 * Cohort matrix: for each month M in the trailing `monthCount` months, take
 * every unique identity that triggered stage-1 in M and, via a LATERAL
 * self-join on conversion_events keyed by
 * COALESCE(hashed_email, external_click_id, ip_address), find the earliest
 * stage-2 event by that same identity within [M, M+6 months).
 */
export async function getCohortMatrix(
  orgId: string,
  funnelId: string,
  monthCount = 6,
): Promise<CohortRow[]> {
  const stages = await loadFunnelStages(orgId, funnelId);
  const [stage1, stage2] = stages;
  if (!stage1 || !stage2) return [];

  const rawRows = await db.execute<CohortQueryRow>(sql`
    WITH cohort_members AS (
      SELECT
        date_trunc('month', ce.created_at)::date AS cohort_month,
        COALESCE(ce.hashed_email, ce.external_click_id, ce.ip_address) AS identity,
        MIN(ce.created_at) AS first_touch
      FROM conversion_events ce
      WHERE ce.organization_id = ${orgId}
        AND ce.event_name = ${stage1.eventName}
        AND ce.created_at >= date_trunc('month', now()) - (${monthCount} || ' months')::interval
        AND COALESCE(ce.hashed_email, ce.external_click_id, ce.ip_address) IS NOT NULL
      GROUP BY 1, 2
    ),
    matched AS (
      SELECT
        cm.cohort_month,
        cm.identity,
        nxt.matched_at,
        EXTRACT(MONTH FROM age(nxt.matched_at, cm.first_touch))::int
          + 12 * EXTRACT(YEAR FROM age(nxt.matched_at, cm.first_touch))::int AS lag_months
      FROM cohort_members cm
      LEFT JOIN LATERAL (
        SELECT MIN(ce2.created_at) AS matched_at
        FROM conversion_events ce2
        WHERE ce2.organization_id = ${orgId}
          AND ce2.event_name = ${stage2.eventName}
          AND COALESCE(ce2.hashed_email, ce2.external_click_id, ce2.ip_address) = cm.identity
          AND ce2.created_at >= cm.first_touch
          AND ce2.created_at <  cm.first_touch + interval '6 months'
      ) nxt ON TRUE
    )
    SELECT
      to_char(cohort_month, 'YYYY-MM') AS cohort_month,
      lag_months,
      COUNT(*) FILTER (WHERE matched_at IS NOT NULL) AS matched,
      COUNT(*) AS cohort_total
    FROM matched
    GROUP BY cohort_month, lag_months
    ORDER BY cohort_month ASC, lag_months ASC NULLS LAST;
  `);

  const dbRows = Array.isArray(rawRows)
    ? (rawRows as CohortQueryRow[])
    : ((rawRows as { rows?: CohortQueryRow[] }).rows ?? []);

  return buildCohortRows(dbRows, stage1.name, stage2.name);
}

function buildCohortRows(
  dbRows: CohortQueryRow[],
  fromStageName: string,
  toStageName: string,
): CohortRow[] {
  // Group by cohort_month.
  const byMonth = new Map<
    string,
    { lags: number[]; matched: number; total: number }
  >();
  for (const r of dbRows) {
    const key = String(r.cohort_month);
    const entry = byMonth.get(key) ?? { lags: [], matched: 0, total: 0 };
    const lag = r.lag_months === null ? null : Number(r.lag_months);
    const matched = Number(r.matched ?? 0);
    const total = Number(r.cohort_total ?? 0);
    if (lag !== null && Number.isFinite(lag)) {
      for (let i = 0; i < matched; i++) entry.lags.push(lag);
    }
    entry.matched += matched;
    entry.total += total;
    byMonth.set(key, entry);
  }

  const out: CohortRow[] = [];
  for (const [month, entry] of byMonth) {
    const pct = entry.total > 0 ? entry.matched / entry.total : 0;
    out.push({
      cohortMonth: month,
      stageTransitions: [
        {
          fromStage: fromStageName,
          toStage: toStageName,
          lagMonths: entry.lags,
          pct,
        },
      ],
    });
  }
  out.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  return out;
}

// ---------------------------------------------------------------------------
// Attribution — per-stage channel credit for a given month
// ---------------------------------------------------------------------------

export interface ChannelCredit {
  channel: string;
  credit: number;
}

export interface StageAttribution {
  stageName: string;
  channels: ChannelCredit[];
}

interface AttributionRow extends Record<string, unknown> {
  platform: string | null;
  credit: string | number | null;
}

/**
 * Per-stage attribution: for each of the funnel's first three stages,
 * compute credit per platform by joining conversion_events to attribution
 * touchpoints (filtered to the month) with the requested weighting model.
 *
 * This is a synchronous compute (unlike report.service.computeAttribution
 * which schedules a worker job). We surface the credit map directly so the
 * dashboard can render it inline.
 */
export async function getAttribution(
  orgId: string,
  funnelId: string,
  month: string,
  model: AttributionModel,
): Promise<StageAttribution[]> {
  const stages = await loadFunnelStages(orgId, funnelId);
  const first3 = stages.slice(0, 3);
  const monthStart = `${month}-01`;

  const results = await Promise.all(
    first3.map((stage) =>
      computeStageCredit(orgId, stage.eventName, monthStart, model),
    ),
  );

  return first3.map((stage, i) => ({
    stageName: stage.name,
    channels: results[i] ?? [],
  }));
}

async function computeStageCredit(
  orgId: string,
  eventName: string,
  monthStart: string,
  model: AttributionModel,
): Promise<ChannelCredit[]> {
  const weight = attributionWeightExpr(model);
  const rows = await db.execute<AttributionRow>(sql`
    WITH conversions AS (
      SELECT
        ce.id AS conversion_id,
        ce.created_at AS conv_at,
        COALESCE(ce.hashed_email, ce.external_click_id, ce.ip_address) AS identity
      FROM conversion_events ce
      WHERE ce.organization_id = ${orgId}
        AND ce.event_name = ${eventName}
        AND ce.created_at >= ${monthStart}::date
        AND ce.created_at <  (${monthStart}::date + interval '1 month')
    ),
    touchpoints AS (
      SELECT
        t.platform,
        c.conversion_id,
        ROW_NUMBER() OVER (PARTITION BY c.conversion_id ORDER BY t.timestamp ASC) AS touch_rank,
        COUNT(*) OVER (PARTITION BY c.conversion_id) AS touch_count
      FROM attribution_touchpoints t
      JOIN conversions c
        ON c.identity = t.visitor_id
       AND t.timestamp <= c.conv_at
      WHERE t.organization_id = ${orgId}
    )
    SELECT platform, SUM(${weight})::numeric AS credit
    FROM touchpoints
    GROUP BY platform
    ORDER BY credit DESC;
  `);

  const list = Array.isArray(rows)
    ? (rows as AttributionRow[])
    : ((rows as { rows?: AttributionRow[] }).rows ?? []);

  return list.map((r) => ({
    channel: String(r.platform ?? 'unknown'),
    credit: Number(r.credit ?? 0),
  }));
}

/** SQL weight expression for each attribution model. */
function attributionWeightExpr(model: AttributionModel) {
  switch (model) {
    case 'first_touch':
      return sql`CASE WHEN touch_rank = 1 THEN 1 ELSE 0 END`;
    case 'last_touch':
      return sql`CASE WHEN touch_rank = touch_count THEN 1 ELSE 0 END`;
    case 'linear':
      return sql`1.0 / NULLIF(touch_count, 0)`;
    case 'time_decay':
      // Exponential-ish: rank-weighted so later touches get more credit.
      return sql`(touch_rank * 1.0) / NULLIF((touch_count * (touch_count + 1)) / 2.0, 0)`;
    case 'position_based':
      // 40% first, 40% last, 20% spread across middle.
      return sql`CASE
        WHEN touch_count = 1 THEN 1.0
        WHEN touch_rank = 1 OR touch_rank = touch_count THEN 0.4
        ELSE 0.2 / NULLIF(touch_count - 2, 0)
      END`;
  }
}

// ---------------------------------------------------------------------------
// Drilldown — top 10 campaigns / creatives / channels for a given stage/month
// ---------------------------------------------------------------------------

export interface DrilldownItem {
  id: string;
  label: string;
  count: number;
}

export interface Drilldown {
  campaigns: DrilldownItem[];
  creatives: DrilldownItem[];
  channels: DrilldownItem[];
}

interface DrilldownRow extends Record<string, unknown> {
  id: string | null;
  label: string | null;
  count: string | number | null;
}

function toDrilldownItems(rows: DrilldownRow[]): DrilldownItem[] {
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    label: String(r.label ?? ''),
    count: Number(r.count ?? 0),
  }));
}

function asRowsArray<T extends Record<string, unknown>>(
  raw: unknown,
): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const withRows = raw as { rows?: T[] };
  return withRows.rows ?? [];
}

export async function getDrilldown(
  orgId: string,
  funnelId: string,
  month: string,
  stageIndex: number,
): Promise<Drilldown> {
  const stages = await loadFunnelStages(orgId, funnelId);
  const stage = stages[stageIndex];
  if (!stage) {
    throw new FunnelConfigurationError(
      `Invalid stageIndex ${stageIndex} for funnel ${funnelId}`,
    );
  }
  const monthStart = `${month}-01`;

  const [campaignsRaw, creativesRaw, channelsRaw] = await Promise.all([
    db.execute<DrilldownRow>(sql`
      SELECT
        c.id::text AS id,
        c.name AS label,
        COUNT(*) AS count
      FROM conversion_events ce
      JOIN campaigns c ON c.id = ce.campaign_id
      WHERE ce.organization_id = ${orgId}
        AND ce.event_name = ${stage.eventName}
        AND ce.created_at >= ${monthStart}::date
        AND ce.created_at <  (${monthStart}::date + interval '1 month')
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT 10;
    `),
    db.execute<DrilldownRow>(sql`
      -- conversion_events only links to campaigns, so we walk
      -- campaigns → ad_groups → ads → creatives to surface the creatives
      -- that ran under campaigns producing this month's conversions.
      SELECT
        cr.id::text AS id,
        cr.name AS label,
        COUNT(DISTINCT ce.id) AS count
      FROM conversion_events ce
      JOIN ad_groups ag ON ag.campaign_id = ce.campaign_id
      JOIN ads a        ON a.ad_group_id = ag.id
      JOIN creatives cr ON cr.id = a.creative_id
      WHERE ce.organization_id = ${orgId}
        AND ce.event_name = ${stage.eventName}
        AND ce.created_at >= ${monthStart}::date
        AND ce.created_at <  (${monthStart}::date + interval '1 month')
      GROUP BY cr.id, cr.name
      ORDER BY count DESC
      LIMIT 10;
    `),
    db.execute<DrilldownRow>(sql`
      SELECT
        COALESCE(t.platform::text, 'unknown') AS id,
        COALESCE(t.platform::text, 'unknown') AS label,
        COUNT(*) AS count
      FROM attribution_touchpoints t
      JOIN conversion_events ce
        ON ce.organization_id = t.organization_id
       AND COALESCE(ce.hashed_email, ce.external_click_id, ce.ip_address) = t.visitor_id
      WHERE t.organization_id = ${orgId}
        AND ce.event_name = ${stage.eventName}
        AND ce.created_at >= ${monthStart}::date
        AND ce.created_at <  (${monthStart}::date + interval '1 month')
      GROUP BY t.platform
      ORDER BY count DESC
      LIMIT 10;
    `),
  ]);

  return {
    campaigns: toDrilldownItems(asRowsArray<DrilldownRow>(campaignsRaw)),
    creatives: toDrilldownItems(asRowsArray<DrilldownRow>(creativesRaw)),
    channels: toDrilldownItems(asRowsArray<DrilldownRow>(channelsRaw)),
  };
}
