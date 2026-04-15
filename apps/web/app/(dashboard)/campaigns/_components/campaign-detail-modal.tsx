'use client';

import { memo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { OBJECTIVE_LABEL_KEYS, type Campaign } from '../_types';
import { StatusBadge } from './status-badge';
import { PlatformBadges } from './platform-badges';

interface CampaignDetailModalProps {
  campaign: Campaign;
  onClose: () => void;
}

function CampaignDetailModalImpl({ campaign, onClose }: CampaignDetailModalProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{campaign.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('common.status')}</p>
              <StatusBadge status={campaign.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.objective')}</p>
              <p className="text-sm font-medium text-foreground">{t(OBJECTIVE_LABEL_KEYS[campaign.objective])}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.totalBudget')}</p>
              <p className="text-sm font-medium text-foreground">
                {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ROAS</p>
              <p className={cn(
                'text-sm font-semibold',
                campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-muted-foreground',
              )}>
                {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '--'}
              </p>
            </div>
            {campaign.budget.dailyLimit && (
              <div>
                <p className="text-xs text-muted-foreground">{t('campaigns.dailyLimit')}</p>
                <p className="text-sm text-foreground">
                  {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.dailyLimit)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{t('campaigns.updatedAt')}</p>
              <p className="text-sm text-foreground">
                {new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(campaign.updatedAt))}
              </p>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">{t('campaigns.deliveryPlatforms')}</p>
            <PlatformBadges platforms={campaign.platforms} />
          </div>

          {/* Change history stub */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('campaigns.changeHistory')}</p>
            <div className="space-y-2">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyBudgetChange')}
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyStatusChange')}
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t('campaigns.historyCreated')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CampaignDetailModal = memo(CampaignDetailModalImpl);
