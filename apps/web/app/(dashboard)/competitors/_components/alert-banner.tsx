'use client';

import { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { ALERT_TYPE_ICONS } from '../_constants';
import type { CompetitorAlert } from '../_types';

interface AlertBannerProps {
  alerts: CompetitorAlert[];
  onAcknowledge: (id: string) => void;
}

function AlertBannerInner({
  alerts,
  onAcknowledge,
}: AlertBannerProps): React.ReactElement | null {
  const { t } = useI18n();
  const unacknowledged = useMemo(
    () => alerts.filter((a) => !a.acknowledged),
    [alerts],
  );
  if (unacknowledged.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/30"
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle
          size={16}
          className="text-yellow-600 dark:text-yellow-400"
        />
        <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          {t('competitors.alertCount', { count: unacknowledged.length })}
        </span>
      </div>
      <div className="space-y-2">
        {unacknowledged.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2 dark:bg-black/20"
          >
            <div className="flex items-center gap-2">
              <span>{ALERT_TYPE_ICONS[alert.type]}</span>
              <span className="text-sm text-yellow-900 dark:text-yellow-200">
                {t(alert.messageKey, alert.messageParams)}
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-500">
                {t(`competitors.time.${alert.timestamp}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAcknowledge(alert.id)}
              className="rounded-md bg-yellow-200 px-2.5 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700"
            >
              {t('competitors.acknowledge')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AlertBanner = memo(AlertBannerInner);
