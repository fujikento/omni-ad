'use client';

import { memo } from 'react';
import { Edit3, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { Campaign } from '../_types';
import { StatusBadge } from './status-badge';
import { PlatformBadges } from './platform-badges';

interface CampaignRowProps {
  campaign: Campaign;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (campaign: Campaign) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string) => string;
}

function CampaignRowImpl({
  campaign,
  selected,
  onToggleSelect,
  onOpenDetail,
  onPause,
  onResume,
  formatCurrency,
  formatDate,
}: CampaignRowProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/30',
        selected && 'bg-primary/5',
      )}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(campaign.id)}
          className="h-4 w-4 rounded border-input text-primary accent-primary"
          aria-label={t('campaigns.ariaSelectCampaign', { name: campaign.name })}
        />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onOpenDetail(campaign)}
          className="font-medium text-primary hover:underline"
        >
          {campaign.name}
        </button>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={campaign.status} />
      </td>
      <td className="px-4 py-3">
        <PlatformBadges platforms={campaign.platforms} />
      </td>
      <td className="px-4 py-3 text-foreground">{formatCurrency(campaign.budget.total)}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'font-semibold tabular-nums',
            campaign.roas >= 3 ? 'text-success' : campaign.roas >= 1 ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(campaign.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-0.5">
          {campaign.status === 'active' ? (
            <button
              type="button"
              onClick={() => onPause(campaign.id)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning"
              title={t('campaigns.hb57e4b')}
              aria-label={t('campaigns.ariaPauseCampaign', { name: campaign.name })}
            >
              <Pause size={14} />
            </button>
          ) : campaign.status === 'paused' ? (
            <button
              type="button"
              onClick={() => onResume(campaign.id)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
              title={t('campaigns.h3fade1')}
              aria-label={t('campaigns.ariaResumeCampaign', { name: campaign.name })}
            >
              <Play size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={t('campaigns.h757886')}
            aria-label={t('campaigns.ariaEditCampaign', { name: campaign.name })}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={t('campaigns.hc6577c')}
            aria-label={t('campaigns.ariaDeleteCampaign', { name: campaign.name })}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export const CampaignRow = memo(CampaignRowImpl);
