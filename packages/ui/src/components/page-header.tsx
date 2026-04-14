import { type ReactNode } from 'react';
import { cn } from '../utils.js';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
