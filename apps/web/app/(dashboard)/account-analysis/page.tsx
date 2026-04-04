'use client';

import { useState } from 'react';
import {
  ChevronRight,
  Loader2,
  ScanSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';

interface PlatformConnection {
  platform: Platform;
  label: string;
  status: ConnectionStatus;
  accountName?: string;
  lastSync?: string;
  icon: string;
  lastAnalysis?: string;
  score?: number;
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<ConnectionStatus, { labelKey: string; className: string }> = {
  connected: { labelKey: 'settings.connected', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  disconnected: { labelKey: 'settings.disconnected', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  error: { labelKey: 'settings.error', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  expired: { labelKey: 'settings.expired', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'meta', label: 'Meta Ads', status: 'connected', accountName: 'OMNI-AD Meta', lastSync: '2026-04-02T05:00:00Z', icon: 'M', lastAnalysis: '2026-04-01 14:20', score: 71 },
  { platform: 'google', label: 'Google Ads', status: 'connected', accountName: 'OMNI-AD Google', lastSync: '2026-04-02T05:30:00Z', icon: 'G', lastAnalysis: '2026-04-03 09:30', score: 62 },
  { platform: 'x', label: 'X Ads', status: 'expired', accountName: 'OMNI-AD X', icon: 'X' },
  { platform: 'tiktok', label: 'TikTok Ads', status: 'disconnected', icon: 'T' },
  { platform: 'line_yahoo', label: 'LINE/Yahoo Ads', status: 'connected', accountName: 'OMNI-AD LINE/Yahoo', lastSync: '2026-04-01T22:00:00Z', icon: 'L', lastAnalysis: '2026-03-28 10:00', score: 78 },
  { platform: 'amazon', label: 'Amazon Ads', status: 'disconnected', icon: 'A' },
  { platform: 'microsoft', label: 'Microsoft Ads', status: 'disconnected', icon: 'MS' },
];

// ============================================================
// Helpers
// ============================================================

function getScoreColor(score: number): string {
  if (score > 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score > 70) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

// ============================================================
// Main Page
// ============================================================

export default function AccountAnalysisListPage(): React.ReactElement {
  const { t } = useI18n();
  const [navigating, setNavigating] = useState<Platform | null>(null);
  const connectedPlatforms = MOCK_CONNECTIONS.filter((c) => c.status === 'connected');
  const otherPlatforms = MOCK_CONNECTIONS.filter((c) => c.status !== 'connected');

  function handleNavigate(platform: Platform): void {
    setNavigating(platform);
    window.location.href = `/account-analysis/${platform}`;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('accountAnalysis.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('accountAnalysis.description')}
        </p>
      </div>

      {/* Connected platforms */}
      {connectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t('accountAnalysis.analyzableAccounts')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectedPlatforms.map((conn) => (
              <button
                key={conn.platform}
                type="button"
                onClick={() => handleNavigate(conn.platform)}
                disabled={navigating === conn.platform}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/30 disabled:opacity-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-bold text-foreground">
                  {conn.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{conn.label}</p>
                  <p className="text-xs text-muted-foreground">{conn.accountName}</p>
                  {conn.lastAnalysis && (
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {t('accountAnalysis.lastAnalysis')} {conn.lastAnalysis}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  {conn.score !== undefined ? (
                    <span className={cn('rounded-lg px-2.5 py-1 text-lg font-bold', getScoreBg(conn.score), getScoreColor(conn.score))}>
                      {conn.score}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('accountAnalysis.notAnalyzed')}</span>
                  )}
                </div>
                {navigating === conn.platform ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for no connected platforms */}
      {connectedPlatforms.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <ScanSearch size={48} className="text-muted-foreground/30" />
          <p className="mt-4 text-sm font-medium text-foreground">{t('accountAnalysis.noConnectedAccounts')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('accountAnalysis.noConnectedAccountsHint')}
          </p>
          <a
            href="/settings"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('accountAnalysis.goToSettings')}
          </a>
        </div>
      )}

      {/* Other platforms */}
      {otherPlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('accountAnalysis.disconnectedPlatforms')}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {otherPlatforms.map((conn) => {
              const statusCfg = STATUS_CONFIG[conn.status];
              return (
                <div
                  key={conn.platform}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card/50 p-4 opacity-60"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
                    {conn.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{conn.label}</p>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', statusCfg.className)}>
                      {t(statusCfg.labelKey)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
