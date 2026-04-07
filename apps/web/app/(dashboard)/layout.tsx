'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Film,
  Fingerprint,
  FlaskConical,
  Gauge,
  GitFork,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ScanSearch,
  ScrollText,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Swords,
  TrendingUp,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRPCProvider } from '@/lib/trpc-provider';
import { CommandPalette, CommandPaletteTrigger } from '@/app/components/command-palette';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/app/components/language-switcher';

// ============================================================
// Types
// ============================================================

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  activeIndicator?: boolean;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

type NotificationSeverity = 'critical' | 'warning' | 'info';

interface Notification {
  id: string;
  severity: NotificationSeverity;
  message: string;
  time: string;
  read: boolean;
  href?: string;
}

// ============================================================
// Constants
// ============================================================

const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: '',
    items: [
      { labelKey: 'nav.dashboard', href: '/home', icon: <Home size={20} /> },
    ],
  },
  {
    titleKey: 'nav.aiOps',
    items: [
      { labelKey: 'nav.aiAutopilot', href: '/ai-pilot', icon: <Sparkles size={20} />, activeIndicator: true },
      { labelKey: 'nav.competitors', href: '/competitors', icon: <Swords size={20} />, badge: 3 },
      { labelKey: 'nav.autoRules', href: '/auto-rules', icon: <Workflow size={20} /> },
    ],
  },
  {
    titleKey: 'nav.adManagement',
    items: [
      { labelKey: 'nav.campaigns', href: '/campaigns', icon: <LayoutDashboard size={20} /> },
      { labelKey: 'nav.groupBuy', href: '/campaigns/group-buy', icon: <ShoppingCart size={20} /> },
      { labelKey: 'nav.creatives', href: '/creatives', icon: <BrainCircuit size={20} /> },
      { labelKey: 'nav.videoStudio', href: '/creatives/video-studio', icon: <Film size={20} /> },
      { labelKey: 'nav.creativeOptimization', href: '/creatives/optimization', icon: <RefreshCw size={20} /> },
      { labelKey: 'nav.audiences', href: '/audiences', icon: <Users size={20} /> },
      { labelKey: 'nav.identityGraph', href: '/audiences/identity-graph', icon: <Fingerprint size={20} /> },
      { labelKey: 'nav.funnels', href: '/funnels', icon: <GitFork size={20} /> },
    ],
  },
  {
    titleKey: 'nav.analysisOptimization',
    items: [
      { labelKey: 'nav.analytics', href: '/analytics', icon: <BarChart3 size={20} /> },
      { labelKey: 'nav.budgets', href: '/budgets', icon: <Gauge size={20} /> },
      { labelKey: 'nav.abTests', href: '/ab-tests', icon: <FlaskConical size={20} />, badge: 847 },
      { labelKey: 'nav.ltv', href: '/ltv', icon: <TrendingUp size={20} /> },
      { labelKey: 'nav.reports', href: '/reports', icon: <ScrollText size={20} /> },
    ],
  },
  {
    titleKey: 'nav.management',
    items: [
      { labelKey: 'nav.accountAnalysis', href: '/account-analysis', icon: <ScanSearch size={20} /> },
      { labelKey: 'nav.clients', href: '/clients', icon: <Building2 size={20} /> },
      { labelKey: 'nav.approvals', href: '/approvals', icon: <CheckSquare size={20} />, badge: 5 },
      { labelKey: 'nav.settings', href: '/settings', icon: <Settings size={20} /> },
    ],
  },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', severity: 'critical', message: '支出急増検出: Google広告「春のプロモーション」', time: '5分前', read: false, href: '/campaigns/1' },
  { id: 'n2', severity: 'critical', message: 'Meta広告のコンバージョンピクセルが無応答', time: '30分前', read: false, href: '/settings' },
  { id: 'n3', severity: 'warning', message: 'TikTok広告のCTRが20%低下', time: '1時間前', read: false, href: '/analytics' },
  { id: 'n4', severity: 'warning', message: 'オーディエンス飽和: LINEリマーケティング', time: '2時間前', read: true, href: '/audiences' },
  { id: 'n5', severity: 'info', message: 'レポート「3月パフォーマンスレポート」が完了', time: '3時間前', read: true, href: '/reports' },
  { id: 'n6', severity: 'info', message: 'A/Bテスト「CTA文言テスト」の結果が出ました', time: '5時間前', read: true, href: '/ab-tests' },
  { id: 'n7', severity: 'info', message: 'AI予算最適化が完了しました', time: '6時間前', read: true, href: '/budgets' },
];

const SEVERITY_DOT_CLASS: Record<NotificationSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

// ============================================================
// Subcomponents
// ============================================================

function NotificationPanel({
  notifications,
  open,
  onClose,
  onMarkAllRead,
}: {
  notifications: Notification[];
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
}): React.ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Delay to avoid immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:w-96"
      role="dialog"
      aria-label={t('header.notificationPanel')}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{t('header.notifications')}</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-primary hover:text-primary/80"
        >
          {t('header.markAllRead')}
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t('header.noNotifications')}
          </div>
        ) : (
          notifications.map((notification) => (
            <a
              key={notification.id}
              href={notification.href ?? '#'}
              className={cn(
                'flex items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50',
                !notification.read && 'bg-primary/5',
              )}
            >
              <div className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', SEVERITY_DOT_CLASS[notification.severity])} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', notification.read ? 'text-muted-foreground' : 'font-medium text-foreground')}>
                  {notification.message}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{notification.time}</p>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

function UserDropdown({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(e: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const menuItems = [
    { labelKey: 'header.profile', icon: <User size={14} />, href: '/settings' },
    { labelKey: 'nav.settings', icon: <Settings size={14} />, href: '/settings' },
    { labelKey: 'header.plan', icon: <Zap size={14} />, href: '/settings' },
  ];

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      role="menu"
      aria-label={t('header.userMenu')}
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">{t('common.username')}</p>
        <p className="text-xs text-muted-foreground">user@example.com</p>
      </div>
      {menuItems.map((item) => (
        <a
          key={item.labelKey}
          href={item.href}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          role="menuitem"
        >
          <span className="text-muted-foreground">{item.icon}</span>
          {t(item.labelKey)}
        </a>
      ))}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('omni-ad-token');
            localStorage.removeItem('omni-ad-refresh-token');
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          role="menuitem"
        >
          <LogOut size={14} />
          {t('header.logout')}
        </button>
      </div>
    </div>
  );
}

function UsageMeter({ sidebarOpen }: { sidebarOpen: boolean }): React.ReactElement {
  const { t } = useI18n();
  const used = 28;
  const total = 100;
  const percentage = Math.round((used / total) * 100);

  return (
    <div className="space-y-2">
      {sidebarOpen ? (
        <>
          <div className="flex items-center justify-between text-xs text-sidebar-foreground/60">
            <span>{t('common.creativeGeneration')}</span>
            <span>{used}/{total}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </>
      ) : (
        <div className="flex justify-center" title={`${t('common.creativeGeneration')}: ${used}/${total}`}>
          <div className="h-6 w-6 rounded-full border-2 border-primary/30 p-0.5">
            <div className="h-full w-full rounded-full bg-primary" style={{ clipPath: `inset(${100 - percentage}% 0 0 0)` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// API Helpers (layout is outside TRPCProvider, so use fetch)
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/trpc';

interface TRPCErrorResponse {
  error?: { message?: string; json?: { message?: string } };
}

async function trpcMutate(
  procedure: string,
  input?: Record<string, unknown>,
): Promise<void> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('omni-ad-token')
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/${procedure}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ json: input ?? {} }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = body as TRPCErrorResponse | null;
    const message = parsed?.error?.json?.message
      ?? parsed?.error?.message
      ?? 'リクエストに失敗しました';
    throw new Error(message);
  }
}

interface NotificationFromAPI {
  id: string;
  severity: NotificationSeverity;
  message: string;
  time: string;
  read: boolean;
  href?: string;
}

interface TRPCQueryResult {
  result?: { data?: { json?: NotificationFromAPI[] } };
}

async function fetchNotifications(): Promise<Notification[]> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('omni-ad-token')
    : null;

  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/notifications.list`, { headers });
  if (!response.ok) {
    throw new Error('通知の取得に失敗しました');
  }

  const data: unknown = await response.json();
  const parsed = data as TRPCQueryResult;
  return parsed?.result?.data?.json ?? [];
}

// ============================================================
// Main Layout
// ============================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <I18nProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </I18nProvider>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [emergencyStopModalOpen, setEmergencyStopModalOpen] = useState(false);
  const [emergencyStopped, setEmergencyStopped] = useState(false);
  const [emergencyStopping, setEmergencyStopping] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Global Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch real notifications with fallback to mock data
  const loadNotifications = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchNotifications();
      if (data.length > 0) {
        setNotifications(data);
      }
      setNotificationsLoaded(true);
    } catch {
      // Keep mock data as fallback
      setNotificationsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!notificationsLoaded) {
      void loadNotifications();
    }
  }, [notificationsLoaded, loadNotifications]);

  function handleMarkAllRead(): void {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  async function handleEmergencyStop(): Promise<void> {
    setEmergencyStopping(true);
    setEmergencyError(null);
    try {
      await trpcMutate('emergency.stopAll');
      setEmergencyStopped(true);
      setEmergencyStopModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : '緊急停止に失敗しました';
      setEmergencyError(message);
    } finally {
      setEmergencyStopping(false);
    }
  }

  async function handleEmergencyResume(): Promise<void> {
    try {
      await trpcMutate('emergency.resume');
      setEmergencyStopped(false);
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : '再開に失敗しました';
      setEmergencyError(message);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label={t('header.closeMenu')}
        />
      )}

      {/* Sidebar -- hidden on mobile by default, shown via mobileMenuOpen overlay */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative lg:z-auto',
          sidebarOpen ? 'w-60' : 'w-16',
          mobileMenuOpen
            ? 'flex translate-x-0'
            : 'hidden lg:flex lg:translate-x-0',
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-accent px-4">
          {sidebarOpen && (
            <span className="text-lg font-bold tracking-tight">OMNI-AD</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:block"
            aria-label={sidebarOpen ? t('header.closeSidebar') : t('header.openSidebar')}
          >
            <ChevronLeft
              size={18}
              className={cn(
                'transition-transform',
                !sidebarOpen && 'rotate-180',
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label={t('header.mainNav')}>
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey || '_top'} className={cn(group.titleKey && 'mt-4 first:mt-0')}>
              {group.titleKey && sidebarOpen && (
                <div className="mb-1.5 px-3 pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {t(group.titleKey)}
                  </span>
                </div>
              )}
              {group.titleKey && !sidebarOpen && (
                <div className="my-2 mx-2 border-t border-sidebar-accent" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      !sidebarOpen && 'justify-center px-2',
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="relative flex-shrink-0">
                      {item.icon}
                      {!sidebarOpen && item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                      {item.activeIndicator && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5">
                          <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                        </span>
                      )}
                    </span>
                    {sidebarOpen && (
                      <span className="flex flex-1 items-center justify-between">
                        <span>{t(item.labelKey)}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                        {item.activeIndicator && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                          </span>
                        )}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-sidebar-accent p-3 space-y-3">
          {/* Usage meter */}
          <UsageMeter sidebarOpen={sidebarOpen} />

          {/* Plan badge */}
          {sidebarOpen ? (
            <div className="rounded-md bg-sidebar-accent/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-sidebar-foreground/60">{t('common.plan')}</p>
                  <p className="text-sm font-medium text-sidebar-foreground">
                    {t('common.professional')}
                  </p>
                </div>
                <a
                  href="/settings"
                  className="rounded-md bg-primary/20 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/30"
                >
                  {t('common.upgrade')}
                </a>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <a
                href="/settings"
                className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent"
                title={t('common.upgrade')}
                aria-label={t('common.upgrade')}
              >
                <Zap size={18} />
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
              aria-label={t('header.openMenu')}
            >
              <Menu size={20} />
            </button>

            {/* Global search trigger */}
            <CommandPaletteTrigger onClick={() => setCommandPaletteOpen(true)} label={t('header.search')} />
          </div>

          <div className="flex items-center gap-2">
            {/* Emergency stop button */}
            <button
              type="button"
              onClick={() => setEmergencyStopModalOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                emergencyStopped
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-red-600 text-white hover:bg-red-700',
              )}
              disabled={emergencyStopped}
              aria-label={t('header.emergencyStop')}
            >
              <ShieldAlert size={16} />
              <span className="hidden sm:inline">{t('header.emergencyStop')}</span>
            </button>

            {/* Language switcher */}
            <LanguageSwitcher />

            {/* Notification bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setUserDropdownOpen(false);
                }}
                className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={t('header.showNotifications')}
                aria-expanded={notificationsOpen}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <NotificationPanel
                notifications={notifications}
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onMarkAllRead={handleMarkAllRead}
              />
            </div>

            {/* User avatar / dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserDropdownOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-accent"
                aria-label={t('header.userMenu')}
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  U
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-foreground">
                    {t('common.username')}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('common.admin')}</p>
                </div>
                <ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
              </button>

              <UserDropdown
                open={userDropdownOpen}
                onClose={() => setUserDropdownOpen(false)}
              />
            </div>
          </div>
        </header>

        {/* Emergency stop banner */}
        {emergencyStopped && (
          <div className="flex items-center justify-between bg-red-600 px-4 py-2 text-white">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <span className="text-sm font-semibold">
                {t('header.emergencyStopped')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleEmergencyResume}
              className="rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-white/30"
            >
              {t('header.resume')}
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <TRPCProvider>{children}</TRPCProvider>
        </main>
      </div>

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* Emergency stop confirmation modal */}
      {emergencyStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <ShieldAlert size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{t('common.confirmEmergencyStop')}</h2>
            </div>
            <p className="text-sm text-foreground">
              {t('common.emergencyStopBody')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('common.emergencyStopDetail')}
            </p>
            {emergencyError && (
              <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-sm text-destructive">{emergencyError}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEmergencyStopModalOpen(false)}
                disabled={emergencyStopping}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleEmergencyStop}
                disabled={emergencyStopping}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {emergencyStopping && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {t('common.allStop')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
