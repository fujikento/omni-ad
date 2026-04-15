'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { PLATFORM_CONFIG, STRATEGY_CONFIG } from '../_constants';
import type { CompetitorStrategy, Platform } from '../_types';

function StrategyBadgeInner({
  strategy,
}: {
  strategy: CompetitorStrategy;
}): React.ReactElement {
  const { t } = useI18n();
  const config = STRATEGY_CONFIG[strategy];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        config.badgeClass,
      )}
    >
      {t(config.labelKey)}
    </span>
  );
}

export const StrategyBadge = memo(StrategyBadgeInner);

function PlatformIconsInner({
  platforms,
}: {
  platforms: Platform[];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-white',
            PLATFORM_CONFIG[p].color,
          )}
          title={PLATFORM_CONFIG[p].label}
        >
          {PLATFORM_CONFIG[p].label}
        </span>
      ))}
    </div>
  );
}

export const PlatformIcons = memo(PlatformIconsInner);
