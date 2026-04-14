'use client';

import { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Printer,
  ScrollText,
  X,
} from 'lucide-react';
import { Badge, Button, EmptyState, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

// -- Types --

type ReportType = 'performance' | 'budget' | 'attribution' | 'audience' | 'creative' | 'funnel' | 'executive_summary';
type ReportStatus = 'ready' | 'generating' | 'scheduled' | 'failed';
type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface Report {
  id: string;
  type: ReportType;
  title: string;
  dateRange: string;
  status: ReportStatus;
  createdAt: string;
  format: string;
  insights: string[];
}

interface ScheduleConfig {
  type: ReportType;
  frequency: Frequency;
  recipients: string[];
}

// -- Constants --

const REPORT_TYPE_LABEL_KEYS: Record<ReportType, string> = {
  performance: 'reports.type.performance',
  budget: 'reports.type.budget',
  attribution: 'reports.type.attribution',
  audience: 'reports.type.audience',
  creative: 'reports.type.creative',
  funnel: 'reports.type.funnel',
  executive_summary: 'reports.type.executiveSummary',
};

type StatusVariant = 'success' | 'info' | 'primary' | 'destructive';

const STATUS_CONFIG: Record<ReportStatus, { labelKey: string; variant: StatusVariant }> = {
  ready: { labelKey: 'reports.status.ready', variant: 'success' },
  generating: { labelKey: 'reports.status.generating', variant: 'info' },
  scheduled: { labelKey: 'reports.status.scheduled', variant: 'primary' },
  failed: { labelKey: 'reports.status.failed', variant: 'destructive' },
};

const FREQUENCY_LABEL_KEYS: Record<Frequency, string> = {
  daily: 'reports.frequency.daily',
  weekly: 'reports.frequency.weekly',
  biweekly: 'reports.frequency.biweekly',
  monthly: 'reports.frequency.monthly',
};

function getMockReports(t: (key: string, params?: Record<string, string | number>) => string): Report[] {
  return [
  {
    id: '1', type: 'performance', title: t('reports.hd62085'),
    dateRange: '2026/03/01 - 2026/03/31', status: 'ready', createdAt: '2026-04-01T09:00:00Z',
    format: 'PDF',
    insights: [t('reports.h3bd087'), t('reports.hecd2d1'), t('reports.hef87b1')],
  },
  {
    id: '2', type: 'executive_summary', title: t('reports.h623532'),
    dateRange: '2026/01/01 - 2026/03/31', status: 'ready', createdAt: '2026-04-01T10:00:00Z',
    format: 'PDF',
    insights: [t('reports.h7b96d8'), t('reports.hd8ad39'), t('reports.h05bd03')],
  },
  {
    id: '3', type: 'budget', title: t('reports.h58d3bf'),
    dateRange: '2026/03/01 - 2026/03/31', status: 'ready', createdAt: '2026-03-31T18:00:00Z',
    format: 'XLSX',
    insights: [t('reports.h35d33c'), t('reports.h8eec82'), t('reports.h68a005')],
  },
  {
    id: '4', type: 'attribution', title: t('reports.h286062'),
    dateRange: '2026/03/15 - 2026/03/31', status: 'generating', createdAt: '2026-04-02T06:00:00Z',
    format: 'PDF', insights: [],
  },
  {
    id: '5', type: 'creative', title: t('reports.hfcfd3d'),
    dateRange: '2026/03/01 - 2026/03/31', status: 'scheduled', createdAt: '2026-04-02T00:00:00Z',
    format: 'PDF', insights: [],
  },
];
}

const MOCK_SCHEDULES: ScheduleConfig[] = [
  { type: 'performance', frequency: 'weekly', recipients: ['marketing@example.com'] },
  { type: 'executive_summary', frequency: 'monthly', recipients: ['ceo@example.com', 'cmo@example.com'] },
];

// -- Subcomponents --

function StatusBadge({ status }: { status: ReportStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} size="md" dot={status === 'ready'}>
      {status === 'generating' && <Loader2 size={10} className="mr-1 animate-spin" />}
      {t(config.labelKey)}
    </Badge>
  );
}

interface ReportPreviewProps {
  report: Report;
  onClose: () => void;
}

function ReportPreview({ report, onClose }: ReportPreviewProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{report.title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.reportType')}</p>
              <p className="text-sm font-medium text-foreground">{t(REPORT_TYPE_LABEL_KEYS[report.type])}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.period')}</p>
              <p className="text-sm text-foreground">{report.dateRange}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.format')}</p>
              <p className="text-sm text-foreground">{report.format}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('common.status')}</p>
              <StatusBadge status={report.status} />
            </div>
          </div>

          {report.insights.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">{t('reports.aiInsights')}</p>
              <div className="space-y-2">
                {report.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-md bg-primary/5 p-3">
                    <span className="mt-0.5 text-xs font-bold text-primary">{idx + 1}</span>
                    <p className="text-sm text-foreground">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.status === 'ready' && (
            <button
              type="button"
              onClick={() => {
                if (report.format === 'PDF') {
                  handleExportHTML(report);
                } else {
                  handleExportCSV(report);
                }
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download size={16} />
              {t('reports.download')} ({report.format})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
}

function GenerateModal({ open, onClose }: GenerateModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [reportType, setReportType] = useState<ReportType>('performance');
  const [frequency, setFrequency] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  function handleGenerate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      onClose();
    }, 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('reports.generateModal.title')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="report-type" className="mb-1 block text-sm font-medium text-foreground">{t('reports.reportType')}</label>
            <div className="relative">
              <select
                id="report-type"
                value={reportType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportType(e.target.value as ReportType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(REPORT_TYPE_LABEL_KEYS) as [ReportType, string][]).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('reports.generateModal.frequency')}</span>
            <div className="flex gap-2">
              {([
                { value: 'once', labelKey: 'reports.generateModal.once' },
                { value: 'daily', labelKey: 'reports.generateModal.daily' },
                { value: 'weekly', labelKey: 'reports.generateModal.weekly' },
                { value: 'monthly', labelKey: 'reports.generateModal.monthly' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFrequency(option.value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    frequency === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-start" className="mb-1 block text-sm font-medium text-foreground">{t('reports.generateModal.startDate')}</label>
              <input
                id="report-start"
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="report-end" className="mb-1 block text-sm font-medium text-foreground">{t('reports.generateModal.endDate')}</label>
              <input
                id="report-end"
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isGenerating || !startDate || !endDate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {t('reports.generateModal.generate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Export helpers --

function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Static labels for CSV/HTML exports (these run outside React context)
const REPORT_TYPE_EXPORT_LABELS: Record<ReportType, string> = {
  performance: 'Performance', budget: 'Budget', attribution: 'Attribution',
  audience: 'Audience', creative: 'Creative', funnel: 'Funnel', executive_summary: 'Executive Summary',
};

const STATUS_EXPORT_LABELS: Record<ReportStatus, string> = {
  ready: 'Ready', generating: 'Generating', scheduled: 'Scheduled', failed: 'Error',
};

function generateReportCSV(report: Report): string {
  const header = ['Item', 'Value'].map(escapeCSVValue).join(',');
  const rows = [
    ['Title', report.title],
    ['Type', REPORT_TYPE_EXPORT_LABELS[report.type]],
    ['Period', report.dateRange],
    ['Status', STATUS_EXPORT_LABELS[report.status]],
    ['Format', report.format],
    ...report.insights.map((insight, idx) => [`Insight ${idx + 1}`, insight]),
  ].map((row) => row.map(escapeCSVValue).join(','));
  return '\uFEFF' + [header, ...rows].join('\n');
}

function generateReportHTML(report: Report): string {
  const insightsHtml = report.insights.length > 0
    ? `<div style="margin-top:24px;">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">AI Insights</h2>
        <ol style="padding-left:20px;">
          ${report.insights.map((i) => `<li style="margin-bottom:8px;">${i}</li>`).join('')}
        </ol>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${report.title} - OMNI-AD</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
    h1 { font-size: 24px; font-weight: 700; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
    .meta-item { background: #f8fafc; padding: 12px 16px; border-radius: 8px; }
    .meta-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .meta-value { font-size: 14px; font-weight: 500; margin-top: 4px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Report Type</div><div class="meta-value">${REPORT_TYPE_EXPORT_LABELS[report.type]}</div></div>
    <div class="meta-item"><div class="meta-label">Period</div><div class="meta-value">${report.dateRange}</div></div>
    <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${STATUS_EXPORT_LABELS[report.status]}</div></div>
    <div class="meta-item"><div class="meta-label">Generated</div><div class="meta-value">${new Intl.DateTimeFormat('ja-JP').format(new Date(report.createdAt))}</div></div>
  </div>
  ${insightsHtml}
  <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
    OMNI-AD Auto Report
  </footer>
</body>
</html>`;
}

function handleExportCSV(report: Report): void {
  const csv = generateReportCSV(report);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `${report.title}_${dateSuffix}.csv`, 'text/csv;charset=utf-8;');
}

function handleExportExcel(report: Report): void {
  // Stub: in production, use a proper XLSX library
  const csv = generateReportCSV(report);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadBlob(csv, `${report.title}_${dateSuffix}.csv`, 'text/csv;charset=utf-8;');
}

function handleExportHTML(report: Report): void {
  const html = generateReportHTML(report);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// -- Inline Report Preview Modal --

interface InlineReportPreviewProps {
  report: Report;
  onClose: () => void;
}

function InlineReportPreview({ report, onClose }: InlineReportPreviewProps): React.ReactElement {
  const { t } = useI18n();
  const html = generateReportHTML(report);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('reports.reportPreview')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportHTML(report)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ExternalLink size={14} />
              {t('reports.openNewTab')}
            </button>
            <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-white p-0">
          <iframe
            srcDoc={html}
            className="h-full w-full border-0"
            title={`${report.title} - ${t('reports.preview')}`}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

// -- Main Page --

export default function ReportsPage(): React.ReactElement {
  const { t } = useI18n();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [inlinePreviewReport, setInlinePreviewReport] = useState<Report | null>(null);

  const reportsQuery = trpc.reports.list.useQuery(undefined, { retry: false });

  const reports = reportsQuery.error ? getMockReports(t) : (reportsQuery.data as Report[] | undefined) ?? getMockReports(t);
  const isLoading = reportsQuery.isLoading && !reportsQuery.error;

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('reports.title')}
        description={t('reports.description')}
        actions={
          <>
            <ExportButton
              data={reports}
              columns={[
                { key: 'title' as const, label: t('reports.table.title') },
                { key: 'type' as const, label: t('reports.table.type'), format: (v: Report[keyof Report]) => t(REPORT_TYPE_LABEL_KEYS[v as ReportType] ?? '') || String(v) },
                { key: 'dateRange' as const, label: t('reports.table.period') },
                { key: 'status' as const, label: t('reports.table.status'), format: (v: Report[keyof Report]) => t(STATUS_CONFIG[v as ReportStatus]?.labelKey ?? '') || String(v) },
                { key: 'format' as const, label: t('reports.format') },
              ]}
              filename="reports"
            />
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setGenerateOpen(true)}
            >
              {t('reports.generateReport')}
            </Button>
          </>
        }
      />

      {/* Report list table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.title')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.type')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.period')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.status')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.createdAt')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('reports.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <tr key={i} className="animate-pulse border-b border-border">
                    {Array.from({ length: 6 }, (__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon={<ScrollText size={18} />}
                      title={t('reports.noReports')}
                      className="border-0 bg-transparent"
                    />
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{report.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t(REPORT_TYPE_LABEL_KEYS[report.type])}</td>
                    <td className="px-4 py-3 text-muted-foreground">{report.dateRange}</td>
                    <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(report.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewReport(report)}
                          className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          {t('reports.preview')}
                        </button>
                        {report.status === 'ready' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleExportCSV(report)}
                              className="rounded px-1.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                              title={t('reports.h9846f6')}
                              aria-label={t('reports.ariaDownloadCsv', { title: report.title })}
                            >
                              <span className="flex items-center gap-1">
                                <FileText size={12} />
                                CSV
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportExcel(report)}
                              className="rounded px-1.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              title={t('reports.h8156a0')}
                              aria-label={t('reports.ariaDownloadExcel', { title: report.title })}
                            >
                              <span className="flex items-center gap-1">
                                <FileSpreadsheet size={12} />
                                Excel
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlinePreviewReport(report)}
                              className="rounded px-1.5 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                              title={t('reports.he569d7')}
                              aria-label={t('reports.ariaOpenHtml', { title: report.title })}
                            >
                              <span className="flex items-center gap-1">
                                <Printer size={12} />
                                HTML
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule settings */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('reports.schedule.title')}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('reports.schedule.description')}</p>
        <div className="mt-4 space-y-3">
          {MOCK_SCHEDULES.map((schedule) => (
            <div key={`${schedule.type}-${schedule.frequency}`} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t(REPORT_TYPE_LABEL_KEYS[schedule.type])}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(FREQUENCY_LABEL_KEYS[schedule.frequency])} | {schedule.recipients.join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => showToast(t('reports.schedule.editPreparing'))}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t('common.edit')}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => showToast(t('reports.schedule.addPreparing'))}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus size={14} />
            {t('reports.schedule.add')}
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {previewReport && (
        <ReportPreview report={previewReport} onClose={() => setPreviewReport(null)} />
      )}

      {/* Generate modal */}
      <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} />

      {/* Inline report preview modal */}
      {inlinePreviewReport && (
        <InlineReportPreview
          report={inlinePreviewReport}
          onClose={() => setInlinePreviewReport(null)}
        />
      )}
    </div>
  );
}
