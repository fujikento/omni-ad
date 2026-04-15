'use client';

import { memo } from 'react';
import { Badge } from '@omni-ad/ui';
import { useI18n } from '@/lib/i18n';
import { STATUS_CONFIG, type CampaignStatus } from '../_types';

interface StatusBadgeProps {
  status: CampaignStatus;
}

function StatusBadgeImpl({ status }: StatusBadgeProps): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} size="md" dot={status === 'active'}>
      {t(config.labelKey)}
    </Badge>
  );
}

export const StatusBadge = memo(StatusBadgeImpl);
