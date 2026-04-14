'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  FlaskConical,
  Lightbulb,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader, StatCard } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type CycleStepStatus = 'active' | 'completed' | 'waiting';
type NextGenStatus = 'generating' | 'completed' | 'deployed';

interface CycleStep {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  status: CycleStepStatus;
  count: number;
}

interface OptimizationCampaign {
  id: string;
  name: string;
  activeVariants: number;
  killedVariants: number;
  winners: number;
  nextGenEta: string;
  trendData: Array<{ day: string; value: number }>;
}

interface WinningPattern {
  id: string;
  description: string;
  platform: string;
  category: string;
  liftPercent: number;
  sampleSize: number;
}

interface NextGenBatch {
  id: string;
  name: string;
  variantCount: number;
  basedOn: string;
  status: NextGenStatus;
  createdAt: string;
}

// ============================================================
// Constants
// ============================================================

const CYCLE_STEPS: CycleStep[] = [
  { id: 'generate', labelKey: 'creativeOptimization.cycleGenerate', icon: <Sparkles size={16} />, status: 'completed', count: 120 },
  { id: 'test', labelKey: 'creativeOptimization.cycleTest', icon: <FlaskConical size={16} />, status: 'active', count: 48 },
  { id: 'analyze', labelKey: 'creativeOptimization.cycleAnalyze', icon: <BarChart3 size={16} />, status: 'active', count: 24 },
  { id: 'learn', labelKey: 'creativeOptimization.cycleLearn', icon: <Brain size={16} />, status: 'completed', count: 8 },
  { id: 'regenerate', labelKey: 'creativeOptimization.cycleRegenerate', icon: <RefreshCw size={16} />, status: 'waiting', count: 0 },
];

function getMockCampaigns(t: (key: string, params?: Record<string, string | number>) => string): OptimizationCampaign[] {
  return [
  {
    id: 'oc1',
    name: t('creatives.optimization.hc1d2a8'),
    activeVariants: 12,
    killedVariants: 8,
    winners: 3,
    nextGenEta: t('creatives.optimization.hbb787b'),
    trendData: [
      { day: '3/27', value: 2.1 }, { day: '3/28', value: 2.4 }, { day: '3/29', value: 2.8 },
      { day: '3/30', value: 3.1 }, { day: '3/31', value: 2.9 }, { day: '4/1', value: 3.5 }, { day: '4/2', value: 3.8 },
    ],
  },
  {
    id: 'oc2',
    name: t('creatives.optimization.h430222'),
    activeVariants: 8,
    killedVariants: 4,
    winners: 2,
    nextGenEta: t('creatives.optimization.h10cc68'),
    trendData: [
      { day: '3/27', value: 1.5 }, { day: '3/28', value: 1.8 }, { day: '3/29', value: 2.0 },
      { day: '3/30', value: 2.2 }, { day: '3/31', value: 2.5 }, { day: '4/1', value: 2.7 }, { day: '4/2', value: 3.0 },
    ],
  },
  {
    id: 'oc3',
    name: t('creatives.optimization.h0b1979'),
    activeVariants: 16,
    killedVariants: 12,
    winners: 4,
    nextGenEta: t('creatives.optimization.h6b2dfe'),
    trendData: [
      { day: '3/27', value: 1.2 }, { day: '3/28', value: 1.6 }, { day: '3/29', value: 1.9 },
      { day: '3/30', value: 2.3 }, { day: '3/31', value: 2.8 }, { day: '4/1', value: 3.2 }, { day: '4/2', value: 3.6 },
    ],
  },
];
}

function getMockPatterns(t: (key: string, params?: Record<string, string | number>) => string): WinningPattern[] {
  return [
  { id: 'wp1', description: t('creatives.optimization.h38f489'), platform: 'Meta', category: t('creatives.optimization.h53b4b8'), liftPercent: 34, sampleSize: 12400 },
  { id: 'wp2', description: t('creatives.optimization.h0219a9'), platform: 'TikTok', category: t('creatives.optimization.h5976ec'), liftPercent: 28, sampleSize: 8500 },
  { id: 'wp3', description: t('creatives.optimization.h4be29d'), platform: 'Google', category: t('creatives.optimization.hfc0d49'), liftPercent: 22, sampleSize: 45000 },
  { id: 'wp4', description: t('creatives.optimization.ha1a545'), platform: 'LINE', category: t('creatives.optimization.hfb9603'), liftPercent: 18, sampleSize: 15200 },
  { id: 'wp5', description: t('creatives.optimization.h9f8454'), platform: 'Meta', category: t('creatives.optimization.hbd0154'), liftPercent: 15, sampleSize: 22000 },
  { id: 'wp6', description: t('creatives.optimization.hd11b3c'), platform: 'Meta', category: t('creatives.optimization.h874834'), liftPercent: 41, sampleSize: 9800 },
  { id: 'wp7', description: t('creatives.optimization.h212ba7'), platform: 'Google', category: 'SaaS', liftPercent: 26, sampleSize: 31000 },
  { id: 'wp8', description: t('creatives.optimization.h1ba3df'), platform: 'X', category: t('creatives.optimization.hc9e6bc'), liftPercent: 19, sampleSize: 18000 },
];
}

function getMockNextGen(t: (key: string, params?: Record<string, string | number>) => string): NextGenBatch[] {
  return [
  { id: 'ng1', name: t('creatives.optimization.he34fc4'), variantCount: 15, basedOn: t('creatives.optimization.hc10365'), status: 'generating', createdAt: '2026-04-02 10:30' },
  { id: 'ng2', name: t('creatives.optimization.h7bd4e5'), variantCount: 10, basedOn: t('creatives.optimization.h72b995'), status: 'completed', createdAt: '2026-04-02 08:15' },
];
}

const STATUS_CONFIG: Record<NextGenStatus, { labelKey: string; className: string }> = {
  generating: {
    labelKey: 'creativeOptimization.statusGenerating',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  completed: {
    labelKey: 'creativeOptimization.statusCompleted',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  deployed: {
    labelKey: 'creativeOptimization.statusDeployed',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

const PLATFORM_COLORS: Record<string, string> = {
  Meta: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Google: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  TikTok: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  LINE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  X: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ============================================================
// Subcomponents
// ============================================================

function CycleVisualization({ steps }: { steps: CycleStep[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">
        {t('creativeOptimization.cycleTitle')}
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-4 py-3 transition-colors',
                step.status === 'active'
                  ? 'border-primary bg-primary/5'
                  : step.status === 'completed'
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-border bg-card',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  step.status === 'active'
                    ? 'bg-primary text-primary-foreground'
                    : step.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {step.icon}
              </div>
              <span className="text-xs font-medium text-foreground">{t(step.labelKey)}</span>
              {step.count > 0 && (
                <span className="text-[10px] text-muted-foreground">{step.count}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight size={16} className="text-muted-foreground" />
            )}
          </div>
        ))}
        {/* Loop arrow */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <RefreshCw size={14} />
        </div>
      </div>
    </div>
  );
}

function SparklineChart({ data }: { data: Array<{ day: string; value: number }> }): React.ReactElement {
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: OptimizationCampaign[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          {t('creativeOptimization.activeCampaigns')}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.campaignName')}
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.activeVariants')}
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.killedVariants')}
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.winners')}
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.trend')}
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                {t('creativeOptimization.nextGenEta')}
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-foreground">{campaign.name}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                    {campaign.activeVariants}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {campaign.killedVariants}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-green-100 px-2 text-xs font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    {campaign.winners}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <SparklineChart data={campaign.trendData} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-muted-foreground">{campaign.nextGenEta}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WinningPatternsPanel({ patterns }: { patterns: WinningPattern[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <h2 className="text-base font-semibold text-foreground">
            {t('creativeOptimization.winningPatterns')}
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('creativeOptimization.winningPatternsDesc')}
        </p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {patterns.map((pattern) => (
          <div
            key={pattern.id}
            className="rounded-lg border border-border p-3 transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  PLATFORM_COLORS[pattern.platform] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {pattern.platform}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {pattern.category}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{pattern.description}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-green-500" />
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  +{pattern.liftPercent}%
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                n={pattern.sampleSize.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NextGenQueue({ batches }: { batches: NextGenBatch[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            {t('creativeOptimization.nextGenQueue')}
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('creativeOptimization.nextGenQueueDesc')}
        </p>
      </div>
      <div className="divide-y divide-border">
        {batches.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t('creativeOptimization.noNextGen')}
          </div>
        ) : (
          batches.map((batch) => {
            const statusConfig = STATUS_CONFIG[batch.status];
            return (
              <div key={batch.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{batch.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {batch.variantCount} {t('creativeOptimization.variants')}
                    </span>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">{batch.basedOn}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">{batch.createdAt}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      statusConfig.className,
                    )}
                  >
                    {batch.status === 'generating' && (
                      <Loader2 size={10} className="animate-spin" />
                    )}
                    {t(statusConfig.labelKey)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CreativeOptimizationPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/creatives"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            Creatives
          </Link>
        }
        title={t('creativeOptimization.title')}
        description={t('creativeOptimization.description')}
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { labelKey: 'creativeOptimization.kpiTotalVariants', value: '156', icon: <Target size={16} />, color: 'text-primary' },
          { labelKey: 'creativeOptimization.kpiActiveTests', value: '36', icon: <FlaskConical size={16} />, color: 'text-info' },
          { labelKey: 'creativeOptimization.kpiWinners', value: '9', icon: <Trophy size={16} />, color: 'text-warning' },
          { labelKey: 'creativeOptimization.kpiPatterns', value: '8', icon: <Lightbulb size={16} />, color: 'text-success' },
        ].map((kpi) => (
          <StatCard
            key={kpi.labelKey}
            label={t(kpi.labelKey)}
            value={kpi.value}
            icon={<span className={kpi.color}>{kpi.icon}</span>}
          />
        ))}
      </div>

      {/* Cycle visualization */}
      <CycleVisualization steps={CYCLE_STEPS} />

      {/* Active campaigns table */}
      <CampaignTable campaigns={getMockCampaigns(t)} />

      {/* Winning patterns */}
      <WinningPatternsPanel patterns={getMockPatterns(t)} />

      {/* Next gen queue */}
      <NextGenQueue batches={getMockNextGen(t)} />
    </div>
  );
}
