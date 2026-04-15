'use client';

import { memo } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { KpiCardInput } from '../_types';

interface KpiCardRowProps {
  cards: KpiCardInput[];
}

function KpiCardRowInner({ cards }: KpiCardRowProps): React.ReactElement {
  const { t } = useI18n();

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart3 size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.labelKey}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {t(card.labelKey)}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {card.value}
              {card.valueKey ? t(card.valueKey) : ''}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                card.trendPositive ? 'text-green-600' : 'text-red-600',
              )}
            >
              {card.trendPositive ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {card.trendKey
                ? t(card.trendKey, { count: card.trend })
                : card.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const KpiCardRow = memo(KpiCardRowInner);
