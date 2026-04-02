'use client';

import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeJapaneseYen,
  BrainCircuit,
  Check,
  Clock,
  FlaskConical,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type AlertSeverity = 'critical' | 'warning';
type InsightType = 'opportunity' | 'warning' | 'achievement';
type CampaignHealthStatus = 'active' | 'paused' | 'error';
type Platform = 'google' | 'meta' | 'tiktok' | 'line' | 'x' | 'yahoo_japan';
type BudgetPaceStatus = 'on-pace' | 'under-delivery' | 'overspend-risk';

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: string;
}

interface KpiCardData {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ReactNode;
}

interface CampaignHealth {
  id: string;
  name: string;
  healthScore: number;
  platforms: Platform[];
  dailySpend: number;
  roas: number;
  status: CampaignHealthStatus;
}

interface BudgetPacing {
  spent: number;
  total: number;
  time: string;
  status: BudgetPaceStatus;
  statusLabel: string;
}

interface AiInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
}

interface AbTest {
  id: string;
  name: string;
  variants: string[];
  currentWinner: string;
  significance: number;
  sampleProgress: number;
}

interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'user' | 'ai' | 'alert';
}

// ============================================================
// Mock Data
// ============================================================

const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1',
    severity: 'critical',
    title: '支出急増検出',
    description: 'Google広告「春のプロモーション」で過去1時間の支出が通常の3倍になっています。入札単価の異常上昇が原因の可能性があります。',
    action: '入札戦略を確認し、必要に応じて日次上限を調整してください。',
  },
  {
    id: 'a2',
    severity: 'critical',
    title: 'コンバージョン追跡異常',
    description: 'Meta広告のコンバージョンピクセルが過去2時間データを送信していません。追跡コードの設置状況を確認してください。',
    action: 'Meta Events Managerでピクセルの状態を確認してください。',
  },
  {
    id: 'a3',
    severity: 'warning',
    title: 'クリエイティブ疲労検出',
    description: 'TikTok広告「若年層向けプロモ」のCTRが直近3日で20%低下しています。',
    action: '新しいクリエイティブバリエーションの作成を推奨します。',
  },
  {
    id: 'a4',
    severity: 'warning',
    title: 'オーディエンス飽和',
    description: 'LINE配信「リマーケティング」のフリークエンシーが7.2回に達しています。',
    action: 'オーディエンスの拡張または除外リストの更新を検討してください。',
  },
  {
    id: 'a5',
    severity: 'warning',
    title: '予算消化不足',
    description: 'Yahoo!広告の予算消化率が40%と低い水準にあります。',
    action: '入札単価の引き上げまたはターゲティングの拡張を検討してください。',
  },
];

const MOCK_KPI: KpiCardData[] = [
  { label: '総広告費（今日）', value: '¥127,500', icon: <BadgeJapaneseYen size={20} className="text-blue-500" /> },
  { label: '総収益（今日）', value: '¥412,800', icon: <TrendingUp size={20} className="text-green-500" /> },
  { label: '総ROAS', value: '3.24x', icon: <Activity size={20} className="text-purple-500" /> },
  { label: 'アクティブキャンペーン', value: '8', subLabel: '/ 12 キャンペーン', icon: <Zap size={20} className="text-orange-500" /> },
];

const MOCK_CAMPAIGN_HEALTH: CampaignHealth[] = [
  { id: '1', name: '春のプロモーション2026', healthScore: 92, platforms: ['google', 'meta'], dailySpend: 42000, roas: 4.5, status: 'active' },
  { id: '2', name: 'TikTok新規獲得', healthScore: 78, platforms: ['tiktok'], dailySpend: 28000, roas: 2.8, status: 'active' },
  { id: '3', name: 'LINEリマーケティング', healthScore: 45, platforms: ['line'], dailySpend: 15000, roas: 1.9, status: 'active' },
  { id: '4', name: 'ブランド認知拡大', healthScore: 85, platforms: ['google', 'x'], dailySpend: 35000, roas: 3.2, status: 'active' },
  { id: '5', name: 'Yahoo!ディスプレイ', healthScore: 32, platforms: ['yahoo_japan'], dailySpend: 5500, roas: 0.8, status: 'error' },
  { id: '6', name: 'Meta ストーリーズ', healthScore: 60, platforms: ['meta'], dailySpend: 2000, roas: 2.1, status: 'paused' },
];

const MOCK_BUDGET_PACING: BudgetPacing = {
  spent: 127500,
  total: 200000,
  time: '15:00',
  status: 'on-pace',
  statusLabel: '正常',
};

const MOCK_AI_INSIGHTS: AiInsight[] = [
  { id: 'i1', type: 'opportunity', title: 'TikTok予算増額推奨', description: 'TikTok広告のCVRが直近48時間で35%上昇。予算を20%増やすことでROI最大化が見込めます。' },
  { id: 'i2', type: 'warning', title: 'Google検索広告のCPC上昇', description: '主要キーワードのCPCが先週比12%上昇。競合の参入が確認されています。' },
  { id: 'i3', type: 'achievement', title: 'Meta広告で新記録達成', description: 'リターゲティングキャンペーンのROASが過去最高の5.2xを記録しました。' },
  { id: 'i4', type: 'opportunity', title: 'クロスプラットフォーム最適化', description: 'Google→LINE→Metaの順にタッチポイントを最適化することで、CVRが18%向上する可能性があります。' },
];

const MOCK_AB_TESTS: AbTest[] = [
  { id: 't1', name: 'ランディングページ A vs B', variants: ['パターンA（既存）', 'パターンB（新デザイン）'], currentWinner: 'パターンB', significance: 94, sampleProgress: 82 },
  { id: 't2', name: 'CTA文言テスト', variants: ['今すぐ購入', '詳細を見る', '無料で試す'], currentWinner: '無料で試す', significance: 78, sampleProgress: 65 },
  { id: 't3', name: 'ビジュアルクリエイティブ', variants: ['動画広告', '静止画カルーセル'], currentWinner: '動画広告', significance: 88, sampleProgress: 91 },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'act1', message: '田中太郎がキャンペーン「春の新生活」を一時停止しました', time: '2分前', type: 'user' },
  { id: 'act2', message: 'AIが予算最適化を実行: TikTok +15%, META -10%', time: '1時間前', type: 'ai' },
  { id: 'act3', message: 'アラート: 「リマーケティング」のCTRが15%低下', time: '3時間前', type: 'alert' },
  { id: 'act4', message: '山田花子がクリエイティブ「春セール動画v3」を承認しました', time: '4時間前', type: 'user' },
  { id: 'act5', message: 'AIがA/Bテスト「CTA文言テスト」を開始しました', time: '5時間前', type: 'ai' },
  { id: 'act6', message: '新規キャンペーン「GW特別セール」が下書き保存されました', time: '6時間前', type: 'user' },
  { id: 'act7', message: 'レポート「3月パフォーマンスレポート」が自動生成されました', time: '8時間前', type: 'ai' },
  { id: 'act8', message: 'アラート: Yahoo!広告の予算消化率が40%未満', time: '10時間前', type: 'alert' },
  { id: 'act9', message: 'AIがオーディエンスの類似拡張を完了しました', time: '12時間前', type: 'ai' },
  { id: 'act10', message: '佐藤一郎がキャンペーン「ブランド認知拡大」の予算を変更しました', time: '昨日', type: 'user' },
];

const PLATFORM_LABELS: Record<Platform, string> = {
  google: 'Google',
  meta: 'Meta',
  tiktok: 'TikTok',
  line: 'LINE',
  x: 'X',
  yahoo_japan: 'Yahoo!',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  google: 'bg-blue-500',
  meta: 'bg-indigo-500',
  tiktok: 'bg-pink-500',
  line: 'bg-green-500',
  x: 'bg-gray-700',
  yahoo_japan: 'bg-red-500',
};

const STATUS_LABELS: Record<CampaignHealthStatus, string> = {
  active: '配信中',
  paused: '一時停止',
  error: 'エラー',
};

const STATUS_CLASSES: Record<CampaignHealthStatus, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({ card }: { card: KpiCardData }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
        {card.icon}
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{card.value}</p>
      {card.subLabel && (
        <p className="mt-1 text-xs text-muted-foreground">{card.subLabel}</p>
      )}
    </div>
  );
}

function AlertBanner({ alerts, onViewDetail }: {
  alerts: Alert[];
  onViewDetail: (alert: Alert) => void;
}): React.ReactElement | null {
  const criticals = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  if (criticals.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticals.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {criticals.length}件の重大アラート
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {criticals.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => onViewDetail(alert)}
                    className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/70"
                  >
                    {alert.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                {warnings.length}件の注意
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {warnings.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => onViewDetail(alert)}
                    className="rounded-md bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900/70"
                  >
                    {alert.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onStopCampaign: (alert: Alert) => void;
  onDismiss: (alert: Alert) => void;
}

function AlertDetailModal({ alert, onClose, onStopCampaign, onDismiss }: AlertDetailModalProps): React.ReactElement {
  const isCritical = alert.severity === 'critical';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              isCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30',
            )}>
              <AlertTriangle
                size={16}
                className={isCritical ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}
              />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{alert.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-foreground">{alert.description}</p>
        <div className="mt-4 rounded-md bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">推奨アクション</p>
          <p className="mt-1 text-sm text-foreground">{alert.action}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onStopCampaign(alert);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ShieldAlert size={14} />
            このキャンペーンを停止
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss(alert);
                onClose();
              }}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Check size={14} />
                確認済み
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthScoreRing({ score }: { score: number }): React.ReactElement {
  const color = score > 70 ? 'hsl(142, 71%, 45%)' : score > 40 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)';
  const bgColor = 'hsl(var(--muted))';

  const data = [
    { name: 'score', value: score },
    { name: 'remaining', value: 100 - score },
  ];

  return (
    <div className="relative h-16 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={22}
            outerRadius={30}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={bgColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{score}</span>
      </div>
    </div>
  );
}

function CampaignHealthCard({ campaign }: { campaign: CampaignHealth }): React.ReactElement {
  return (
    <a
      href={`/campaigns/${campaign.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between">
        <HealthScoreRing score={campaign.healthScore} />
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
          STATUS_CLASSES[campaign.status],
        )}>
          {STATUS_LABELS[campaign.status]}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground line-clamp-1">{campaign.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {campaign.platforms.map((p) => (
            <span
              key={p}
              className={cn(
                'inline-flex h-5 items-center rounded px-1 text-[9px] font-medium text-white',
                PLATFORM_COLORS[p],
              )}
            >
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.dailySpend)}/日
        </span>
        <span className={cn(
          'font-semibold',
          campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-red-600',
        )}>
          ROAS {campaign.roas.toFixed(1)}x
        </span>
      </div>
    </a>
  );
}

function BudgetPacingBar({ pacing }: { pacing: BudgetPacing }): React.ReactElement {
  const percentage = Math.round((pacing.spent / pacing.total) * 100);
  const barColor: Record<BudgetPaceStatus, string> = {
    'on-pace': 'bg-green-500',
    'under-delivery': 'bg-yellow-500',
    'overspend-risk': 'bg-red-500',
  };
  const textColor: Record<BudgetPaceStatus, string> = {
    'on-pace': 'text-green-600',
    'under-delivery': 'text-yellow-600',
    'overspend-risk': 'text-red-600',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">本日の予算消化</h3>
        <span className={cn('text-xs font-semibold', textColor[pacing.status])}>
          ペース: {pacing.statusLabel}
        </span>
      </div>
      <div className="mt-3">
        <div className="flex items-end justify-between">
          <p className="text-lg font-bold text-foreground">
            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(pacing.spent)}
            <span className="text-sm font-normal text-muted-foreground">
              {' '}/ {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(pacing.total)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {pacing.time} 現在
          </p>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', barColor[pacing.status])}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">{percentage}% 消化済み</p>
      </div>
    </div>
  );
}

function AiInsightsPanel({ insights }: { insights: AiInsight[] }): React.ReactElement {
  const typeConfig: Record<InsightType, { icon: React.ReactNode; className: string }> = {
    opportunity: { icon: <Lightbulb size={16} />, className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    warning: { icon: <AlertTriangle size={16} />, className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    achievement: { icon: <Trophy size={16} />, className: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <BrainCircuit size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">AIインサイト</h3>
      </div>
      <div className="mt-3 space-y-3">
        {insights.map((insight) => {
          const cfg = typeConfig[insight.type];
          return (
            <div key={insight.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <div className={cn('mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full', cfg.className)}>
                  {cfg.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    アクション
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AbTestCard({ test }: { test: AbTest }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={16} className="text-purple-500" />
        <p className="text-sm font-semibold text-foreground">{test.name}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {test.variants.map((v) => (
          <span
            key={v}
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
              v === test.currentWinner
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {v === test.currentWinner && <Trophy size={10} className="mr-0.5" />}
            {v}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">統計的有意性</span>
            <span className={cn(
              'font-semibold',
              test.significance >= 95 ? 'text-green-600' : test.significance >= 80 ? 'text-yellow-600' : 'text-muted-foreground',
            )}>
              {test.significance}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                test.significance >= 95 ? 'bg-green-500' : test.significance >= 80 ? 'bg-yellow-500' : 'bg-muted-foreground',
              )}
              style={{ width: `${test.significance}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">サンプル進捗</span>
            <span className="font-medium text-foreground">{test.sampleProgress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${test.sampleProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ activities }: { activities: ActivityItem[] }): React.ReactElement {
  const typeConfig: Record<ActivityItem['type'], { icon: React.ReactNode; className: string }> = {
    user: { icon: <Clock size={14} />, className: 'text-muted-foreground' },
    ai: { icon: <BrainCircuit size={14} />, className: 'text-primary' },
    alert: { icon: <AlertTriangle size={14} />, className: 'text-yellow-600' },
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">最近のアクティビティ</h3>
      </div>
      <div className="divide-y divide-border">
        {activities.map((item) => {
          const cfg = typeConfig[item.type];
          return (
            <div key={item.id} className="flex items-start gap-3 px-5 py-3">
              <div className={cn('mt-0.5 flex-shrink-0', cfg.className)}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{item.message}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground">{item.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Dashboard Page
// ============================================================

export function DashboardClient(): React.ReactElement {
  const [alertDetail, setAlertDetail] = useState<Alert | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [stoppedAlerts, setStoppedAlerts] = useState<Set<string>>(new Set());

  function handleStopCampaign(alert: Alert): void {
    // Mock: trpc.emergency.stopCampaign would be called here
    setStoppedAlerts((prev) => new Set([...prev, alert.id]));
  }

  function handleDismissAlert(alert: Alert): void {
    setDismissedAlerts((prev) => new Set([...prev, alert.id]));
  }

  const visibleAlerts = MOCK_ALERTS.filter(
    (a) => !dismissedAlerts.has(a.id) && !stoppedAlerts.has(a.id),
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          おはようございます
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          本日のマーケティング状況をお知らせします
        </p>
      </div>

      {/* Alert Banner */}
      <AlertBanner alerts={visibleAlerts} onViewDetail={setAlertDetail} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_KPI.map((card) => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* Main content: Campaign Health + AI Insights */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: Campaign Health Grid */}
        <div className="xl:col-span-2 space-y-6">
          {/* Campaign Health Grid */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">キャンペーンヘルス</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MOCK_CAMPAIGN_HEALTH.map((campaign) => (
                <CampaignHealthCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </div>

          {/* Budget Pacing */}
          <BudgetPacingBar pacing={MOCK_BUDGET_PACING} />

          {/* Active A/B Tests */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FlaskConical size={18} className="text-purple-500" />
              <h2 className="text-lg font-semibold text-foreground">アクティブA/Bテスト</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MOCK_AB_TESTS.map((test) => (
                <AbTestCard key={test.id} test={test} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Insights */}
        <div>
          <AiInsightsPanel insights={MOCK_AI_INSIGHTS} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={MOCK_ACTIVITY} />

      {/* Alert detail modal */}
      {alertDetail && (
        <AlertDetailModal
          alert={alertDetail}
          onClose={() => setAlertDetail(null)}
          onStopCampaign={handleStopCampaign}
          onDismiss={handleDismissAlert}
        />
      )}
    </div>
  );
}
