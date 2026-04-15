import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils.js';

/**
 * A vertical timeline container. Renders a continuous 1px connector line on the
 * left; each TimelineItem punches through with a ringed dot. Use for activity
 * feeds, live logs, or any ordered event list where chronology matters.
 */
export const Timeline = forwardRef<HTMLOListElement, HTMLAttributes<HTMLOListElement>>(
  ({ className, children, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn('relative flex flex-col', className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[7px] top-2 bottom-2 w-px bg-border"
      />
      {children}
    </ol>
  ),
);
Timeline.displayName = 'Timeline';

const timelineDotVariants = cva(
  'relative z-10 mt-1 h-[14px] w-[14px] shrink-0 rounded-full ring-[3px] ring-background',
  {
    variants: {
      tone: {
        success: 'bg-success',
        destructive: 'bg-destructive',
        warning: 'bg-warning',
        primary: 'bg-primary',
        muted: 'bg-muted-foreground/60',
        info: 'bg-info',
      },
    },
    defaultVariants: {
      tone: 'muted',
    },
  },
);

export interface TimelineItemProps
  extends HTMLAttributes<HTMLLIElement>,
    VariantProps<typeof timelineDotVariants> {
  /** Node rendered inside the dot (e.g. tiny icon). If omitted, dot is solid. */
  dotContent?: ReactNode;
}

export const TimelineItem = forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ className, tone, dotContent, children, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('flex gap-3 py-2.5 first:pt-0 last:pb-0', className)}
      {...props}
    >
      <span
        className={cn(
          timelineDotVariants({ tone }),
          dotContent && 'flex items-center justify-center h-6 w-6 ring-background',
        )}
        aria-hidden={!dotContent}
      >
        {dotContent}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  ),
);
TimelineItem.displayName = 'TimelineItem';
