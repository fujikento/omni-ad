'use client';

import { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  ScrollText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';

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

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  performance: 'パフォーマンス',
  budget: '予算',
  attribution: 'アトリビューション',
  audience: 'オーディエンス',
  creative: 'クリエイティブ',
  funnel: 'ファネル',
  executive_summary: 'エグゼクティブサマリー',
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; className: string }> = {
  ready: { label: '完了', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  generating: { label: '生成中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  scheduled: { label: '予約済', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  failed: { label: 'エラー', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: '日次',
  weekly: '週次',
  biweekly: '隔週',
  monthly: '月次',
};

const MOCK_REPORTS: Report[] = [
  {
    id: '1', type: 'performance', title: '3月パフォーマンスレポート',
    dateRange: '2026/03/01 - 2026/03/31', status: 'ready', createdAt: '2026-04-01T09:00:00Z',
    format: 'PDF',
    insights: ['Google広告のROASが前月比15%改善', 'TikTok広告のCTRが業界平均を上回る', 'Meta広告のCPAが10%減少'],
  },
  {
    id: '2', type: 'executive_summary', title: 'Q1エグゼクティブサマリー',
    dateRange: '2026/01/01 - 2026/03/31', status: 'ready', createdAt: '2026-04-01T10:00:00Z',
    format: 'PDF',
    insights: ['四半期売上目標達成率: 112%', 'クロスチャネルROAS: 3.2x (前期比+18%)', 'AIクリエイティブが手動作成より25%高いCTR'],
  },
  {
    id: '3', type: 'budget', title: '3月予算レポート',
    dateRange: '2026/03/01 - 2026/03/31', status: 'ready', createdAt: '2026-03-31T18:00:00Z',
    format: 'XLSX',
    insights: ['予算消化率: 94%', 'Google広告の予算効率が最も高い', '未消化予算: 32,000円'],
  },
  {
    id: '4', type: 'attribution', title: 'アトリビューション分析',
    dateRange: '2026/03/15 - 2026/03/31', status: 'generating', createdAt: '2026-04-02T06:00:00Z',
    format: 'PDF', insights: [],
  },
  {
    id: '5', type: 'creative', title: 'クリエイティブパフォーマンス',
    dateRange: '2026/03/01 - 2026/03/31', status: 'scheduled', createdAt: '2026-04-02T00:00:00Z',
    format: 'PDF', insights: [],
  },
];

const MOCK_SCHEDULES: ScheduleConfig[] = [
  { type: 'performance', frequency: 'weekly', recipients: ['marketing@example.com'] },
  { type: 'executive_summary', frequency: 'monthly', recipients: ['ceo@example.com', 'cmo@example.com'] },
];

// -- Subcomponents --

function StatusBadge({ status }: { status: ReportStatus }): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {status === 'generating' && <Loader2 size={10} className="mr-1 animate-spin" />}
      {config.label}
    </span>
  );
}

interface ReportPreviewProps {
  report: Report;
  onClose: () => void;
}

function ReportPreview({ report, onClose }: ReportPreviewProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{report.title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">レポートタイプ</p>
              <p className="text-sm font-medium text-foreground">{REPORT_TYPE_LABELS[report.type]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">期間</p>
              <p className="text-sm text-foreground">{report.dateRange}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">フォーマット</p>
              <p className="text-sm text-foreground">{report.format}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ステータス</p>
              <StatusBadge status={report.status} />
            </div>
          </div>

          {report.insights.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">AIインサイト</p>
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download size={16} />
              ダウンロード ({report.format})
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
          <h2 className="text-lg font-semibold text-foreground">レポート生成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="report-type" className="mb-1 block text-sm font-medium text-foreground">レポートタイプ</label>
            <div className="relative">
              <select
                id="report-type"
                value={reportType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportType(e.target.value as ReportType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">生成頻度</span>
            <div className="flex gap-2">
              {([
                { value: 'once', label: '一回のみ' },
                { value: 'daily', label: '日次' },
                { value: 'weekly', label: '週次' },
                { value: 'monthly', label: '月次' },
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
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-start" className="mb-1 block text-sm font-medium text-foreground">開始日</label>
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
              <label htmlFor="report-end" className="mb-1 block text-sm font-medium text-foreground">終了日</label>
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
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isGenerating || !startDate || !endDate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              生成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page --

export default function ReportsPage(): React.ReactElement {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  const reportsQuery = trpc.reports.list.useQuery(undefined, { retry: false });

  const reports = reportsQuery.error ? MOCK_REPORTS : (reportsQuery.data as Report[] | undefined) ?? MOCK_REPORTS;
  const isLoading = reportsQuery.isLoading && !reportsQuery.error;

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">自動レポート</h1>
          <p className="mt-1 text-sm text-muted-foreground">AIによるレポート自動生成とスケジュール配信</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            data={reports}
            columns={[
              { key: 'title' as const, label: 'タイトル' },
              { key: 'type' as const, label: 'タイプ', format: (v: Report[keyof Report]) => REPORT_TYPE_LABELS[v as ReportType] ?? String(v) },
              { key: 'dateRange' as const, label: '期間' },
              { key: 'status' as const, label: 'ステータス', format: (v: Report[keyof Report]) => STATUS_CONFIG[v as ReportStatus]?.label ?? String(v) },
              { key: 'format' as const, label: 'フォーマット' },
            ]}
            filename="reports"
          />
          <button
            type="button"
            onClick={() => setGenerateOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Plus size={16} />
            レポート生成
          </button>
        </div>
      </div>

      {/* Report list table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">タイトル</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">タイプ</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">期間</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ステータス</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">作成日</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">操作</th>
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
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ScrollText size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">レポートがまだありません</p>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{report.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{REPORT_TYPE_LABELS[report.type]}</td>
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
                          プレビュー
                        </button>
                        {report.status === 'ready' && (
                          <button
                            type="button"
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title="ダウンロード"
                            aria-label={`${report.title}をダウンロード`}
                          >
                            <Download size={14} />
                          </button>
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
          <h2 className="text-lg font-semibold text-foreground">スケジュール設定</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">定期的に自動生成されるレポートの設定</p>
        <div className="mt-4 space-y-3">
          {MOCK_SCHEDULES.map((schedule) => (
            <div key={`${schedule.type}-${schedule.frequency}`} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{REPORT_TYPE_LABELS[schedule.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCY_LABELS[schedule.frequency]} | {schedule.recipients.join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                編集
              </button>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus size={14} />
            スケジュールを追加
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {previewReport && (
        <ReportPreview report={previewReport} onClose={() => setPreviewReport(null)} />
      )}

      {/* Generate modal */}
      <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  );
}
