'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
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
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

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

const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'meta', label: 'Meta Ads', status: 'connected', accountName: 'OMNI-AD Meta', lastSync: '2026-04-02T05:00:00Z', icon: 'M' },
  { platform: 'google', label: 'Google Ads', status: 'connected', accountName: 'OMNI-AD Google', lastSync: '2026-04-02T05:30:00Z', icon: 'G' },
  { platform: 'x', label: 'X Ads', status: 'expired', accountName: 'OMNI-AD X', icon: 'X' },
  { platform: 'tiktok', label: 'TikTok Ads', status: 'disconnected', icon: 'T' },
  { platform: 'line_yahoo', label: 'LINE/Yahoo Ads', status: 'connected', accountName: 'OMNI-AD LINE/Yahoo', lastSync: '2026-04-01T22:00:00Z', icon: 'L' },
  { platform: 'amazon', label: 'Amazon Ads', status: 'disconnected', icon: 'A' },
  { platform: 'microsoft', label: 'Microsoft Ads', status: 'disconnected', icon: 'MS' },
];

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: '田中太郎', email: 'tanaka@example.com', role: 'admin', lastActive: '2026-04-02T06:00:00Z' },
  { id: '2', name: '鈴木花子', email: 'suzuki@example.com', role: 'editor', lastActive: '2026-04-01T18:00:00Z' },
  { id: '3', name: '佐藤一郎', email: 'sato@example.com', role: 'viewer', lastActive: '2026-03-30T12:00:00Z' },
];

// -- Subcomponents --

function PlatformsTab(): React.ReactElement {
  const { t } = useI18n();
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState<Platform | null>(null);
  const [analyzing, setAnalyzing] = useState<Platform | null>(null);

  function handleConnect(platform: Platform): void {
    setConnecting(platform);
    setTimeout(() => setConnecting(null), 2000);
  }

  function handleAnalyze(platform: Platform): void {
    setAnalyzing(platform);
    // Navigate after a brief loading state
    setTimeout(() => {
      window.location.href = `/account-analysis/${platform}`;
    }, 500);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('settings.platformDescription')}
      </p>
      <div className="space-y-3">
        {MOCK_CONNECTIONS.map((conn) => {
          const statusConfig = STATUS_CONFIG_KEYS[conn.status];
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
                      {t('settings.lastSync')}: {new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(conn.lastSync))}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusConfig.className)}>
                  {t(statusConfig.labelKey)}
                </span>
                {conn.status === 'connected' && (
                  <button
                    type="button"
                    onClick={() => handleAnalyze(conn.platform)}
                    disabled={analyzing === conn.platform}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {analyzing === conn.platform ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
                    {analyzing === conn.platform ? t('settings.analyzingStatus') : t('settings.analyze')}
                  </button>
                )}
                {conn.status === 'connected' ? (
                  <button
                    type="button"
                    disabled={disconnecting === conn.platform}
                    onClick={() => {
                      if (window.confirm(t('settings.disconnectConfirm', { name: conn.label }))) {
                        setDisconnecting(conn.platform);
                        setTimeout(() => {
                          setDisconnecting(null);
                          showToast(t('settings.disconnectSuccess', { name: conn.label }));
                        }, 1500);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    {disconnecting === conn.platform ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                    {t('settings.disconnect')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnect(conn.platform)}
                    disabled={connecting === conn.platform}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {connecting === conn.platform ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    {t('settings.connect')}
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(MOCK_TEAM);

  function handleInvite(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    showToast(`${inviteEmail} に招待を送信しました`);
    setInviteOpen(false);
    setInviteEmail('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">チームメンバーの管理と権限設定</p>
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
              <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-foreground">メールアドレス</label>
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
              <label htmlFor="invite-role" className="mb-1 block text-xs font-medium text-foreground">権限</label>
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
              aria-label="閉じる"
            >
              <X size={16} />
            </button>
          </div>
        </form>
      )}

      {/* Team list */}
      <div className="space-y-2">
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
                      showToast(`${member.name}を削除しました`);
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  title="削除"
                  aria-label={`${member.name}を削除`}
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
            <p className="mt-1 text-sm text-muted-foreground">{t('settings.monthlyFee')} 98,000円</p>
          </div>
          <button
            type="button"
            onClick={() => showToast('プラン変更は準備中です')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('settings.managePlan')}
          </button>
        </div>
      </div>

      {/* Usage metrics */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">利用状況</h3>
        <div className="space-y-3">
          {[
            { label: 'キャンペーン数', current: 12, limit: 50 },
            { label: 'チームメンバー', current: 3, limit: 10 },
            { label: 'API呼び出し / 月', current: 45230, limit: 100000 },
            { label: 'クリエイティブ生成 / 月', current: 28, limit: 100 },
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

  const API_KEY = 'omni_sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  function handleCopy(): void {
    navigator.clipboard.writeText(API_KEY).catch(() => {
      // clipboard access denied
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <p className="text-xs text-muted-foreground">本番環境用のAPIキー</p>
          </div>
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
        </div>
        <div className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground">
          {showKey ? API_KEY : 'omni_sk_live_************************************'}
        </div>
      </div>

      {/* Rotate key */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">APIキーのローテーション</p>
            <p className="text-xs text-muted-foreground">
              新しいキーを生成します。古いキーは即座に無効化されます。
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

      {/* API usage */}
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">API利用状況 (今月)</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">45,230</p>
            <p className="text-xs text-muted-foreground">リクエスト数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">142ms</p>
            <p className="text-xs text-muted-foreground">平均レスポンス</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">99.8%</p>
            <p className="text-xs text-muted-foreground">稼働率</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiTab(): React.ReactElement {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Claude APIキーの設定とAIオートパイロットの管理
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
            <p className="text-sm font-medium text-foreground">AI設定を開く</p>
            <p className="text-xs text-muted-foreground">
              APIキー、オートパイロットモード、最適化設定を管理
            </p>
          </div>
        </div>
        <ArrowRight size={16} className="text-muted-foreground" />
      </a>

      {/* Quick status */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">API接続</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">接続済み</span>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">オートパイロット</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">稼働中（承認モード）</span>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">今日の判断</p>
          <p className="mt-1 text-sm font-medium text-foreground">7件 (5実行, 2提案中)</p>
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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4" aria-label="設定タブ">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>{TAB_CONTENT[activeTab]}</div>
    </div>
  );
}
