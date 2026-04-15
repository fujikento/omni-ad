import { type ReactNode } from 'react';
import { cn } from '../utils.js';

export interface ErrorStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  icon,
  title,
  description,
  action,
  onRetry,
  retryLabel = '再試行',
  className,
}: ErrorStateProps): React.ReactElement {
  const retryAction = onRetry ? (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {retryLabel}
    </button>
  ) : null;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ?? retryAction ? <div className="pt-1">{action ?? retryAction}</div> : null}
    </div>
  );
}
