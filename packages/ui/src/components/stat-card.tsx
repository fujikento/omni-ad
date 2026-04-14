import { type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../utils.js';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Percentage delta (e.g. 12.4 for +12.4%). Sign determines arrow direction. */
  delta?: number;
  /**
   * Whether a positive delta is "good" (green) or "bad" (red). For cost /
   * spend metrics, a rise is typically negative, so set to 'inverse'.
   */
  deltaTone?: 'positive-good' | 'inverse';
  deltaLabel?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaTone = 'positive-good',
  deltaLabel,
  icon,
  children,
  className,
}: StatCardProps): React.ReactElement {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && delta > 0;
  const negative = hasDelta && delta < 0;
  const neutral = hasDelta && delta === 0;

  const goodDirection = deltaTone === 'positive-good' ? positive : negative;
  const badDirection = deltaTone === 'positive-good' ? negative : positive;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-xs transition-colors hover:border-border/80',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </div>

      {hasDelta ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium tabular-nums',
              goodDirection && 'bg-success/10 text-success',
              badDirection && 'bg-destructive/10 text-destructive',
              neutral && 'bg-muted text-muted-foreground',
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            ) : negative ? (
              <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Minus className="h-3 w-3" aria-hidden="true" />
            )}
            {formatDelta(delta)}
          </span>
          {deltaLabel ? (
            <span className="text-muted-foreground">{deltaLabel}</span>
          ) : null}
        </div>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
