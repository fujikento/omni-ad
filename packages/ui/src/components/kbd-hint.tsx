import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../utils.js';

export interface KbdHintProps extends HTMLAttributes<HTMLElement> {
  /** Pass modifier + key as children, e.g. <KbdHint>⌘ K</KbdHint>. */
  /** Visual weight. "subtle" is for in-context hints; "strong" for primary buttons. */
  tone?: 'subtle' | 'strong' | 'inverse';
}

/**
 * Small inline keyboard shortcut pill. Render next to inputs ("⌘K" search),
 * buttons ("A" to approve), or menu items.
 */
export const KbdHint = forwardRef<HTMLElement, KbdHintProps>(
  ({ className, tone = 'subtle', children, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'inline-flex h-4 min-w-[16px] items-center justify-center rounded border px-1 font-sans text-[10px] font-medium leading-none tabular-nums',
        tone === 'subtle' && 'border-border bg-muted/60 text-muted-foreground',
        tone === 'strong' && 'border-border bg-card text-foreground shadow-xs',
        tone === 'inverse' && 'border-white/15 bg-white/10 text-white/70',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  ),
);
KbdHint.displayName = 'KbdHint';
