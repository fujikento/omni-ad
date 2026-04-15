'use client';

import { memo } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CounterAction } from '../_types';
import { CounterActionCard } from './counter-action-card';

interface CounterActionTimelineProps {
  actions: CounterAction[];
  expanded: boolean;
  onToggle: () => void;
}

function CounterActionTimelineInner({
  actions,
  expanded,
  onToggle,
}: CounterActionTimelineProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.counterLog')}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('competitors.counterLogCount', { count: actions.length })}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={20} className="text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-6 pb-6">
          {actions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Zap size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t('common.noData')}
              </p>
            </div>
          ) : (
            actions.map((action) => (
              <CounterActionCard key={action.id} action={action} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const CounterActionTimeline = memo(CounterActionTimelineInner);
