'use client';

import { memo } from 'react';
import { Sparkline, type SparklineTone } from '@omni-ad/ui';
import { AnomalyBadge } from './anomaly-badge';

export interface StageCellProps {
  /** Primary display value (formatted string, e.g. "1,234" or "¥4,560"). */
  formatted: string;
  /** Trailing-6 history for the inline sparkline (oldest → newest). */
  trailing: number[];
  /** When present, renders a warning badge with the z-score. */
  anomalyZ?: number;
  /** Optional tone override (defaults to muted). */
  tone?: SparklineTone;
  /** Right-align tabular numbers — most cost/rate columns need this. */
  align?: 'left' | 'right';
}

/**
 * A numeric pivot-table cell with an inline trailing-6 sparkline and an
 * optional anomaly badge. Kept deliberately small so the memo boundary is
 * cheap — each month has up to 14 of these.
 */
function StageCellImpl({
  formatted,
  trailing,
  anomalyZ,
  tone = 'muted',
  align = 'right',
}: StageCellProps): React.ReactElement {
  return (
    <div
      className={
        align === 'right'
          ? 'flex items-center justify-end gap-1.5 whitespace-nowrap'
          : 'flex items-center gap-1.5 whitespace-nowrap'
      }
    >
      <span className="tabular-nums text-foreground">{formatted}</span>
      {trailing.length > 1 ? (
        <Sparkline
          points={trailing}
          tone={anomalyZ !== undefined ? 'warning' : tone}
          width={36}
          height={12}
          strokeWidth={1.25}
          className="shrink-0 opacity-70"
        />
      ) : null}
      {anomalyZ !== undefined ? <AnomalyBadge zScore={anomalyZ} /> : null}
    </div>
  );
}

export const StageCell = memo(StageCellImpl);
StageCell.displayName = 'StageCell';
