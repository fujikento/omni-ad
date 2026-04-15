'use client';

import { memo } from 'react';
import { PlatformBadge, PlatformIcon } from '@omni-ad/ui';
import { dbPlatformToEnum } from '@omni-ad/shared';
import { PLATFORM_CONFIG, type Platform } from '../_types';

interface PlatformBadgesProps {
  platforms: Platform[];
}

function PlatformBadgesImpl({ platforms }: PlatformBadgesProps): React.ReactElement {
  if (platforms.length <= 3) {
    return (
      <div className="flex flex-wrap gap-1">
        {platforms.map((p) => (
          <PlatformBadge
            key={p}
            platform={dbPlatformToEnum(p)}
            size="sm"
            showLabel={false}
          />
        ))}
      </div>
    );
  }
  // When many platforms are active, fall back to a stacked group of icons
  // with a count chip to keep the row height tight.
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {platforms.slice(0, 3).map((p) => (
          <div
            key={p}
            className="grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-card shadow-xs"
            title={PLATFORM_CONFIG[p].label}
          >
            <PlatformIcon platform={dbPlatformToEnum(p)} size={11} />
          </div>
        ))}
      </div>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        +{platforms.length - 3}
      </span>
    </div>
  );
}

export const PlatformBadges = memo(PlatformBadgesImpl);
