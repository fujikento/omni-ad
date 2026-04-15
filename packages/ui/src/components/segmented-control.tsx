import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../utils.js';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | string;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  /** Optional aria-label describing the control. */
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Compact segmented toggle for exclusive selection (e.g. status filters).
 * Active segment has an elevated white surface; inactive segments stay muted.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
  size = 'md',
}: SegmentedControlProps<T>): React.ReactElement {
  const sizeClasses =
    size === 'sm'
      ? 'h-7 p-0.5 text-[11px]'
      : 'h-8 p-0.5 text-xs';
  const buttonSizeClasses = size === 'sm' ? 'h-6 px-2.5' : 'h-7 px-3';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted/60',
        sizeClasses,
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <SegmentButton
            key={option.value}
            active={active}
            onClick={() => onValueChange(option.value)}
            className={buttonSizeClasses}
            role="radio"
            aria-checked={active}
          >
            <span className={cn(active ? 'text-foreground' : 'text-muted-foreground')}>
              {option.label}
            </span>
            {option.count !== undefined && (
              <span
                className={cn(
                  'ml-1 tabular-nums',
                  active ? 'text-muted-foreground' : 'text-muted-foreground/70',
                )}
              >
                {option.count}
              </span>
            )}
          </SegmentButton>
        );
      })}
    </div>
  );
}

interface SegmentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

const SegmentButton = forwardRef<HTMLButtonElement, SegmentButtonProps>(
  ({ className, active, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        active
          ? 'bg-card shadow-xs ring-1 ring-border/70'
          : 'hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
SegmentButton.displayName = 'SegmentButton';
