'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  Filter,
  Lightbulb,
  Loader2,
  Settings,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type DecisionType =
  | 'budget_adjustment'
  | 'campaign_pause'
  | 'campaign_resume'
  | 'creative_rotation'
  | 'campaign_creation'
  | 'strategy_insight';

type DecisionStatus = 'executed' | 'pending_approval' | 'rejected' | 'skipped';

type StatusFilter = 'all' | DecisionStatus;
type TypeFilter = 'all' | DecisionType;

interface AiDecision {
  id: string;
  type: DecisionType;
  status: DecisionStatus;
  campaignName: string | null;
  reasoning: string;
  confidence: number;
  actionSummary: string;
  result: string | null;
  timestamp: string;
  timeAgo: string;
}

interface StatusCardData {
  label: string;
  value: string;
  subLabel?: string;
}

interface PerformanceMetric {
  label: string;
  before: number;
  after: number;
  format: 'roas' | 'currency' | 'percent';
}

interface BeforeAfterChartData {
  metric: string;
  before: number;
  after: number;
}

// ============================================================
// Constants
// ============================================================

const DECISION_TYPE_CONFIG: Record<
  DecisionType,
  { icon: string; label: string; badgeClass: string }
> = {
  budget_adjustment: {
    icon: '\uD83D\uDCB0',
    label: '予算調整',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  campaign_pause: {
    icon: '\u23F8',
    label: 'キャンペーン停止',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  campaign_resume: {
    icon: '\u25B6\uFE0F',
    label: 'キャンペーン再開',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  creative_rotation: {
    icon: '\uD83D\uDD04',
    label: 'クリエイティブ変更',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  campaign_creation: {
    icon: '\u2795',
    label: 'キャンペーン作成',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  strategy_insight: {
    icon: '\uD83D\uDCA1',
    label: '戦略インサイト',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

const STATUS_CONFIG: Record<
  DecisionStatus,
  { label: string; badgeClass: string }
> = {
  executed: {
    label: '実行済み',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  pending_approval: {
    label: '承認待ち',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  rejected: {
    label: '却下',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  skipped: {
    label: 'スキップ',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

// ============================================================
// Mock Data
// ============================================================

const MOCK_STRATEGY_SUMMARY =
  '現在の分析に基づき、TikTok広告の予算を増額し、Google広告のクリエイティブを刷新することを推奨します。春の新生活シーズンに合わせ、ターゲティングを25-35歳女性に最適化中です。Meta広告のリターゲティングは好調を維持しており、LINEリマーケティングはフリークエンシー上限に近づいているため配信ペースを調整しています。全体として、ROAS目標3.0xに対し現在3.24xと順調に推移しています。';

const MOCK_STATUS_CARDS: StatusCardData[] = [
  { label: 'ステータス', value: 'ON', subLabel: '承認モード' },
  { label: '最終実行', value: '2時間前', subLabel: '2026-04-02 12:00 JST' },
  { label: '次回実行', value: '1時間後', subLabel: '14:00 JST' },
  { label: '今日の判断', value: '7件', subLabel: '5実行, 2提案中' },
];

const MOCK_DECISIONS: AiDecision[] = [
  {
    id: 'd1',
    type: 'budget_adjustment',
    status: 'executed',
    campaignName: 'TikTok新規獲得',
    reasoning:
      'TikTok広告「新規獲得」のCVRが直近48時間で35%上昇しています。ROASも2.8から3.5に改善しており、予算増額による更なるスケール拡大が期待できます。',
    confidence: 92,
    actionSummary: '日次予算: ¥28,000 → ¥33,600 (+20%)',
    result: 'ROAS: 2.8 → 3.5 (+25%)',
    timestamp: '2026-04-02T12:00:00Z',
    timeAgo: '2時間前',
  },
  {
    id: 'd2',
    type: 'budget_adjustment',
    status: 'executed',
    campaignName: 'Google 春のプロモーション',
    reasoning:
      'Google広告「春のプロモーション」のROASが過去3日間で4.5から3.8に低下。主要キーワードのCPCが12%上昇しており、競合の参入が確認されています。予算効率を維持するため一時的に予算を削減します。',
    confidence: 87,
    actionSummary: '日次予算: ¥42,000 → ¥35,700 (-15%)',
    result: 'CPC: ¥320 → ¥285 (-11%)',
    timestamp: '2026-04-02T10:00:00Z',
    timeAgo: '4時間前',
  },
  {
    id: 'd3',
    type: 'budget_adjustment',
    status: 'pending_approval',
    campaignName: 'Meta ストーリーズ',
    reasoning:
      'Meta広告ストーリーズフォーマットのエンゲージメント率が急上昇。CPMが低下傾向にあり、今が予算拡大の好機です。テスト段階から本格運用への移行を推奨します。',
    confidence: 78,
    actionSummary: '日次予算: ¥2,000 → ¥8,000 (+300%)',
    result: null,
    timestamp: '2026-04-02T13:00:00Z',
    timeAgo: '1時間前',
  },
  {
    id: 'd4',
    type: 'campaign_pause',
    status: 'executed',
    campaignName: 'Yahoo!ディスプレイ',
    reasoning:
      'Yahoo!ディスプレイ広告のROASが0.8と目標を大幅に下回っています。過去7日間で改善の兆候がなく、予算消化率も40%と低迷。クリエイティブと入札戦略の見直し後に再開を推奨します。',
    confidence: 95,
    actionSummary: 'キャンペーンを一時停止',
    result: '日次コスト削減: ¥5,500',
    timestamp: '2026-04-02T09:00:00Z',
    timeAgo: '5時間前',
  },
  {
    id: 'd5',
    type: 'campaign_pause',
    status: 'executed',
    campaignName: 'X ブランドプロモーション',
    reasoning:
      'X広告のアカウント認証が期限切れの状態です。正常な配信ができないため、再認証完了まで一時停止します。',
    confidence: 99,
    actionSummary: 'キャンペーンを一時停止（認証期限切れ）',
    result: '異常支出を防止',
    timestamp: '2026-04-02T08:00:00Z',
    timeAgo: '6時間前',
  },
  {
    id: 'd6',
    type: 'campaign_resume',
    status: 'executed',
    campaignName: 'Meta リターゲティング',
    reasoning:
      'フリークエンシーキャップの調整とオーディエンスリストの更新が完了しました。新規のリマーケティングリストでのテスト配信を再開します。',
    confidence: 85,
    actionSummary: 'キャンペーンを再開（オーディエンス更新済み）',
    result: 'CTR: 2.1% → 3.4% (+62%)',
    timestamp: '2026-04-02T07:00:00Z',
    timeAgo: '7時間前',
  },
  {
    id: 'd7',
    type: 'creative_rotation',
    status: 'executed',
    campaignName: 'TikTok 若年層向けプロモ',
    reasoning:
      'TikTok広告「若年層向けプロモ」のCTRが直近3日で20%低下しています。クリエイティブ疲労の兆候が明確です。パフォーマンス上位の素材を優先表示し、低パフォーマンス素材を停止します。',
    confidence: 91,
    actionSummary: '3素材を停止、2素材を優先配信に変更',
    result: 'CTR: 1.8% → 2.5% (+39%)',
    timestamp: '2026-04-02T11:00:00Z',
    timeAgo: '3時間前',
  },
  {
    id: 'd8',
    type: 'creative_rotation',
    status: 'pending_approval',
    campaignName: 'Google 春のプロモーション',
    reasoning:
      'Google広告のレスポンシブ検索広告において、見出しパターンの偏りが確認されました。新しい見出しバリエーションの追加により、品質スコアの改善が期待できます。',
    confidence: 73,
    actionSummary: '新規見出し5パターンを追加、低パフォーマンス見出し3つを削除',
    result: null,
    timestamp: '2026-04-02T13:30:00Z',
    timeAgo: '30分前',
  },
  {
    id: 'd9',
    type: 'campaign_creation',
    status: 'pending_approval',
    campaignName: null,
    reasoning:
      'Google検索広告の分析により、「新生活 家具」「引越し 必需品」等の季節キーワードで高いコンバージョンポテンシャルを検出。新規キャンペーンの作成を提案します。推定ROAS: 4.2x、推定日次予算: ¥15,000。',
    confidence: 81,
    actionSummary:
      '新規キャンペーン「春の新生活 - 検索広告」を作成\n対象: Google検索\n日次予算: ¥15,000\nターゲット: 25-35歳、引越し関連キーワード',
    result: null,
    timestamp: '2026-04-02T12:30:00Z',
    timeAgo: '1時間半前',
  },
  {
    id: 'd10',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      '全プラットフォームの横断分析の結果、火曜日〜木曜日の12:00-14:00にコンバージョン率が最も高いことが判明。この時間帯に予算を集中配分することで、全体のROASを15-20%改善できる可能性があります。',
    confidence: 88,
    actionSummary: '時間帯別予算配分の最適化を提案',
    result: '実装済み: 平日昼の予算配分を30%増加',
    timestamp: '2026-04-02T06:00:00Z',
    timeAgo: '8時間前',
  },
  {
    id: 'd11',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      'クロスプラットフォーム分析により、Google検索→LINE→Metaの順でタッチポイントを最適化することで、アトリビューション効率が向上することを確認。ファネル全体でのCVRが18%向上する見込みです。',
    confidence: 84,
    actionSummary: 'マルチタッチアトリビューション戦略の更新',
    result: 'CVR: 2.4% → 2.8% (+17%)',
    timestamp: '2026-04-01T18:00:00Z',
    timeAgo: '20時間前',
  },
  {
    id: 'd12',
    type: 'strategy_insight',
    status: 'executed',
    campaignName: null,
    reasoning:
      '競合分析の結果、主要競合3社がTikTok広告への投資を拡大中。市場シェアを維持するため、TikTokの予算比率を現在の15%から25%に段階的に引き上げることを推奨します。',
    confidence: 76,
    actionSummary: 'TikTok予算比率の段階的引き上げ計画を策定',
    result: 'インプレッションシェア: 12% → 18%',
    timestamp: '2026-04-01T14:00:00Z',
    timeAgo: '昨日',
  },
];

const MOCK_PERFORMANCE_METRICS: PerformanceMetric[] = [
  { label: 'ROAS', before: 2.3, after: 3.24, format: 'roas' },
  { label: 'CPA', before: 4200, after: 2850, format: 'currency' },
  { label: 'CTR', before: 1.8, after: 2.6, format: 'percent' },
  { label: 'CVR', before: 2.1, after: 2.8, format: 'percent' },
];

const BEFORE_AFTER_CHART_DATA: BeforeAfterChartData[] = [
  { metric: 'ROAS', before: 2.3, after: 3.24 },
  { metric: 'CTR(%)', before: 1.8, after: 2.6 },
  { metric: 'CVR(%)', before: 2.1, after: 2.8 },
];

const CHART_COLORS = {
  before: 'hsl(220, 14%, 70%)',
  after: 'hsl(217, 91%, 60%)',
};

// ============================================================
// Subcomponents
// ============================================================

function StatusPanel({
  cards,
  isActive,
}: {
  cards: StatusCardData[];
  isActive: boolean;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {card.label === 'ステータス' ? (
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block h-3 w-3 rounded-full',
                    isActive ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                {card.value}
              </span>
            ) : (
              card.value
            )}
          </p>
          {card.subLabel && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{card.subLabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StrategySummaryCard({
  summary,
  updatedAt,
}: {
  summary: string;
  updatedAt: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">AIの判断方針</h3>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">最終更新: {updatedAt}</p>
    </div>
  );
}

function DecisionCard({
  decision,
  onApprove,
  onReject,
}: {
  decision: AiDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}): React.ReactElement {
  const typeConfig = DECISION_TYPE_CONFIG[decision.type];
  const statusConfig = STATUS_CONFIG[decision.status];
  const isPending = decision.status === 'pending_approval';

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={typeConfig.label}>
            {typeConfig.icon}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              typeConfig.badgeClass,
            )}
          >
            {typeConfig.label}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              statusConfig.badgeClass,
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          {decision.timeAgo}
        </span>
      </div>

      {/* Campaign name */}
      {decision.campaignName && (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {decision.campaignName}
        </p>
      )}

      {/* Reasoning */}
      <div className="mt-3 rounded-md border-l-4 border-primary/30 bg-muted/50 px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">AIの理由</p>
        <p className="text-sm leading-relaxed text-foreground">{decision.reasoning}</p>
      </div>

      {/* Confidence */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-muted-foreground">確信度</span>
        <div className="flex-1 h-2 rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              decision.confidence >= 90
                ? 'bg-green-500'
                : decision.confidence >= 70
                  ? 'bg-blue-500'
                  : 'bg-yellow-500',
            )}
            style={{ width: `${decision.confidence}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground">{decision.confidence}%</span>
      </div>

      {/* Action summary */}
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">アクション</p>
        <p className="text-sm text-foreground whitespace-pre-line">{decision.actionSummary}</p>
      </div>

      {/* Result */}
      {decision.result && (
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {decision.result}
          </span>
        </div>
      )}

      {/* Action buttons for pending */}
      {isPending && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onApprove(decision.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Check size={14} />
            承認して実行
          </button>
          <button
            type="button"
            onClick={() => onReject(decision.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <X size={14} />
            却下
          </button>
        </div>
      )}
    </div>
  );
}

function FilterBar({
  statusFilter,
  typeFilter,
  onStatusFilterChange,
  onTypeFilterChange,
}: {
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
}): React.ReactElement {
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'すべて' },
    { value: 'executed', label: '実行済み' },
    { value: 'pending_approval', label: '承認待ち' },
    { value: 'rejected', label: '却下' },
  ];

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'すべて' },
    { value: 'budget_adjustment', label: '予算調整' },
    { value: 'campaign_pause', label: '停止' },
    { value: 'campaign_resume', label: '再開' },
    { value: 'creative_rotation', label: 'クリエイティブ' },
    { value: 'campaign_creation', label: '新規作成' },
    { value: 'strategy_insight', label: 'インサイト' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">ステータス:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusFilterChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">種類:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTypeFilterChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PerformanceImpactSection({
  metrics,
  chartData,
}: {
  metrics: PerformanceMetric[];
  chartData: BeforeAfterChartData[];
}): React.ReactElement {
  function formatValue(value: number, format: PerformanceMetric['format']): string {
    switch (format) {
      case 'roas':
        return `${value.toFixed(2)}x`;
      case 'currency':
        return new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency: 'JPY',
        }).format(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
    }
  }

  function calculateDelta(before: number, after: number): {
    text: string;
    isPositive: boolean;
  } {
    const pctChange = ((after - before) / before) * 100;
    const isPositive = pctChange > 0;
    return {
      text: `${isPositive ? '+' : ''}${pctChange.toFixed(0)}%`,
      isPositive,
    };
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">パフォーマンス影響</h3>
      </div>

      {/* Metric comparison cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => {
          const delta = calculateDelta(metric.before, metric.after);
          return (
            <div key={metric.label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatValue(metric.after, metric.format)}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    delta.isPositive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {delta.text}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>前: {formatValue(metric.before, metric.format)}</span>
                <ArrowRight size={8} />
                <span>後: {formatValue(metric.after, metric.format)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="mt-4">
        <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-gray-400" />
            AI有効化前 (7日間)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-blue-500" />
            AI有効化後 (7日間)
          </span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="before" name="AI有効化前" fill={CHART_COLORS.before} radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name="AI有効化後" fill={CHART_COLORS.after} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AiPilotPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [decisions, setDecisions] = useState<AiDecision[]>(MOCK_DECISIONS);
  const [triggering, setTriggering] = useState(false);

  const isActive = true;

  // TODO: Wire to tRPC when backend is ready
  // const { data, isLoading } = trpc.aiAutopilot.status.useQuery();
  // const triggerMutation = trpc.aiAutopilot.trigger.useMutation();

  const filteredDecisions = decisions.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    return true;
  });

  function handleApprove(id: string): void {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'executed' as DecisionStatus } : d,
      ),
    );
  }

  function handleReject(id: string): void {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'rejected' as DecisionStatus } : d,
      ),
    );
  }

  function handleManualTrigger(): void {
    setTriggering(true);
    // TODO: triggerMutation.mutate()
    setTimeout(() => setTriggering(false), 2000);
  }

  const pendingCount = decisions.filter(
    (d) => d.status === 'pending_approval',
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              AI オートパイロット
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500',
                )}
              />
              {isActive ? '稼働中' : '停止中'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AIによる広告運用の自動最適化状況を確認できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {triggering ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            手動実行
          </button>
          <a
            href="/settings/ai"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Settings size={14} />
            AI設定
          </a>
        </div>
      </div>

      {/* Pending approval banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/30">
          <Clock size={18} className="flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {pendingCount}件の承認待ちの提案があります
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter('pending_approval')}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-yellow-700 hover:text-yellow-800 dark:text-yellow-400"
          >
            確認する
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Status panel */}
      <StatusPanel cards={MOCK_STATUS_CARDS} isActive={isActive} />

      {/* Strategy summary */}
      <StrategySummaryCard summary={MOCK_STRATEGY_SUMMARY} updatedAt="2時間前" />

      {/* Filter bar */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">AI判断タイムライン</h2>
        <FilterBar
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusFilterChange={setStatusFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      {/* Decision timeline */}
      <div className="space-y-4">
        {filteredDecisions.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Lightbulb size={32} className="mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              該当する判断がありません
            </p>
          </div>
        ) : (
          filteredDecisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </div>

      {/* Performance impact */}
      <PerformanceImpactSection
        metrics={MOCK_PERFORMANCE_METRICS}
        chartData={BEFORE_AFTER_CHART_DATA}
      />
    </div>
  );
}
