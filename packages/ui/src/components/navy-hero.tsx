import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../utils.js';

export interface NavyHeroProps extends HTMLAttributes<HTMLElement> {
  /** Adds a subtle radial blue glow behind the content (primary color at low opacity). */
  ambientGlow?: boolean;
  /** Adds a faint dot-grid overlay for a technical aesthetic. */
  gridOverlay?: boolean;
}

/**
 * Dark navy accent surface for identity-defining moments (hero KPIs, mission-control
 * state). Uses `bg-sidebar` so it stays in sync with the existing token system.
 */
export const NavyHero = forwardRef<HTMLElement, NavyHeroProps>(
  ({ className, ambientGlow = false, gridOverlay = false, children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-lg border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm',
        className,
      )}
      {...props}
    >
      {ambientGlow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/4 left-1/2 h-full w-4/5 -translate-x-1/2"
          style={{
            background:
              'radial-gradient(ellipse at top, hsl(var(--primary) / 0.18) 0%, transparent 60%)',
          }}
        />
      ) : null}
      {gridOverlay ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </section>
  ),
);
NavyHero.displayName = 'NavyHero';

export interface NavyHeroCellProps extends HTMLAttributes<HTMLDivElement> {
  /** Render a vertical divider on the left side to separate cells in a horizontal row. */
  divider?: boolean;
}

/**
 * A cell for use inside a NavyHero — typically one KPI in a horizontal row.
 */
export const NavyHeroCell = forwardRef<HTMLDivElement, NavyHeroCellProps>(
  ({ className, divider = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-2 px-6 py-5',
        divider && 'border-l border-white/10',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
NavyHeroCell.displayName = 'NavyHeroCell';
