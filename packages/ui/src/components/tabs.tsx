import { type ReactNode } from 'react';
import { cn } from '../utils.js';

export interface TabItem {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (key: string) => void;
  className?: string;
  variant?: 'default' | 'pill';
}

export function Tabs({
  items,
  value,
  onValueChange,
  className,
  variant = 'default',
}: TabsProps): React.ReactElement {
  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1',
          className,
        )}
      >
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onValueChange(item.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
                item.disabled && 'opacity-50',
              )}
            >
              {item.label}
              {item.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-border',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onValueChange(item.key)}
            className={cn(
              'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
              item.disabled && 'opacity-50',
            )}
          >
            {item.label}
            {item.badge}
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
