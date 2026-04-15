'use client';

import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@omni-ad/ui';

export interface AnomalyBadgeProps {
  zScore: number;
  baselineLabel?: string;
}

/**
 * Small warning pill surfaced next to any metric whose trailing 6-month
 * z-score exceeds |2|. Shows a native tooltip with the z-score and the
 * baseline window so analysts can quickly triage the flag.
 */
function AnomalyBadgeImpl({
  zScore,
  baselineLabel = '6mo baseline',
}: AnomalyBadgeProps): React.ReactElement {
  const sign = zScore >= 0 ? '+' : '-';
  const abs = Math.abs(zScore).toFixed(2);
  const title = `z = ${sign}${abs} vs ${baselineLabel}`;

  return (
    <span title={title} aria-label={title} className="inline-flex align-middle">
      <Badge variant="warning" size="sm" className="h-4 gap-0.5 px-1 leading-none">
        <AlertTriangle aria-hidden="true" className="h-2.5 w-2.5" />
        <span className="tabular-nums">{`${sign}${abs}`}</span>
      </Badge>
    </span>
  );
}

export const AnomalyBadge = memo(AnomalyBadgeImpl);
AnomalyBadge.displayName = 'AnomalyBadge';
