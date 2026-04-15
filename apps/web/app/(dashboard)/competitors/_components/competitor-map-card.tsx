'use client';

import { memo } from 'react';
import {
  Clock,
  ExternalLink,
  Globe,
  Settings,
  Trash2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Competitor } from '../_types';
import { PlatformIcons, StrategyBadge } from './strategy-badge';

interface CompetitorMapCardProps {
  competitor: Competitor;
  onSettings: (id: string) => void;
  onDelete: (id: string) => void;
}

function CompetitorMapCardInner({
  competitor,
  onSettings,
  onDelete,
}: CompetitorMapCardProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {competitor.name}
            </h3>
            {competitor.active && (
              <span
                className="inline-flex h-2 w-2 rounded-full bg-green-500"
                title={t('competitors.active')}
              />
            )}
          </div>
          <a
            href={`https://${competitor.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Globe size={10} />
            {competitor.domain}
            <ExternalLink size={10} />
          </a>
        </div>
        <StrategyBadge strategy={competitor.strategy} />
      </div>

      <div className="mt-3">
        <PlatformIcons platforms={competitor.platforms} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">
            {t('competitors.adCount')}
          </p>
          <p className="text-lg font-bold text-foreground">
            {competitor.adCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">
            {t('competitors.estimatedBudget')}
          </p>
          <p className="text-lg font-bold text-foreground">
            {(competitor.estimatedMonthlyBudget / 10000).toFixed(0)}
            {t('competitors.tenThousandUnit')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">
            {t('competitors.overlapRate')}
          </p>
          <p className="text-lg font-bold text-foreground">
            {competitor.overlapRate}%
          </p>
        </div>
      </div>

      <div className="mt-3 rounded bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <Clock size={10} className="mr-1 inline" />
          {competitor.latestActivityTime}: {competitor.latestActivity}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/competitors/${competitor.id}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('competitors.detail')}
        </a>
        <button
          type="button"
          onClick={() => onSettings(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${competitor.name} ${t('competitors.settings')}`}
        >
          <Settings size={12} className="mr-1 inline" />
          {t('competitors.settings')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
          aria-label={`${competitor.name} ${t('common.delete')}`}
        >
          <Trash2 size={12} className="mr-1 inline" />
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

export const CompetitorMapCard = memo(CompetitorMapCardInner);
