import { memo } from 'react';
import { StatCard } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import {
  METRIC_CONFIG,
  STATUS_CONFIG,
  TEST_TYPE_CONFIG,
  type MetricType,
  type TestStatus,
  type TestType,
} from '../_types';

export const StatusBadge = memo(function StatusBadge({ status }: { status: TestStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
});

export const MetricBadge = memo(function MetricBadge({ metric }: { metric: MetricType }): React.ReactElement {
  const config = METRIC_CONFIG[metric];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {config.label}
    </span>
  );
});

export const TypeBadge = memo(function TypeBadge({ testType }: { testType: TestType }): React.ReactElement {
  const { t } = useI18n();
  const config = TEST_TYPE_CONFIG[testType];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
});

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
}

export const KPICard = memo(function KPICard({ label, value, icon, trend }: KPICardProps): React.ReactElement {
  return (
    <StatCard
      label={label}
      value={value}
      icon={<span className="text-muted-foreground/70">{icon}</span>}
    >
      {trend ? <p className="text-xs text-muted-foreground">{trend}</p> : null}
    </StatCard>
  );
});

export const MiniProgressBar = memo(function MiniProgressBar({ current, total }: { current: number; total: number }): React.ReactElement {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground">
        {(current / 1000).toFixed(1)}K
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">
        / {(total / 1000).toFixed(0)}K
      </span>
    </div>
  );
});

export const SignificanceCell = memo(function SignificanceCell({ significance }: { significance: number }): React.ReactElement {
  const color = significance >= 95
    ? 'text-success'
    : significance >= 80
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-muted-foreground';

  return (
    <span className={cn('text-sm font-semibold', color)}>
      {significance.toFixed(1)}%
    </span>
  );
});
