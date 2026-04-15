'use client';

import { memo } from 'react';
import { RotateCcw, Shield, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  COUNTER_ACTION_CONFIG,
  COUNTER_STATUS_CONFIG,
} from '../_constants';
import type { CounterAction } from '../_types';

const RISK_COLOR_MAP: Record<CounterAction['risk'], string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-green-600 dark:text-green-400',
};

const RISK_LABEL_KEY_MAP: Record<CounterAction['risk'], string> = {
  high: 'competitors.riskHigh',
  medium: 'competitors.riskMedium',
  low: 'competitors.riskLow',
};

interface CounterActionCardProps {
  action: CounterAction;
}

function CounterActionCardInner({
  action,
}: CounterActionCardProps): React.ReactElement {
  const { t } = useI18n();
  const typeConfig = COUNTER_ACTION_CONFIG[action.type];
  const statusConfig = COUNTER_STATUS_CONFIG[action.status];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base">{typeConfig.icon}</span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            typeConfig.badgeClass,
          )}
        >
          {t(typeConfig.labelKey)}
        </span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            statusConfig.badgeClass,
          )}
        >
          {t(statusConfig.labelKey)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {action.timeAgo}
        </span>
      </div>

      {/* Competitor + Campaign */}
      <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
        <span className="font-medium">{action.competitorName}</span>
        <span className="text-muted-foreground">/</span>
        <span>{action.campaignName}</span>
      </div>

      {/* Reasoning */}
      <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
        {action.reasoning}
      </blockquote>

      {/* Confidence + Risk */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs">
          <Target size={10} className="text-primary" />
          {t('competitors.confidence')}: {action.confidence}%
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            RISK_COLOR_MAP[action.risk],
          )}
        >
          <Shield size={10} />
          {t('competitors.risk')}: {t(RISK_LABEL_KEY_MAP[action.risk])}
        </span>
      </div>

      {/* Action detail */}
      <div className="mt-2 rounded bg-muted/50 px-3 py-2 text-xs text-foreground">
        {action.actionDetail}
      </div>

      {/* Result */}
      {action.result !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
          <TrendingUp size={12} />
          {t('competitors.result')}: {action.result}
        </div>
      )}

      {/* Rollback button */}
      {action.status === 'executed' && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={10} />
          {t('competitors.rollback')}
        </button>
      )}
    </div>
  );
}

export const CounterActionCard = memo(CounterActionCardInner);
