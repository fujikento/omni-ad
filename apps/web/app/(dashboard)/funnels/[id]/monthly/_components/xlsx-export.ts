import type { MonthlyRow, PivotMeta } from '../_types';

/**
 * Client-side XLSX exporter for the monthly funnel pivot.
 *
 * TODO(commit-9): swap the CSV+BOM fallback for a real SheetJS workbook once
 * the `xlsx` dependency is added (`pnpm --filter @omni-ad/web add xlsx`).
 * The signature below is stable so the call-site doesn't need to change when
 * the real implementation lands — only the inner `buildWorkbookBlob` body
 * swaps from CSV-with-BOM to a proper XLSX binary.
 *
 * Shape decisions (locked in now so the XLSX port is mechanical):
 *   - Sheet 1 "Pivot": month + 15 metric columns
 *   - Sheet 2 "Notes": month + text
 *   - Sheet 3 "Meta":  stage index, stage name, event name
 * All sheets use the same column ordering as the on-screen pivot.
 */

export interface XlsxExportOptions {
  months: MonthlyRow[];
  notes: Record<string, string>;
  meta: PivotMeta;
  filename?: string;
}

interface SheetColumn {
  header: string;
  accessor: (row: MonthlyRow) => string | number;
}

function buildPivotColumns(meta: PivotMeta): SheetColumn[] {
  const s1 = meta.stages[0]?.name ?? 'CV1';
  const s2 = meta.stages[1]?.name ?? 'CV2';
  const s3 = meta.stages[2]?.name ?? 'CV3';
  return [
    { header: 'month', accessor: (r) => r.month },
    { header: 'impressions', accessor: (r) => Math.round(r.impressions) },
    { header: 'clicks', accessor: (r) => Math.round(r.clicks) },
    { header: 'cpc', accessor: (r) => Math.round(r.cpc) },
    { header: 'ctr_pct', accessor: (r) => Number((r.ctr * 100).toFixed(2)) },
    { header: `cv1 (${s1})`, accessor: (r) => r.cv1 },
    { header: 'cvr1_pct', accessor: (r) => Number((r.cvr1 * 100).toFixed(2)) },
    { header: 'cpa1', accessor: (r) => Math.round(r.cpa1) },
    { header: `cv2 (${s2})`, accessor: (r) => r.cv2 },
    { header: 'cvr2_pct', accessor: (r) => Number((r.cvr2 * 100).toFixed(2)) },
    { header: 'cpa2', accessor: (r) => Math.round(r.cpa2) },
    { header: `cv3 (${s3})`, accessor: (r) => r.cv3 },
    { header: 'cvr3_pct', accessor: (r) => Number((r.cvr3 * 100).toFixed(2)) },
    { header: 'cpa3', accessor: (r) => Math.round(r.cpa3) },
    { header: 'spend', accessor: (r) => Math.round(r.spend) },
    {
      header: 'divergence_pct',
      accessor: (r) => Number((r.divergence * 100).toFixed(2)),
    },
  ];
}

// ---------------------------------------------------------------------------
// CSV fallback — preserves BOM so Excel opens it as UTF-8
// ---------------------------------------------------------------------------

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function pivotSheetCsv(
  months: MonthlyRow[],
  columns: SheetColumn[],
): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const rows = months.map((m) =>
    columns.map((c) => escapeCsv(c.accessor(m))).join(','),
  );
  return [header, ...rows].join('\n');
}

function notesSheetCsv(notes: Record<string, string>): string {
  const rows = Object.entries(notes).map(([m, t]) =>
    [escapeCsv(m), escapeCsv(t)].join(','),
  );
  return ['month,note', ...rows].join('\n');
}

function metaSheetCsv(meta: PivotMeta): string {
  const rows = meta.stages.map((s, i) =>
    [i + 1, escapeCsv(s.name), escapeCsv(s.eventName)].join(','),
  );
  return ['stage_index,stage_name,event_name', ...rows].join('\n');
}

function buildWorkbookBlob(opts: XlsxExportOptions): Blob {
  const cols = buildPivotColumns(opts.meta);
  const joined = [
    '# Sheet: Pivot',
    pivotSheetCsv(opts.months, cols),
    '',
    '# Sheet: Notes',
    notesSheetCsv(opts.notes),
    '',
    '# Sheet: Meta',
    metaSheetCsv(opts.meta),
  ].join('\n');
  // BOM keeps Excel happy with Japanese headers.
  return new Blob(['\uFEFF', joined], { type: 'text/csv;charset=utf-8;' });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Entry point — accepts the on-screen MonthlyRow window plus notes and meta,
 * produces a workbook, and triggers a browser download.
 */
export function exportMonthlyFunnelXlsx(opts: XlsxExportOptions): void {
  const blob = buildWorkbookBlob(opts);
  const date = new Date().toISOString().slice(0, 10);
  const name = opts.filename ?? 'monthly-funnel';
  // Filename deliberately still uses .csv until the real xlsx workbook lands
  // — this avoids misleading users into thinking they got a true XLSX.
  triggerDownload(blob, `${name}_${date}.csv`);
}
