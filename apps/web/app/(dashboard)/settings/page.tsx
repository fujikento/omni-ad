'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Inbox,
  Key,
  Link2,
  Loader2,
  RefreshCw,
  ScanSearch,
  Shield,
  Sparkles,
  Trash2,
  Unlink,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PageHeader, Tabs } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';

// -- Types --

type SettingsTab = 'platforms' | 'team' | 'billing' | 'api' | 'ai';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired';
type UserRole = 'admin' | 'editor' | 'viewer';

interface PlatformConnection {
  platform: Platform;
  label: string;
  status: ConnectionStatus;
  accountName?: string;
  lastSync?: string;
  icon: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lastActive: string;
}

// -- Constants --

const TABS: { key: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'platforms', labelKey: 'settings.platforms', icon: <Link2 size={16} /> },
  { key: 'team', labelKey: 'settings.team', icon: <Users size={16} /> },
  { key: 'billing', labelKey: 'settings.billing', icon: <Crown size={16} /> },
  { key: 'api', labelKey: 'settings.api', icon: <Key size={16} /> },
  { key: 'ai', labelKey: 'settings.ai', icon: <Sparkles size={16} /> },
];

const STATUS_CONFIG_KEYS: Record<ConnectionStatus, { labelKey: string; className: string }> = {
  connected: { labelKey: 'settings.connected', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  disconnected: { labelKey: 'settings.disconnected', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  error: { labelKey: 'settings.error', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  expired: { labelKey: 'settings.expired', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  admin: 'settings.role.admin',
  editor: 'settings.role.editor',
  viewer: 'settings.role.viewer',
};

const PLATFORM_DEFAULTS: { platform: Platform; label: string; icon: string }[] = [
  { platform: 'meta', label: 'Meta Ads', icon: 'M' },
  { platform: 'google', label: 'Google Ads', icon: 'G' },
  { platform: 'x', label: 'X Ads', icon: 'X' },
  { platform: 'tiktok', label: 'TikTok Ads', icon: 'T' },
  { platform: 'line_yahoo', label: 'LINE/Yahoo Ads', icon: 'L' },
  { platform: 'amazon', label: 'Amazon Ads', icon: 'A' },
  { platform: 'microsoft', label: 'Microsoft Ads', icon: 'MS' },
];

function deriveConnectionStatus(
  dbStatus: string,
  tokenExpiresAt: string | Date | null,
): ConnectionStatus {
  if (dbStatus === 'revoked') return 'disconnected';
  if (dbStatus === 'error') return 'error';
  if (dbStatus === 'expired') return 'expired';
  if (dbStatus === 'active' && tokenExpiresAt) {
    return new Date(tokenExpiresAt) > new Date() ? 'connected' : 'expired';
  }
  return 'disconnected';
}


// -- Subcomponents --

const LOCALE_TO_INTL: Record<string, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
  ko: 'ko-KR',
};

function PlatformsTab(): React.ReactElement {
  const { t, locale } = useI18n();
  const [analyzing, setAnalyzing] = useState<Platform | null>(null);

  // Live data from API
  const { data: dbConnections, isLoading, isError, refetch } = trpc.platforms.list.useQuery();

  const connectMutation = trpc.platforms.connect.useMutation({
    onSuccess: (data) => {
      // Redirect to the platform's OAuth page
      window.location.href = data.oauthUrl;
    },
    onError: (err) => {
      showToast(err.message);
    },
  });

  const [disconnectLabel, setDisconnectLabel] = useState('');
  const disconnectMutation = trpc.platforms.disconnect.useMutation({
    onSuccess: () => {
      void refetch();
      showToast(t('settings.disconnectSuccess', { name: disconnectLabel }));
    },
    onError: (err) => {
      showToast(err.message);
    },
  });

  const syncMutation = trpc.platforms.syncNow.useMutation({
    onSuccess: () => {
      showToast(t('settings.syncStarted'));
    },
    onError: (err) => {
      showToast(err.message);
    },
  });

  // Handle OAuth return params (?connected=meta or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected) {
      const label = PLATFORM_DEFAULTS.find((p) => p.platform === connected)?.label ?? connected;
      showToast(t('settings.connectSuccess', { name: label }));
      window.history.replaceState({}, '', '/settings');
      void refetch();
    }
    if (error) {
      showToast(t('settings.connectError'));
      window.history.replaceState({}, '', '/settings');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build display list: merge DB connections with platform defaults
  const connections: PlatformConnection[] = PLATFORM_DEFAULTS.map((def) => {
    const dbConn = dbConnections?.find((c) => c.platform === def.platform);
    if (!dbConn) {
      return { ...def, status: 'disconnected' as ConnectionStatus };
    }
    return {
      ...def,
      status: deriveConnectionStatus(dbConn.status, dbConn.tokenExpiresAt),
      accountName: dbConn.platformAccountName,
      lastSync: dbConn.lastSyncAt ? new Date(dbConn.lastSyncAt).toISOString() : undefined,
      connectionId: dbConn.id,
    };
  });

  function handleConnect(platform: Platform): void {
    connectMutation.mutate({ platform });
  }

  function handleDisconnect(conn: PlatformConnection & { connectionId?: string }): void {
    if (!conn.connectionId) return;
    if (!window.confirm(t('settings.disconnectConfirm', { name: conn.label }))) return;
    setDisconnectLabel(conn.label);
    disconnectMutation.mutate({ connectionId: conn.connectionId });
  }

  function handleSyncNow(conn: PlatformConnection & { connectionId?: string }): void {
    if (!conn.connectionId) return;
    syncMutation.mutate({ connectionId: conn.connectionId });
  }

  function handleAnalyze(platform: Platform): void {
    setAnalyzing(platform);
    setTimeout(() => {
      window.location.href = `/account-analysis/${platform}`;
    }, 500);
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('settings.platformDescription')}</p>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-destructive">{t('settings.loadError')}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw size={14} />
            {t('settings.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('settings.platformDescription')}</p>
        <div className="space-y-3">
          {PLATFORM_DEFAULTS.map((def) => (
            <div key={def.platform} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('settings.platformDescription')}
      </p>
      <div className="space-y-3">
        {connections.map((conn) => {
          const statusConfig = STATUS_CONFIG_KEYS[conn.status];
          const connWithId = conn as PlatformConnection & { connectionId?: string };
          const isConnected = conn.status === 'connected';
          const isExpired = conn.status === 'expired';

          return (
            <div key={conn.platform} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
                  {conn.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{conn.label}</p>
                  {conn.accountName && (
                    <p className="text-xs text-muted-foreground">{conn.accountName}</p>
                  )}
                  {conn.lastSync && (
                    <p className="text-[10px] text-muted-foreground/60">
                      {t('settings.lastSync')}: {new Intl.DateTimeFormat(LOCALE_TO_INTL[locale] ?? 'ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(conn.lastSync))}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusConfig.className)}>
                  {t(statusConfig.labelKey)}
                </span>
                {isConnected && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSyncNow(connWithId)}
                      disabled={syncMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
                      {t('settings.syncNow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnalyze(conn.platform)}
                      disabled={analyzing === conn.platform}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {analyzing === conn.platform ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
                      {analyzing === conn.platform ? t('settings.analyzingStatus') : t('settings.analyze')}
                    </button>
                  </>
                )}
                {(isConnected || isExpired) && (
                  <button
                    type="button"
                    disabled={disconnectMutation.isPending}
                    onClick={() => handleDisconnect(connWithId)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    {disconnectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    {t('settings.disconnect')}
                  </button>
                )}
                {(!isConnected) && (
                  <button
                    type="button"
                    onClick={() => handleConnect(conn.platform)}
                    disabled={connectMutation.isPending && connectMutation.variables?.platform === conn.platform}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {connectMutation.isPending && connectMutation.variables?.platform === conn.platform ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    {isExpired ? t('settings.reconnect') : t('settings.connect')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamTab(): React.ReactElement {
  const { t } = useI18n();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  function handleInvite(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    showToast(t('settings.inviteSent', { email: inviteEmail }));
    setInviteOpen(false);
    setInviteEmail('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('settings.teamDescription')}</p>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus size={14} />
          {t('settings.inviteMember')}
        </button>
      </div>

      {/* Invite form */}
      {inviteOpen && (
        <form onSubmit={handleInvite} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-foreground">{t('settings.emailLabel')}</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="w-32">
              <label htmlFor="invite-role" className="mb-1 block text-xs font-medium text-foreground">{t('settings.permissionLabel')}</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInviteRole(e.target.value as UserRole)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(ROLE_LABEL_KEYS) as [UserRole, string][]).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('settings.invite')}
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={t('settings.h5dce86')}
            >
              <X size={16} />
            </button>
          </div>
        </form>
      )}

      {/* Team list */}
      <div className="space-y-2">
        {teamMembers.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
            <Inbox size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        )}
        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {member.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                member.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : member.role === 'editor'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
              )}>
                {member.role === 'admin' && <Shield size={10} />}
                {t(ROLE_LABEL_KEYS[member.role])}
              </span>
              {member.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t('settings.removeMember'))) {
                      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
                      showToast(t('settings.memberDeleted', { name: member.name }));
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title={t('settings.hc6577c')}
                  aria-label={t('settings.ariaMemberDelete', { name: member.name })}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingTab(): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">{t('settings.planName')}</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('settings.monthlyFee')} {t('settings.monthlyFeeAmount')}</p>
          </div>
          <button
            type="button"
            onClick={() => showToast(t('settings.h0e7d61'))}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('settings.managePlan')}
          </button>
        </div>
      </div>

      {/* Usage metrics */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">{t('settings.usageTitle')}</h3>
        <div className="space-y-3">
          {[
            { label: t('settings.h97f3c5'), current: 12, limit: 50 },
            { label: t('settings.h3eb7e0'), current: 3, limit: 10 },
            { label: t('settings.h36e8cf'), current: 45230, limit: 100000 },
            { label: t('settings.h6a1f83'), current: 28, limit: 100 },
          ].map((item) => {
            const pct = (item.current / item.limit) * 100;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">
                    {item.current.toLocaleString()} / {item.limit.toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className={cn('h-2 rounded-full', pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500')}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApiTab(): React.ReactElement {
  const { t } = useI18n();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // API key will be loaded from API when the endpoint is available
  const apiKey = '';
  const hasKey = apiKey.length > 0;

  function handleCopy(): void {
    if (!hasKey) return;
    navigator.clipboard.writeText(apiKey).catch(() => {
      // clipboard access denied
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function maskKey(key: string): string {
    if (key.length <= 12) return '****';
    return `${key.slice(0, 12)}${'*'.repeat(key.length - 12)}`;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('settings.apiDescription')}
      </p>

      {/* API Key display */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Live API Key</p>
            <p className="text-xs text-muted-foreground">{t('settings.productionApiKey')}</p>
          </div>
          {hasKey && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? t('settings.hideKey') : t('settings.showKey')}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={t('settings.copyKey')}
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
          {hasKey
            ? (showKey ? apiKey : maskKey(apiKey))
            : t('common.noData')
          }
        </div>
      </div>

      {/* Rotate key */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.apiKeyRotation')}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.h4f5631')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('settings.regenerateConfirm'))) {
                showToast(t('settings.apiGenerated'));
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <RefreshCw size={12} />
            {t('settings.regenerateKey')}
          </button>
        </div>
      </div>

      {/* API usage -- show placeholder until real data is available */}
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">{t('settings.apiUsageThisMonth')}</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">--</p>
            <p className="text-xs text-muted-foreground">{t('settings.requestCount')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">--</p>
            <p className="text-xs text-muted-foreground">{t('settings.avgResponse')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">--</p>
            <p className="text-xs text-muted-foreground">{t('settings.uptime')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiTab(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('settings.aiSettingsDesc')}
      </p>
      <a
        href="/settings/ai"
        className="flex items-center justify-between rounded-lg border border-border p-5 transition-colors hover:border-primary/30 hover:bg-muted/30"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.openAiSettings')}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.aiSettingsManage')}
            </p>
          </div>
        </div>
        <ArrowRight size={16} className="text-muted-foreground" />
      </a>

      {/* Quick status */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('settings.apiConnection')}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">{t('settings.connectedStatus')}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('settings.autopilotLabel')}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">{t('settings.autopilotRunningApproval')}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('settings.todayDecisions')}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{t('settings.todayDecisionsCount')}</p>
        </div>
      </div>
    </div>
  );
}

// -- Main Page --

export default function SettingsPage(): React.ReactElement {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('platforms');

  const TAB_CONTENT: Record<SettingsTab, React.ReactElement> = {
    platforms: <PlatformsTab />,
    team: <TeamTab />,
    billing: <BillingTab />,
    api: <ApiTab />,
    ai: <AiTab />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title={t('settings.title')}
      />

      <Tabs
        value={activeTab}
        onValueChange={(k) => setActiveTab(k as SettingsTab)}
        items={TABS.map((tab) => ({
          key: tab.key,
          label: (
            <span className="inline-flex items-center gap-2">
              {tab.icon}
              {t(tab.labelKey)}
            </span>
          ),
        }))}
      />

      <div>{TAB_CONTENT[activeTab]}</div>
    </div>
  );
}
