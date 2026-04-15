'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  FlaskConical,
  Inbox,
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
import { trpc } from '@/lib/trpc';
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

// UI enumeration for the generate → test → analyze → learn → regenerate loop.
// Counts and statuses start empty and should be updated from live API state.
const CYCLE_STEPS: CycleStep[] = [
  { id: 'generate', labelKey: 'creativeOptimization.cycleGenerate', icon: <Sparkles size={16} />, status: 'waiting', count: 0 },
  { id: 'test', labelKey: 'creativeOptimization.cycleTest', icon: <FlaskConical size={16} />, status: 'waiting', count: 0 },
  { id: 'analyze', labelKey: 'creativeOptimization.cycleAnalyze', icon: <BarChart3 size={16} />, status: 'waiting', count: 0 },
  { id: 'learn', labelKey: 'creativeOptimization.cycleLearn', icon: <Brain size={16} />, status: 'waiting', count: 0 },
  { id: 'regenerate', labelKey: 'creativeOptimization.cycleRegenerate', icon: <RefreshCw size={16} />, status: 'waiting', count: 0 },
];

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
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
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
      )}
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
      {patterns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Trophy size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
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
      )}
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

  const creativesQuery = trpc.creatives.list.useQuery(undefined, { retry: false });
  const creativesCount = ((creativesQuery.data as unknown[] | undefined) ?? []).length;

  // These datasets will come from dedicated optimization endpoints in the
  // future. Until then, start empty and let each section render an empty
  // state so we never surface placeholder numbers in production.
  const campaigns: OptimizationCampaign[] = [];
  const patterns: WinningPattern[] = [];
  const batches: NextGenBatch[] = [];

  const kpiCards: { labelKey: string; value: string; icon: React.ReactNode; color: string }[] = [
    { labelKey: 'creativeOptimization.kpiTotalVariants', value: String(creativesCount), icon: <Target size={16} />, color: 'text-primary' },
    { labelKey: 'creativeOptimization.kpiActiveTests', value: '0', icon: <FlaskConical size={16} />, color: 'text-info' },
    { labelKey: 'creativeOptimization.kpiWinners', value: '0', icon: <Trophy size={16} />, color: 'text-warning' },
    { labelKey: 'creativeOptimization.kpiPatterns', value: '0', icon: <Lightbulb size={16} />, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/creatives"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            {t('nav.creatives')}
          </Link>
        }
        title={t('creativeOptimization.title')}
        description={t('creativeOptimization.description')}
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
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
      <CampaignTable campaigns={campaigns} />

      {/* Winning patterns */}
      <WinningPatternsPanel patterns={patterns} />

      {/* Next gen queue */}
      <NextGenQueue batches={batches} />
    </div>
  );
}
