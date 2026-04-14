import { type HTMLAttributes } from 'react';
import {
  Platform,
  PLATFORM_SLUGS,
  PLATFORM_DISPLAY_NAMES,
} from '@omni-ad/shared';
import { cn } from '../utils.js';

export interface PlatformIconProps extends HTMLAttributes<HTMLSpanElement> {
  platform: Platform;
  size?: number;
  /**
   * When true, the logo uses currentColor (monochrome) instead of the
   * brand color SVG. Useful inside dense tables or on dark backgrounds.
   */
  monochrome?: boolean;
}

const ASSET_BASE = '/platforms';

export function PlatformIcon({
  platform,
  size = 16,
  monochrome = false,
  className,
  style,
  ...props
}: PlatformIconProps): React.ReactElement {
  const slug = PLATFORM_SLUGS[platform];
  const label = PLATFORM_DISPLAY_NAMES[platform];

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <img
        src={`${ASSET_BASE}/${slug}.svg`}
        alt=""
        width={size}
        height={size}
        className={cn(monochrome && 'opacity-70 grayscale')}
        draggable={false}
      />
    </span>
  );
}
