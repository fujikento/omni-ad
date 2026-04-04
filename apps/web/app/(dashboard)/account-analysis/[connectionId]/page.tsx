'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Info,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type CampaignStatus = 'active' | 'paused' | 'completed';
type CampaignObjective = 'conversions' | 'traffic' | 'awareness' | 'engagement';
type SuggestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type RiskSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
type SortKey = 'name' | 'status' | 'objective' | 'dailyBudget' | 'spend30d' | 'roas' | 'ctr' | 'impressions';
type SortDirection = 'asc' | 'desc';

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  objective: CampaignObjective;
  dailyBudget: number;
  spend30d: number;
  roas: number;
  ctr: number;
  impressions: number;
}

interface DailySpend {
  date: string;
  spend: number;
}

interface WeekdayAverage {
  day: string;
  average: number;
}

interface Performer {
  campaignName: string;
  roas: number;
  reason: string;
}

interface Opportunity {
  text: string;
}

interface Suggestion {
  id: string;
  priority: SuggestionPriority;
  title: string;
  description: string;
  estimatedImpact: string;
}

interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedCampaigns: string[];
}

interface AccountAnalysisData {
  platformLabel: string;
  platformIcon: string;
  accountName: string;
  overallScore: number;
  analysisDate: string;
  aiSummary: string;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend30d: number;
  averageRoas: number;
  averageCtr: number;
  campaigns: Campaign[];
  dailySpend: DailySpend[];
  weekdayAverage: WeekdayAverage[];
  peakDay: string;
  lowDay: string;
  topPerformers: Performer[];
  underPerformers: Performer[];
  opportunities: Opportunity[];
  suggestions: Suggestion[];
  risks: Risk[];
}

// ============================================================
// Constants & Mock Data
// ============================================================

const STATUS_CONFIG: Record<CampaignStatus, { labelKey: string; className: string }> = {
  active: { labelKey: 'accountAnalysis.statusActive', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  paused: { labelKey: 'accountAnalysis.statusPaused', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { labelKey: 'accountAnalysis.statusCompleted', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

const OBJECTIVE_LABEL_KEYS: Record<CampaignObjective, string> = {
  conversions: 'accountAnalysis.objectiveConversions',
  traffic: 'accountAnalysis.objectiveTraffic',
  awareness: 'accountAnalysis.objectiveAwareness',
  engagement: 'accountAnalysis.objectiveEngagement',
};

const PRIORITY_CONFIG: Record<SuggestionPriority, { borderClass: string; icon: React.ReactNode; bgClass: string }> = {
  HIGH: {
    borderClass: 'border-l-red-500',
    icon: <AlertTriangle size={16} className="text-red-500" />,
    bgClass: 'bg-red-50 dark:bg-red-950/20',
  },
  MEDIUM: {
    borderClass: 'border-l-yellow-500',
    icon: <Info size={16} className="text-yellow-500" />,
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/20',
  },
  LOW: {
    borderClass: 'border-l-blue-500',
    icon: <Lightbulb size={16} className="text-blue-500" />,
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
  },
};

const SEVERITY_CONFIG: Record<RiskSeverity, { bgClass: string; textClass: string; borderClass: string }> = {
  CRITICAL: {
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    textClass: 'text-red-700 dark:text-red-400',
    borderClass: 'border-red-200 dark:border-red-800',
  },
  WARNING: {
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
    textClass: 'text-yellow-700 dark:text-yellow-400',
    borderClass: 'border-yellow-200 dark:border-yellow-800',
  },
  INFO: {
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
};

function generateDailySpend(): DailySpend[] {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(2026, 2, 4 + i);
    const dayOfWeek = date.getDay();
    const baseSpend = 85000 + Math.sin(i / 4) * 15000;
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1;
    return {
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      spend: Math.round(baseSpend * weekendFactor + (Math.random() - 0.5) * 10000),
    };
  });
}

function generateWeekdayAverage(): WeekdayAverage[] {
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  const averages = [92000, 95000, 98000, 96000, 88000, 62000, 58000];
  return days.map((day, i) => ({ day, average: averages[i] ?? 0 }));
}

const MOCK_DATA: AccountAnalysisData = {
  platformLabel: 'Google Ads',
  platformIcon: 'G',
  accountName: 'OMNI-AD Google',
  overallScore: 62,
  analysisDate: '2026-04-03 09:30',
  aiSummary: 'Google Adsアカウント全体の運用効率は中程度です。特に「春のプロモーション2026」と「ブランド認知」キャンペーンが高いROASを維持しており、アカウント全体の収益性を支えています。しかし、「新規顧客獲得」キャンペーンと「ディスプレイ広告テスト」キャンペーンのパフォーマンスが著しく低下しており、これらが全体スコアを押し下げています。\n\n予算配分に関しては、パフォーマンスの低いキャンペーンに過度な予算が割り当てられている傾向が見られます。ROASが1.0を下回るキャンペーンへの支出を30%削減し、上位パフォーマーへ再配分することで、全体ROASを0.5ポイント改善できる見込みです。また、週末の支出効率が平日と比較して40%低いため、曜日別の予算調整も推奨します。',
  totalCampaigns: 8,
  activeCampaigns: 5,
  totalSpend30d: 2450000,
  averageRoas: 2.8,
  averageCtr: 3.2,
  campaigns: [
    { id: 'c1', name: '春のプロモーション2026', status: 'active', objective: 'conversions', dailyBudget: 50000, spend30d: 680000, roas: 4.5, ctr: 4.2, impressions: 250000 },
    { id: 'c2', name: 'ブランド認知 - Google', status: 'active', objective: 'awareness', dailyBudget: 30000, spend30d: 420000, roas: 3.8, ctr: 2.8, impressions: 520000 },
    { id: 'c3', name: 'リターゲティング', status: 'active', objective: 'conversions', dailyBudget: 25000, spend30d: 350000, roas: 3.2, ctr: 5.1, impressions: 180000 },
    { id: 'c4', name: 'ショッピング広告', status: 'active', objective: 'conversions', dailyBudget: 35000, spend30d: 480000, roas: 2.4, ctr: 3.5, impressions: 310000 },
    { id: 'c5', name: '動画キャンペーン', status: 'paused', objective: 'engagement', dailyBudget: 20000, spend30d: 180000, roas: 1.8, ctr: 1.2, impressions: 420000 },
    { id: 'c6', name: '新規顧客獲得', status: 'active', objective: 'traffic', dailyBudget: 15000, spend30d: 210000, roas: 0.8, ctr: 2.1, impressions: 150000 },
    { id: 'c7', name: 'ディスプレイ広告テスト', status: 'paused', objective: 'awareness', dailyBudget: 10000, spend30d: 85000, roas: 0.5, ctr: 0.4, impressions: 380000 },
    { id: 'c8', name: '季節キャンペーン（終了）', status: 'completed', objective: 'conversions', dailyBudget: 0, spend30d: 45000, roas: 2.1, ctr: 3.8, impressions: 95000 },
  ],
  dailySpend: generateDailySpend(),
  weekdayAverage: generateWeekdayAverage(),
  peakDay: '水曜日',
  lowDay: '日曜日',
  topPerformers: [
    { campaignName: '春のプロモーション2026', roas: 4.5, reason: '季節需要と高精度ターゲティングにより高いコンバージョン率を維持' },
    { campaignName: 'ブランド認知 - Google', roas: 3.8, reason: '適切なオーディエンス設定と効果的なクリエイティブにより認知施策としては優秀なROAS' },
    { campaignName: 'リターゲティング', roas: 3.2, reason: 'サイト訪問者への再アプローチが効果的に機能している' },
  ],
  underPerformers: [
    { campaignName: '新規顧客獲得', roas: 0.8, reason: 'ターゲティングが広すぎ、関連性の低いクリックが多発。CPA上限の見直しが必要' },
    { campaignName: 'ディスプレイ広告テスト', roas: 0.5, reason: 'クリエイティブの品質が低く、CTR0.4%は業界平均を大幅に下回る' },
    { campaignName: '動画キャンペーン', roas: 1.8, reason: '視聴率は良好だが直接コンバージョンへの導線が弱い' },
  ],
  opportunities: [
    { text: 'ROASが3.0以上のキャンペーンに予算を20%増額することで、月間収益を推定15%向上可能' },
    { text: '週末の入札額を平日の60%に自動調整するルールを設定し、無駄な支出を削減' },
    { text: '新規顧客獲得キャンペーンのターゲティングを絞り込み、類似オーディエンスを活用' },
    { text: 'ディスプレイ広告のクリエイティブをA/Bテストで最適化し、CTRを1.5%まで改善目標' },
    { text: 'リターゲティングの除外リストを更新し、既存顧客への重複配信を防止' },
  ],
  suggestions: [
    { id: 's1', priority: 'HIGH', title: '予算再配分の実施', description: 'ROASが1.0未満の「新規顧客獲得」と「ディスプレイ広告テスト」への予算を30%削減し、「春のプロモーション2026」と「リターゲティング」に再配分してください。', estimatedImpact: '全体ROAS +0.5pt, 月間収益 +12%' },
    { id: 's2', priority: 'HIGH', title: '新規顧客獲得のターゲティング修正', description: 'ターゲットオーディエンスが広すぎます。過去のコンバージョンデータに基づく類似オーディエンスに絞り込み、除外キーワードの追加を推奨します。', estimatedImpact: 'CPA -35%, ROAS +1.2pt' },
    { id: 's3', priority: 'MEDIUM', title: '曜日別入札調整の導入', description: '週末（土日）のCPAが平日の1.6倍になっています。土日の入札額を-40%に自動調整するルールを導入してください。', estimatedImpact: '月間支出 -8%, 全体CPA -12%' },
    { id: 's4', priority: 'MEDIUM', title: 'ディスプレイ広告クリエイティブの刷新', description: 'CTR 0.4%は業界平均（1.5%）を大幅に下回っています。クリエイティブのA/Bテストを実施し、画像・コピーの全面見直しを推奨します。', estimatedImpact: 'CTR +1.0pt, 品質スコア改善' },
    { id: 's5', priority: 'LOW', title: '動画キャンペーンのコンバージョン導線強化', description: '視聴完了率は高いですが、ランディングページへの遷移が少ない状態です。CTAオーバーレイの追加やサイトリンク拡張機能の活用を検討してください。', estimatedImpact: 'ROAS +0.5pt, CV数 +20%' },
  ],
  risks: [
    { id: 'r1', severity: 'CRITICAL', title: '予算超過リスク', description: '「春のプロモーション2026」の日次支出が設定予算の120%に達する日が週3回以上発生しています。日次予算上限の厳格化が必要です。', affectedCampaigns: ['春のプロモーション2026'] },
    { id: 'r2', severity: 'WARNING', title: 'オーディエンス飽和', description: 'リターゲティングキャンペーンのフリークエンシーが月間8.5回に達しており、クリック率の低下傾向が見られます。オーディエンスリストの拡張を推奨します。', affectedCampaigns: ['リターゲティング'] },
    { id: 'r3', severity: 'INFO', title: '品質スコア低下傾向', description: '3つのキャンペーンで品質スコアが過去30日間で平均0.8ポイント低下しています。ランディングページの関連性とキーワードの見直しを推奨します。', affectedCampaigns: ['ショッピング広告', '新規顧客獲得', 'ディスプレイ広告テスト'] },
  ],
};

// ============================================================
// Score Indicator
// ============================================================

function ScoreIndicator({ score }: { score: number }): React.ReactElement {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  function getScoreColor(s: number): string {
    if (s > 70) return 'text-green-500';
    if (s >= 40) return 'text-yellow-500';
    return 'text-red-500';
  }

  function getStrokeColor(s: number): string {
    if (s > 70) return 'hsl(142, 71%, 45%)';
    if (s >= 40) return 'hsl(48, 96%, 53%)';
    return 'hsl(0, 72%, 51%)';
  }

  return (
    <div className="relative h-28 w-28 flex-shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={getStrokeColor(score)}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold', getScoreColor(score))}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ============================================================
// KPI Card
// ============================================================

function KpiCard({
  label,
  value,
  subLabel,
}: {
  label: string;
  value: string;
  subLabel?: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {subLabel && (
        <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
      )}
    </div>
  );
}

// ============================================================
// Sortable Campaign Table
// ============================================================

function CampaignTable({ campaigns }: { campaigns: Campaign[] }): React.ReactElement {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>('roas');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...campaigns].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  function SortHeader({ label, columnKey }: { label: string; columnKey: SortKey }): React.ReactElement {
    const isActive = sortKey === columnKey;
    return (
      <button
        type="button"
        onClick={() => handleSort(columnKey)}
        className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        {isActive && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left"><SortHeader label={t('accountAnalysis.campaignName')} columnKey="name" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label={t('accountAnalysis.campaignStatus')} columnKey="status" /></th>
            <th className="px-4 py-3 text-left"><SortHeader label={t('accountAnalysis.campaignObjective')} columnKey="objective" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label={t('accountAnalysis.dailyBudget')} columnKey="dailyBudget" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label={t('accountAnalysis.spend30d')} columnKey="spend30d" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label="ROAS" columnKey="roas" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label="CTR" columnKey="ctr" /></th>
            <th className="px-4 py-3 text-right"><SortHeader label="IMP" columnKey="impressions" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const statusCfg = STATUS_CONFIG[c.status];
            return (
              <tr key={c.id} className="border-b border-border transition-colors hover:bg-muted/30">
                <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusCfg.className)}>
                    {t(statusCfg.labelKey)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t(OBJECTIVE_LABEL_KEYS[c.objective])}</td>
                <td className="px-4 py-3 text-right text-foreground">
                  {c.dailyBudget > 0 ? `\u00A5${c.dailyBudget.toLocaleString('ja-JP')}` : '-'}
                </td>
                <td className="px-4 py-3 text-right text-foreground">{`\u00A5${c.spend30d.toLocaleString('ja-JP')}`}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn('font-semibold', c.roas >= 3 ? 'text-green-600' : c.roas >= 1 ? 'text-yellow-600' : 'text-red-600')}>
                    {c.roas.toFixed(1)}x
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-foreground">{c.ctr.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-foreground">{c.impressions.toLocaleString('ja-JP')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Performer Card
// ============================================================

function PerformerCard({
  performer,
  variant,
}: {
  performer: Performer;
  variant: 'top' | 'under';
}): React.ReactElement {
  return (
    <div className={cn(
      'rounded-lg border border-border bg-card p-4 border-l-4',
      variant === 'top' ? 'border-l-green-500' : 'border-l-red-500',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{performer.campaignName}</p>
        <span className={cn(
          'text-sm font-bold',
          variant === 'top' ? 'text-green-600' : 'text-red-600',
        )}>
          ROAS {performer.roas.toFixed(1)}x
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{performer.reason}</p>
    </div>
  );
}

// ============================================================
// Skeleton Components
// ============================================================

function SkeletonPage(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-28 w-28 rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="h-32 rounded-lg bg-muted" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}

// ============================================================
// Recharts Tooltip Style
// ============================================================

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

// ============================================================
// Main Page
// ============================================================

export default function AccountAnalysisPage(): React.ReactElement {
  const { t } = useI18n();
  const { connectionId } = useParams<{ connectionId: string }>();
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isLoading] = useState(false);

  // TODO: replace mock data with tRPC query using connectionId
  void connectionId;
  const data = MOCK_DATA;

  function handleReanalyze(): void {
    setIsReanalyzing(true);
    setTimeout(() => setIsReanalyzing(false), 3000);
  }

  if (isLoading) {
    return <SkeletonPage />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label={t('accountAnalysis.breadcrumbLabel')}>
        <a href="/settings" className="hover:text-foreground transition-colors">{t('accountAnalysis.breadcrumbSettings')}</a>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{t('accountAnalysis.breadcrumbAnalysis')}</span>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">{data.platformLabel}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <ScoreIndicator score={data.overallScore} />
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
                {data.platformIcon}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.accountName}</h1>
                <p className="text-sm text-muted-foreground">{data.platformLabel}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('accountAnalysis.overallScore')} <span className="font-semibold text-foreground">{data.overallScore}/100</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t('accountAnalysis.analysisDate')} {data.analysisDate}</span>
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={isReanalyzing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isReanalyzing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {isReanalyzing ? t('accountAnalysis.reanalyzing') : t('accountAnalysis.reanalyze')}
          </button>
        </div>
      </div>

      {/* AI Summary Card */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-primary">{t('accountAnalysis.aiSummary')}</h2>
        </div>
        <div className="space-y-3">
          {data.aiSummary.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-sm leading-relaxed text-foreground/90">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('accountAnalysis.totalCampaigns')}
          value={String(data.totalCampaigns)}
          subLabel={`${t('accountAnalysis.activeCampaignsLabel')} ${data.activeCampaigns}`}
        />
        <KpiCard
          label={t('accountAnalysis.totalSpend30d')}
          value={`\u00A5${data.totalSpend30d.toLocaleString('ja-JP')}`}
        />
        <KpiCard
          label={t('accountAnalysis.avgRoas')}
          value={`${data.averageRoas.toFixed(1)}x`}
        />
        <KpiCard
          label={t('accountAnalysis.avgCtr')}
          value={`${data.averageCtr.toFixed(1)}%`}
        />
      </div>

      {/* Campaign Table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('accountAnalysis.campaignList')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('accountAnalysis.totalCampaignsCount').replace('{count}', String(data.campaigns.length))}</p>
        </div>
        <CampaignTable campaigns={data.campaigns} />
      </div>

      {/* Spend Pattern Charts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('accountAnalysis.spendPattern')}</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Daily Spend Trend */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('accountAnalysis.dailySpendTrend')}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp size={12} className="text-green-500" />
                <span>{t('accountAnalysis.peak')} {data.peakDay}</span>
                <TrendingDown size={12} className="text-red-500" />
                <span>{t('accountAnalysis.lowest')} {data.lowDay}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.dailySpend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`\u00A5${value.toLocaleString('ja-JP')}`, t('accountAnalysis.spend')]}
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  name={t('accountAnalysis.spend')}
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weekday Average */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">{t('accountAnalysis.weekdayAverage')}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.weekdayAverage} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`\u00A5${value.toLocaleString('ja-JP')}`, t('accountAnalysis.avgSpend')]}
                />
                <Bar
                  dataKey="average"
                  name={t('accountAnalysis.avgSpend')}
                  fill="hsl(262, 83%, 58%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Diagnosis */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('accountAnalysis.performanceDiagnosis')}</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Top Performers */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-600">
              <TrendingUp size={16} />
              {t('accountAnalysis.topPerformers')}
            </h3>
            <div className="space-y-3">
              {data.topPerformers.map((p) => (
                <PerformerCard key={p.campaignName} performer={p} variant="top" />
              ))}
            </div>
          </div>

          {/* Under Performers */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600">
              <TrendingDown size={16} />
              {t('accountAnalysis.underPerformers')}
            </h3>
            <div className="space-y-3">
              {data.underPerformers.map((p) => (
                <PerformerCard key={p.campaignName} performer={p} variant="under" />
              ))}
            </div>
          </div>
        </div>

        {/* Opportunities */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lightbulb size={16} className="text-yellow-500" />
            {t('accountAnalysis.improvementOpportunities')}
          </h3>
          <ul className="space-y-2">
            {data.opportunities.map((opp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90">
                <Lightbulb size={14} className="mt-0.5 flex-shrink-0 text-yellow-500" />
                <span>{opp.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Improvement Suggestions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{t('accountAnalysis.aiSuggestions')}</h2>
        <div className="space-y-3">
          {data.suggestions.map((s) => {
            const cfg = PRIORITY_CONFIG[s.priority];
            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-lg border border-border border-l-4 p-5',
                  cfg.borderClass,
                  cfg.bgClass,
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0">{cfg.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          s.priority === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : s.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        )}>
                          {s.priority}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                      <p className="mt-2 text-xs font-medium text-foreground">
                        {t('accountAnalysis.estimatedImpact')} <span className="text-primary">{s.estimatedImpact}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t('accountAnalysis.execute')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Detection */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ShieldAlert size={18} className="text-red-500" />
          {t('accountAnalysis.riskDetection')}
        </h2>
        <div className="space-y-3">
          {data.risks.map((r) => {
            const cfg = SEVERITY_CONFIG[r.severity];
            return (
              <div
                key={r.id}
                className={cn('rounded-lg border p-5', cfg.bgClass, cfg.borderClass)}
              >
                <div className="flex items-start gap-3">
                  {r.severity === 'CRITICAL' && <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />}
                  {r.severity === 'WARNING' && <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-yellow-500" />}
                  {r.severity === 'INFO' && <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn('text-sm font-semibold', cfg.textClass)}>{r.title}</h3>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        r.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : r.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
                      )}>
                        {r.severity}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.affectedCampaigns.map((name) => (
                        <span
                          key={name}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
