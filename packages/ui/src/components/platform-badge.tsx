import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Platform,
  PLATFORM_BRAND_COLORS,
  PLATFORM_SHORT_NAMES,
} from '@omni-ad/shared';
import { PlatformIcon } from './platform-icon.js';
import { cn } from '../utils.js';

const platformBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-xs font-medium transition-colors',
  {
    variants: {
      size: {
        sm: 'h-6 px-1.5',
        md: 'h-7 px-2',
      },
      variant: {
        default: 'text-foreground',
        subtle: 'border-transparent bg-muted/60 text-muted-foreground',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  },
);

export interface PlatformBadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof platformBadgeVariants> {
  platform: Platform;
  /** When false, render logo + colored dot only (no label). */
  showLabel?: boolean;
}

export const PlatformBadge = forwardRef<HTMLSpanElement, PlatformBadgeProps>(
  (
    {
      platform,
      size = 'md',
      variant = 'default',
      showLabel = true,
      className,
      ...props
    },
    ref,
  ) => {
    const iconSize = size === 'sm' ? 12 : 14;
    const label = PLATFORM_SHORT_NAMES[platform];
    const brandColor = PLATFORM_BRAND_COLORS[platform];

    return (
      <span
        ref={ref}
        className={cn(platformBadgeVariants({ size, variant, className }))}
        {...props}
      >
        <PlatformIcon platform={platform} size={iconSize} />
        {showLabel ? (
          <>
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: brandColor }}
              aria-hidden="true"
            />
            <span>{label}</span>
          </>
        ) : (
          <span className="sr-only">{label}</span>
        )}
      </span>
    );
  },
);
PlatformBadge.displayName = 'PlatformBadge';
