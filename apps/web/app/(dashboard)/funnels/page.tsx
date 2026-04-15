'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  BarChart3,
  ChevronDown,
  GripVertical,
  Inbox,
  Loader2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

// -- Types --

type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

interface FunnelStage {
  id: string;
  name: string;
  type: string;
  platforms: Platform[];
  campaigns: { id: string; name: string }[];
  budgetAllocation: number;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    dropOffRate: number;
  };
}

interface Funnel {
  id: string;
  name: string;
  description: string;
  stages: FunnelStage[];
}

// -- Constants --

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  google: 'Google',
  x: 'X',
  tiktok: 'TikTok',
  line_yahoo: 'LINE/Yahoo',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
};

const STAGE_COLORS: Record<string, string> = {
  awareness: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  interest: 'border-purple-500 bg-purple-50 dark:bg-purple-950/30',
  closing: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
  retention: 'border-green-500 bg-green-50 dark:bg-green-950/30',
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  awareness: 'bg-blue-500',
  interest: 'bg-purple-500',
  closing: 'bg-orange-500',
  retention: 'bg-green-500',
};

// -- Subcomponents --

function StageCard({ stage, isLast }: { stage: FunnelStage; isLast: boolean }): React.ReactElement {
  const { t } = useI18n();
  const stageColor = STAGE_COLORS[stage.type] ?? 'border-gray-500 bg-gray-50 dark:bg-gray-950/30';
  const headerColor = STAGE_HEADER_COLORS[stage.type] ?? 'bg-gray-500';

  return (
    <div className="flex flex-col items-center">
      <div className={cn('w-full max-w-lg rounded-lg border-l-4 transition-shadow hover:shadow-md', stageColor)}>
        {/* Stage header */}
        <div className={cn('flex items-center justify-between rounded-tr-lg px-4 py-2', headerColor)}>
          <div className="flex items-center gap-2">
            <GripVertical size={14} className="text-white/70 cursor-grab" />
            <span className="text-sm font-semibold text-white">{stage.name}</span>
          </div>
          <span className="text-xs text-white/80">{t('funnels.budgetAllocation')} {stage.budgetAllocation}%</span>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          {/* Platforms */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('funnels.platform')}</p>
            <div className="flex flex-wrap gap-1">
              {stage.platforms.map((p) => (
                <span key={p} className="rounded bg-background px-2 py-0.5 text-xs font-medium text-foreground shadow-sm">
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          </div>

          {/* Campaigns */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('funnels.campaignsLabel')}</p>
            <div className="space-y-1">
              {stage.campaigns.map((c) => (
                <div key={c.id} className="rounded bg-background px-3 py-1.5 text-xs text-foreground shadow-sm">
                  {c.name}
                </div>
              ))}
              <button
                type="button"
                onClick={() => showToast(t('funnels.addCampaignPreparing'))}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus size={12} />
                {t('funnels.addCampaign')}
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 rounded-md bg-background p-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('metrics.impressions')}</p>
              <p className="text-sm font-semibold text-foreground">
                {(stage.metrics.impressions / 1000).toFixed(0)}K
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('metrics.clicks')}</p>
              <p className="text-sm font-semibold text-foreground">
                {(stage.metrics.clicks / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">CV</p>
              <p className="text-sm font-semibold text-foreground">
                {stage.metrics.conversions > 0 ? stage.metrics.conversions.toLocaleString() : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Drop-off arrow */}
      {!isLast && (
        <div className="flex flex-col items-center py-2">
          <ArrowDown size={20} className="text-muted-foreground" />
          {stage.metrics.dropOffRate > 0 && (
            <span className="text-xs font-medium text-red-500">
              -{stage.metrics.dropOffRate}% {t('funnels.dropOff')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface AutoConstructModalProps {
  open: boolean;
  onClose: () => void;
}

function AutoConstructModal({ open, onClose }: AutoConstructModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [objective, setObjective] = useState<string>('ecommerce_sales');
  const [budget, setBudget] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['google', 'meta']);
  const [isBuilding, setIsBuilding] = useState(false);

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleBuild(): void {
    setIsBuilding(true);
    setTimeout(() => {
      setIsBuilding(false);
      onClose();
    }, 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t('funnels.aiAutoConstruct')}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="funnel-objective" className="mb-1 block text-sm font-medium text-foreground">{t('funnels.objective')}</label>
            <div className="relative">
              <select
                id="funnel-objective"
                value={objective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjective(e.target.value)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ecommerce_sales">{t('funnels.objectiveEcommerce')}</option>
                <option value="lead_generation">{t('funnels.objectiveLeadGen')}</option>
                <option value="app_installs">{t('funnels.objectiveAppInstall')}</option>
                <option value="brand_awareness">{t('funnels.objectiveBrandAwareness')}</option>
                <option value="saas_trial">{t('funnels.objectiveSaasTrial')}</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label htmlFor="funnel-budget" className="mb-1 block text-sm font-medium text-foreground">{t('funnels.monthlyBudget')}</label>
            <input
              id="funnel-budget"
              type="number"
              value={budget}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudget(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="500000"
              min="1"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('funnels.deliveryPlatforms')}</span>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    selectedPlatforms.includes(key)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleBuild}
            disabled={isBuilding || !budget || selectedPlatforms.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t('funnels.build')}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Main Page --

export default function FunnelsPage(): React.ReactElement {
  const { t } = useI18n();
  const [autoConstructOpen, setAutoConstructOpen] = useState(false);

  const funnelsQuery = trpc.funnels.list.useQuery(undefined, { retry: false });

  const funnels = (funnelsQuery.data as Funnel[] | Funnel | undefined);
  const funnel: Funnel | undefined = Array.isArray(funnels) ? funnels[0] : funnels;
  const isLoading = funnelsQuery.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ad Management"
        title={t('funnels.title')}
        description={t('funnels.description')}
        actions={
          <Button
            size="sm"
            leadingIcon={<Sparkles size={14} />}
            onClick={() => setAutoConstructOpen(true)}
          >
            {t('funnels.aiAutoConstruct')}
          </Button>
        }
      />

      {/* Funnel name */}
      {!isLoading && funnel && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{funnel.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{funnel.description}</p>
          </div>
          <Link
            href={`/funnels/${funnel.id}/monthly`}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <BarChart3 size={14} />
            {t('funnels.monthlyReport')}
          </Link>
        </div>
      )}

      {/* Visual funnel */}
      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-48 w-full max-w-lg animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !funnel || funnel.stages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {funnel.stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isLast={index === funnel.stages.length - 1}
            />
          ))}
        </div>
      )}

      {/* Summary metrics */}
      {!isLoading && funnel && funnel.stages.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {funnel.stages.map((stage) => (
            <div key={stage.id} className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">{stage.name}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {(stage.metrics.impressions / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-muted-foreground">{t('metrics.impressions')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Auto construct modal */}
      <AutoConstructModal open={autoConstructOpen} onClose={() => setAutoConstructOpen(false)} />
    </div>
  );
}
