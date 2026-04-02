/**
 * Report Export Service
 *
 * Generates CSV, HTML, and Excel (multi-sheet CSV) exports for reports.
 * CSV uses BOM for Japanese Excel compatibility.
 * HTML generates a self-contained document with inline CSS for print-to-PDF.
 */

import type {
  Report,
  ReportSummary,
  PlatformReport,
  CampaignReport,
} from './report-generator.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'html' | 'excel';

interface Branding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  contentType: string;
  data: string;
}

interface ExcelSheet {
  name: string;
  csv: string;
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

// BOM for Japanese Excel compatibility
const UTF8_BOM = '\uFEFF';

/**
 * Generate a CSV report with BOM for Japanese Excel compatibility.
 */
export function generateCsvReport(reportData: Report): ExportResult {
  const rows: string[][] = [];

  // Header info
  rows.push(['OMNI-AD レポート']);
  rows.push([`期間: ${reportData.period.start} ~ ${reportData.period.end}`]);
  rows.push([`生成日時: ${reportData.generatedAt}`]);
  rows.push([]);

  // KPI Summary
  rows.push(['--- サマリー ---']);
  rows.push([
    '指標',
    '値',
  ]);
  rows.push(['総支出 (円)', formatNumber(reportData.summary.totalSpend)]);
  rows.push(['総売上 (円)', formatNumber(reportData.summary.totalRevenue)]);
  rows.push(['ROAS', reportData.summary.overallRoas.toFixed(2)]);
  rows.push([
    'CTR',
    `${(reportData.summary.overallCtr * 100).toFixed(2)}%`,
  ]);
  rows.push(['CPC (円)', formatNumber(reportData.summary.overallCpc)]);
  rows.push(['CPA (円)', formatNumber(reportData.summary.overallCpa)]);
  rows.push([
    'インプレッション',
    formatNumber(reportData.summary.totalImpressions),
  ]);
  rows.push(['クリック', formatNumber(reportData.summary.totalClicks)]);
  rows.push([
    'コンバージョン',
    formatNumber(reportData.summary.totalConversions),
  ]);
  rows.push([]);

  // Platform Breakdown
  rows.push(['--- プラットフォーム別 ---']);
  rows.push([
    'プラットフォーム',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'CTR',
    'CPC (円)',
    'CPA (円)',
    'インプレッション',
    'クリック',
    'コンバージョン',
    '支出シェア',
  ]);

  for (const p of reportData.platformBreakdown) {
    rows.push([
      p.platform,
      formatNumber(p.spend),
      formatNumber(p.revenue),
      p.roas.toFixed(2),
      `${(p.ctr * 100).toFixed(2)}%`,
      formatNumber(p.cpc),
      formatNumber(p.cpa),
      formatNumber(p.impressions),
      formatNumber(p.clicks),
      formatNumber(p.conversions),
      `${(p.spendShare * 100).toFixed(1)}%`,
    ]);
  }

  rows.push([]);

  // Top Campaigns
  rows.push(['--- トップキャンペーン ---']);
  rows.push([
    'キャンペーン名',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'コンバージョン',
    'ステータス',
  ]);

  for (const c of reportData.topCampaigns) {
    rows.push([
      c.campaignName,
      formatNumber(c.spend),
      formatNumber(c.revenue),
      c.roas.toFixed(2),
      formatNumber(c.conversions),
      c.status,
    ]);
  }

  rows.push([]);

  // Bottom Campaigns
  rows.push(['--- 改善が必要なキャンペーン ---']);
  rows.push([
    'キャンペーン名',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'コンバージョン',
    'ステータス',
  ]);

  for (const c of reportData.bottomCampaigns) {
    rows.push([
      c.campaignName,
      formatNumber(c.spend),
      formatNumber(c.revenue),
      c.roas.toFixed(2),
      formatNumber(c.conversions),
      c.status,
    ]);
  }

  // AI recommendations
  if (reportData.recommendations.length > 0) {
    rows.push([]);
    rows.push(['--- AI推奨事項 ---']);
    for (const rec of reportData.recommendations) {
      rows.push([rec]);
    }
  }

  const csv = UTF8_BOM + rowsToCsv(rows);

  return {
    format: 'csv',
    filename: `report-${reportData.period.start}-${reportData.period.end}.csv`,
    contentType: 'text/csv; charset=utf-8',
    data: csv,
  };
}

// ---------------------------------------------------------------------------
// HTML Export
// ---------------------------------------------------------------------------

/**
 * Generate a styled HTML report document with inline CSS.
 * Suitable for printing to PDF via browser.
 */
export function generateHtmlReport(
  reportData: Report,
  branding: Branding = {},
): ExportResult {
  const primaryColor = branding.primaryColor ?? '#1a56db';
  const secondaryColor = branding.secondaryColor ?? '#f3f4f6';
  const companyName = branding.companyName ?? 'OMNI-AD';

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${companyName} - マーケティングレポート</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
    color: #1f2937;
    line-height: 1.6;
    padding: 40px;
    max-width: 1000px;
    margin: 0 auto;
    background: #fff;
  }
  @media print {
    body { padding: 20px; }
    .page-break { page-break-before: always; }
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid ${primaryColor};
    padding-bottom: 20px;
    margin-bottom: 30px;
  }
  .header h1 {
    color: ${primaryColor};
    font-size: 24px;
  }
  .header .meta {
    text-align: right;
    color: #6b7280;
    font-size: 14px;
  }
  .section {
    margin-bottom: 30px;
  }
  .section h2 {
    color: ${primaryColor};
    font-size: 18px;
    border-left: 4px solid ${primaryColor};
    padding-left: 12px;
    margin-bottom: 16px;
  }
  .executive-summary {
    background: ${secondaryColor};
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 30px;
    font-size: 14px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 30px;
  }
  .kpi-card {
    background: ${secondaryColor};
    padding: 16px;
    border-radius: 8px;
    text-align: center;
  }
  .kpi-card .value {
    font-size: 24px;
    font-weight: bold;
    color: ${primaryColor};
  }
  .kpi-card .label {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
  .kpi-card .change {
    font-size: 12px;
    margin-top: 4px;
  }
  .change-positive { color: #059669; }
  .change-negative { color: #dc2626; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 20px;
  }
  th {
    background: ${primaryColor};
    color: #fff;
    padding: 10px 8px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  tr:nth-child(even) { background: ${secondaryColor}; }
  .recommendations {
    list-style: none;
  }
  .recommendations li {
    padding: 12px 16px;
    margin-bottom: 8px;
    background: #eff6ff;
    border-left: 4px solid ${primaryColor};
    border-radius: 4px;
    font-size: 14px;
  }
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    color: #9ca3af;
    font-size: 12px;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(companyName)}" style="height:40px;margin-bottom:8px;">` : ''}
    <h1>${escapeHtml(companyName)} マーケティングレポート</h1>
  </div>
  <div class="meta">
    <div>期間: ${escapeHtml(reportData.period.start)} ~ ${escapeHtml(reportData.period.end)}</div>
    <div>レポート種別: ${escapeHtml(reportData.reportType)}</div>
    <div>生成日時: ${escapeHtml(new Date(reportData.generatedAt).toLocaleString('ja-JP'))}</div>
  </div>
</div>

${reportData.aiSummary ? `
<!-- Executive Summary -->
<div class="section">
  <h2>エグゼクティブサマリー</h2>
  <div class="executive-summary">
    ${escapeHtml(reportData.aiSummary)}
  </div>
</div>
` : ''}

<!-- KPI Cards -->
<div class="section">
  <h2>主要KPI</h2>
  <div class="kpi-grid">
    ${renderKpiCard('総支出', formatYen(reportData.summary.totalSpend), reportData.summary.spendChange)}
    ${renderKpiCard('総売上', formatYen(reportData.summary.totalRevenue), reportData.summary.revenueChange)}
    ${renderKpiCard('ROAS', reportData.summary.overallRoas.toFixed(2), reportData.summary.roasChange)}
    ${renderKpiCard('CTR', `${(reportData.summary.overallCtr * 100).toFixed(2)}%`)}
    ${renderKpiCard('CPC', formatYen(reportData.summary.overallCpc))}
    ${renderKpiCard('CPA', formatYen(reportData.summary.overallCpa))}
    ${renderKpiCard('インプレッション', formatNumber(reportData.summary.totalImpressions))}
    ${renderKpiCard('クリック', formatNumber(reportData.summary.totalClicks))}
    ${renderKpiCard('コンバージョン', formatNumber(reportData.summary.totalConversions))}
  </div>
</div>

<!-- Platform Breakdown -->
<div class="section">
  <h2>プラットフォーム別パフォーマンス</h2>
  ${renderPlatformTable(reportData.platformBreakdown)}
</div>

<div class="page-break"></div>

<!-- Top Campaigns -->
<div class="section">
  <h2>トップキャンペーン</h2>
  ${renderCampaignTable(reportData.topCampaigns)}
</div>

<!-- Bottom Campaigns -->
<div class="section">
  <h2>改善が必要なキャンペーン</h2>
  ${renderCampaignTable(reportData.bottomCampaigns)}
</div>

${reportData.recommendations.length > 0 ? `
<!-- Recommendations -->
<div class="section">
  <h2>AI推奨事項</h2>
  <ul class="recommendations">
    ${reportData.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join('\n    ')}
  </ul>
</div>
` : ''}

<!-- Footer -->
<div class="footer">
  ${escapeHtml(companyName)} | レポート生成日時: ${escapeHtml(new Date(reportData.generatedAt).toLocaleString('ja-JP'))} | Powered by OMNI-AD
</div>

</body>
</html>`;

  return {
    format: 'html',
    filename: `report-${reportData.period.start}-${reportData.period.end}.html`,
    contentType: 'text/html; charset=utf-8',
    data: html,
  };
}

// ---------------------------------------------------------------------------
// Excel Export (Multi-sheet CSV approach)
// ---------------------------------------------------------------------------

/**
 * Generate a multi-sheet Excel export using CSV-per-sheet approach.
 * Returns a combined format with sheet separators for v1.
 * Each sheet is a BOM-prefixed CSV that can be opened in Excel.
 */
export function generateExcelReport(reportData: Report): ExportResult {
  const sheets: ExcelSheet[] = [];

  // Sheet 1: Summary
  sheets.push({
    name: 'サマリー',
    csv: generateSummarySheet(reportData.summary, reportData),
  });

  // Sheet 2: Platform Breakdown
  sheets.push({
    name: 'プラットフォーム別',
    csv: generatePlatformSheet(reportData.platformBreakdown),
  });

  // Sheet 3: Campaign Detail
  sheets.push({
    name: 'キャンペーン詳細',
    csv: generateCampaignDetailSheet(
      reportData.topCampaigns,
      reportData.bottomCampaigns,
    ),
  });

  // Sheet 4: Daily Metrics placeholder
  // In v1, this generates a summary structure; actual daily data needs
  // a separate query or is included in the report data.
  sheets.push({
    name: '日次メトリクス',
    csv: generateDailyMetricsSheet(reportData),
  });

  // Combine all sheets separated by markers for v1
  // The primary sheet (summary) is returned as the main CSV
  const combined = sheets
    .map(
      (s) =>
        `${UTF8_BOM}--- Sheet: ${s.name} ---\n${s.csv}`,
    )
    .join('\n\n');

  return {
    format: 'excel',
    filename: `report-${reportData.period.start}-${reportData.period.end}.xlsx.csv`,
    contentType: 'text/csv; charset=utf-8',
    data: combined,
  };
}

// ---------------------------------------------------------------------------
// Excel Sheet Generators
// ---------------------------------------------------------------------------

function generateSummarySheet(
  summary: ReportSummary,
  reportData: Report,
): string {
  const rows: string[][] = [];

  rows.push(['OMNI-AD レポート サマリー']);
  rows.push([
    `期間: ${reportData.period.start} ~ ${reportData.period.end}`,
  ]);
  rows.push([]);
  rows.push(['指標', '値', '前期比 (%)']);
  rows.push([
    '総支出 (円)',
    formatNumber(summary.totalSpend),
    `${summary.spendChange.toFixed(1)}%`,
  ]);
  rows.push([
    '総売上 (円)',
    formatNumber(summary.totalRevenue),
    `${summary.revenueChange.toFixed(1)}%`,
  ]);
  rows.push([
    'ROAS',
    summary.overallRoas.toFixed(2),
    `${summary.roasChange.toFixed(1)}%`,
  ]);
  rows.push([
    'CTR',
    `${(summary.overallCtr * 100).toFixed(2)}%`,
    '',
  ]);
  rows.push(['CPC (円)', formatNumber(summary.overallCpc), '']);
  rows.push(['CPA (円)', formatNumber(summary.overallCpa), '']);
  rows.push([
    'インプレッション',
    formatNumber(summary.totalImpressions),
    '',
  ]);
  rows.push(['クリック', formatNumber(summary.totalClicks), '']);
  rows.push([
    'コンバージョン',
    formatNumber(summary.totalConversions),
    '',
  ]);
  rows.push([
    'アクティブキャンペーン数',
    String(summary.activeCampaigns),
    '',
  ]);

  // Budget efficiency
  rows.push([]);
  rows.push(['--- 予算効率 ---']);
  rows.push([
    '総予算 (円)',
    formatNumber(reportData.budgetEfficiency.totalBudget),
    '',
  ]);
  rows.push([
    '実支出 (円)',
    formatNumber(reportData.budgetEfficiency.actualSpend),
    '',
  ]);
  rows.push([
    '利用率',
    `${(reportData.budgetEfficiency.utilizationRate * 100).toFixed(1)}%`,
    '',
  ]);
  rows.push([
    '無駄な支出 (円)',
    formatNumber(reportData.budgetEfficiency.wastedSpend),
    '',
  ]);

  return rowsToCsv(rows);
}

function generatePlatformSheet(platforms: PlatformReport[]): string {
  const rows: string[][] = [];

  rows.push([
    'プラットフォーム',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'CTR',
    'CPC (円)',
    'CPA (円)',
    'インプレッション',
    'クリック',
    'コンバージョン',
    '支出シェア',
    '売上シェア',
  ]);

  for (const p of platforms) {
    rows.push([
      p.platform,
      formatNumber(p.spend),
      formatNumber(p.revenue),
      p.roas.toFixed(2),
      `${(p.ctr * 100).toFixed(2)}%`,
      formatNumber(p.cpc),
      formatNumber(p.cpa),
      formatNumber(p.impressions),
      formatNumber(p.clicks),
      formatNumber(p.conversions),
      `${(p.spendShare * 100).toFixed(1)}%`,
      `${(p.revenueShare * 100).toFixed(1)}%`,
    ]);
  }

  return rowsToCsv(rows);
}

function generateCampaignDetailSheet(
  topCampaigns: CampaignReport[],
  bottomCampaigns: CampaignReport[],
): string {
  const rows: string[][] = [];

  rows.push(['--- トップキャンペーン ---']);
  rows.push([
    'キャンペーン名',
    'キャンペーンID',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'CTR',
    'コンバージョン',
    'ステータス',
  ]);

  for (const c of topCampaigns) {
    rows.push([
      c.campaignName,
      c.campaignId,
      formatNumber(c.spend),
      formatNumber(c.revenue),
      c.roas.toFixed(2),
      `${(c.ctr * 100).toFixed(2)}%`,
      formatNumber(c.conversions),
      c.status,
    ]);
  }

  rows.push([]);
  rows.push(['--- 改善が必要なキャンペーン ---']);
  rows.push([
    'キャンペーン名',
    'キャンペーンID',
    '支出 (円)',
    '売上 (円)',
    'ROAS',
    'CTR',
    'コンバージョン',
    'ステータス',
  ]);

  for (const c of bottomCampaigns) {
    rows.push([
      c.campaignName,
      c.campaignId,
      formatNumber(c.spend),
      formatNumber(c.revenue),
      c.roas.toFixed(2),
      `${(c.ctr * 100).toFixed(2)}%`,
      formatNumber(c.conversions),
      c.status,
    ]);
  }

  return rowsToCsv(rows);
}

function generateDailyMetricsSheet(reportData: Report): string {
  const rows: string[][] = [];

  rows.push([
    `日次メトリクス概要 (${reportData.period.start} ~ ${reportData.period.end})`,
  ]);
  rows.push([]);
  rows.push([
    '注: 日次の詳細データは個別のメトリクス照会で取得可能です。',
  ]);
  rows.push([]);
  rows.push(['全体集計']);
  rows.push([
    '指標',
    '合計値',
    '日平均',
  ]);

  const periodStart = new Date(reportData.period.start);
  const periodEnd = new Date(reportData.period.end);
  const days = Math.max(
    1,
    Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / 86_400_000,
    ) + 1,
  );

  rows.push([
    '支出 (円)',
    formatNumber(reportData.summary.totalSpend),
    formatNumber(reportData.summary.totalSpend / days),
  ]);
  rows.push([
    '売上 (円)',
    formatNumber(reportData.summary.totalRevenue),
    formatNumber(reportData.summary.totalRevenue / days),
  ]);
  rows.push([
    'インプレッション',
    formatNumber(reportData.summary.totalImpressions),
    formatNumber(Math.round(reportData.summary.totalImpressions / days)),
  ]);
  rows.push([
    'クリック',
    formatNumber(reportData.summary.totalClicks),
    formatNumber(Math.round(reportData.summary.totalClicks / days)),
  ]);
  rows.push([
    'コンバージョン',
    formatNumber(reportData.summary.totalConversions),
    formatNumber(
      Math.round(reportData.summary.totalConversions / days),
    ),
  ]);

  return rowsToCsv(rows);
}

// ---------------------------------------------------------------------------
// HTML Helpers
// ---------------------------------------------------------------------------

function renderKpiCard(
  label: string,
  value: string,
  change?: number,
): string {
  const changeHtml =
    change !== undefined
      ? `<div class="change ${change >= 0 ? 'change-positive' : 'change-negative'}">${change >= 0 ? '+' : ''}${change.toFixed(1)}%</div>`
      : '';

  return `<div class="kpi-card">
      <div class="value">${escapeHtml(value)}</div>
      <div class="label">${escapeHtml(label)}</div>
      ${changeHtml}
    </div>`;
}

function renderPlatformTable(platforms: PlatformReport[]): string {
  if (platforms.length === 0) {
    return '<p>データなし</p>';
  }

  const headerRow = `<tr>
    <th>プラットフォーム</th>
    <th>支出</th>
    <th>売上</th>
    <th>ROAS</th>
    <th>CTR</th>
    <th>CPC</th>
    <th>コンバージョン</th>
    <th>支出シェア</th>
  </tr>`;

  const bodyRows = platforms
    .map(
      (p) => `<tr>
    <td>${escapeHtml(p.platform)}</td>
    <td>${formatYen(p.spend)}</td>
    <td>${formatYen(p.revenue)}</td>
    <td>${p.roas.toFixed(2)}</td>
    <td>${(p.ctr * 100).toFixed(2)}%</td>
    <td>${formatYen(p.cpc)}</td>
    <td>${formatNumber(p.conversions)}</td>
    <td>${(p.spendShare * 100).toFixed(1)}%</td>
  </tr>`,
    )
    .join('\n');

  return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
}

function renderCampaignTable(campaignsList: CampaignReport[]): string {
  if (campaignsList.length === 0) {
    return '<p>データなし</p>';
  }

  const headerRow = `<tr>
    <th>キャンペーン名</th>
    <th>支出</th>
    <th>売上</th>
    <th>ROAS</th>
    <th>コンバージョン</th>
    <th>ステータス</th>
  </tr>`;

  const bodyRows = campaignsList
    .map(
      (c) => `<tr>
    <td>${escapeHtml(c.campaignName)}</td>
    <td>${formatYen(c.spend)}</td>
    <td>${formatYen(c.revenue)}</td>
    <td>${c.roas.toFixed(2)}</td>
    <td>${formatNumber(c.conversions)}</td>
    <td>${escapeHtml(c.status)}</td>
  </tr>`,
    )
    .join('\n');

  return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsvField(field: string): string {
  if (
    field.includes(',') ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map(escapeCsvField).join(','))
    .join('\n');
}

function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

function formatYen(value: number): string {
  return `${value.toLocaleString('ja-JP')}円`;
}
