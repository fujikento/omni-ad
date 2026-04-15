import { type SVGProps } from 'react';
import { cn } from '../utils.js';

export type SparklineTone = 'success' | 'destructive' | 'warning' | 'primary' | 'muted' | 'info';

export interface SparklineProps extends Omit<SVGProps<SVGSVGElement>, 'points'> {
  /** Raw data points. Will be normalized to fit the viewBox. */
  points: number[];
  /** Color tone — maps to semantic tokens. */
  tone?: SparklineTone;
  /** Rendered width in px. */
  width?: number;
  /** Rendered height in px. */
  height?: number;
  /** Stroke thickness. */
  strokeWidth?: number;
}

const TONE_CLASS: Record<SparklineTone, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  primary: 'text-primary',
  muted: 'text-muted-foreground',
  info: 'text-info',
};

function normalizePath(points: number[], viewW: number, viewH: number): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    const mid = viewH / 2;
    return `M0,${mid} L${viewW},${mid}`;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = viewW / (points.length - 1);

  return points
    .map((value, index) => {
      const x = index * step;
      const y = viewH - ((value - min) / range) * viewH;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function Sparkline({
  points,
  tone = 'muted',
  width = 60,
  height = 20,
  strokeWidth = 1.5,
  className,
  ...props
}: SparklineProps): React.ReactElement {
  const viewW = 60;
  const viewH = 20;
  const d = normalizePath(points, viewW, viewH);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${viewW} ${viewH}`}
      fill="none"
      preserveAspectRatio="none"
      className={cn(TONE_CLASS[tone], className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
