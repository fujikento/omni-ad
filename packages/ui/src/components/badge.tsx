import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-4',
  {
    variants: {
      variant: {
        neutral:
          'bg-muted text-muted-foreground',
        primary:
          'bg-primary/10 text-primary',
        success:
          'bg-success/10 text-success',
        warning:
          'bg-warning/15 text-warning',
        destructive:
          'bg-destructive/10 text-destructive',
        info:
          'bg-info/10 text-info',
        outline:
          'border border-border bg-card text-muted-foreground',
      },
      size: {
        sm: 'h-5 px-1.5 text-[10px] leading-none',
        md: 'h-6 px-2',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotClassName?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, dotClassName, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot ? (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-current',
            dotClassName,
          )}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

export { badgeVariants };
