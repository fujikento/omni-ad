'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, ScanSearch } from 'lucide-react';
import {
  Badge,
  EmptyState,
  PageHeader,
  PlatformBadge,
  PlatformIcon,
} from '@omni-ad/ui';
import {
  dbPlatformToEnum,
  PLATFORM_DISPLAY_NAMES,
  type DbPlatformKey,
} from '@omni-ad/shared';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';

interface PlatformConnection {
  platform: DbPlatformKey;
  status: ConnectionStatus;
  accountName?: string;
  lastSync?: string;
  lastAnalysis?: string;
  score?: number;
}

type StatusVariant = 'success' | 'neutral' | 'destructive' | 'warning';

const STATUS_CONFIG: Record<ConnectionStatus, { labelKey: string; variant: StatusVariant }> = {
  connected: { labelKey: 'settings.connected', variant: 'success' },
  disconnected: { labelKey: 'settings.disconnected', variant: 'neutral' },
  error: { labelKey: 'settings.error', variant: 'destructive' },
  expired: { labelKey: 'settings.expired', variant: 'warning' },
};

function getScoreClasses(score: number): string {
  if (score > 70) return 'bg-success/10 text-success';
  if (score >= 40) return 'bg-warning/15 text-warning';
  return 'bg-destructive/10 text-destructive';
}

export default function AccountAnalysisListPage(): React.ReactElement {
  const { t } = useI18n();
  const [navigating, setNavigating] = useState<DbPlatformKey | null>(null);
  const platformsQuery = trpc.platforms.list.useQuery(undefined, { retry: false });
  const connections = (platformsQuery.data as PlatformConnection[] | undefined) ?? [];
  const connectedPlatforms = connections.filter((c) => c.status === 'connected');
  const otherPlatforms = connections.filter((c) => c.status !== 'connected');

  function handleNavigate(platform: DbPlatformKey): void {
    setNavigating(platform);
    window.location.href = `/account-analysis/${platform}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title={t('accountAnalysis.title')}
        description={t('accountAnalysis.description')}
      />

      {connectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('accountAnalysis.analyzableAccounts')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectedPlatforms.map((conn) => (
              <button
                key={conn.platform}
                type="button"
                onClick={() => handleNavigate(conn.platform)}
                disabled={navigating === conn.platform}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/30 hover:bg-muted/30 disabled:opacity-50"
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-muted">
                  <PlatformIcon platform={dbPlatformToEnum(conn.platform)} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {PLATFORM_DISPLAY_NAMES[dbPlatformToEnum(conn.platform)]}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{conn.accountName}</p>
                  {conn.lastAnalysis && (
                    <p className="mt-1 text-[10px] text-muted-foreground/60">
                      {t('accountAnalysis.lastAnalysis')} {conn.lastAnalysis}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  {conn.score !== undefined ? (
                    <span className={cn('rounded-md px-2.5 py-1 text-lg font-bold tabular-nums', getScoreClasses(conn.score))}>
                      {conn.score}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('accountAnalysis.notAnalyzed')}</span>
                  )}
                </div>
                {navigating === conn.platform ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {connectedPlatforms.length === 0 && (
        <EmptyState
          icon={<ScanSearch size={18} />}
          title={t('accountAnalysis.noConnectedAccounts')}
          description={t('accountAnalysis.noConnectedAccountsHint')}
          action={
            <a
              href="/settings"
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              {t('accountAnalysis.goToSettings')}
            </a>
          }
        />
      )}

      {otherPlatforms.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('accountAnalysis.disconnectedPlatforms')}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {otherPlatforms.map((conn) => {
              const statusCfg =
                STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.disconnected;
              return (
                <div
                  key={conn.platform}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 opacity-70"
                >
                  <PlatformBadge platform={dbPlatformToEnum(conn.platform)} size="sm" showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {PLATFORM_DISPLAY_NAMES[dbPlatformToEnum(conn.platform)]}
                    </p>
                  </div>
                  <Badge variant={statusCfg.variant} size="sm">
                    {t(statusCfg.labelKey)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
