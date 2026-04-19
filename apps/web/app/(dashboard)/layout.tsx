'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BrainCircuit,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
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
  Swords,
  TrendingUp,
  User,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { Button } from '@omni-ad/ui';
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
      { labelKey: 'nav.dashboard', href: '/home', icon: <Home size={18} /> },
    ],
  },
  {
    titleKey: 'nav.aiOps',
    items: [
      { labelKey: 'nav.competitors', href: '/competitors', icon: <Swords size={18} /> },
      { labelKey: 'nav.autoRules', href: '/auto-rules', icon: <Workflow size={18} /> },
    ],
  },
  {
    titleKey: 'nav.adManagement',
    items: [
      { labelKey: 'nav.campaigns', href: '/campaigns', icon: <LayoutDashboard size={18} /> },
      { labelKey: 'nav.creatives', href: '/creatives', icon: <BrainCircuit size={18} /> },
      { labelKey: 'nav.creativeOptimization', href: '/creatives/optimization', icon: <RefreshCw size={18} /> },
      { labelKey: 'nav.audiences', href: '/audiences', icon: <Users size={18} /> },
      { labelKey: 'nav.identityGraph', href: '/audiences/identity-graph', icon: <Fingerprint size={18} /> },
      { labelKey: 'nav.funnels', href: '/funnels', icon: <GitFork size={18} /> },
    ],
  },
  {
    titleKey: 'nav.analysisOptimization',
    items: [
      { labelKey: 'nav.analytics', href: '/analytics', icon: <BarChart3 size={18} /> },
      { labelKey: 'nav.budgets', href: '/budgets', icon: <Gauge size={18} /> },
      { labelKey: 'nav.abTests', href: '/ab-tests', icon: <FlaskConical size={18} /> },
      { labelKey: 'nav.ltv', href: '/ltv', icon: <TrendingUp size={18} /> },
      { labelKey: 'nav.reports', href: '/reports', icon: <ScrollText size={18} /> },
    ],
  },
  {
    titleKey: 'nav.management',
    items: [
      { labelKey: 'nav.accountAnalysis', href: '/account-analysis', icon: <ScanSearch size={18} /> },
      { labelKey: 'nav.clients', href: '/clients', icon: <Building2 size={18} /> },
      { labelKey: 'nav.approvals', href: '/approvals', icon: <CheckSquare size={18} /> },
      { labelKey: 'nav.settings', href: '/settings', icon: <Settings size={18} /> },
    ],
  },
];

const SEVERITY_DOT_CLASS: Record<NotificationSeverity, string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

// ============================================================
// Subcomponents
// ============================================================

function isRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Treat nested routes as active except when href is a parent of multiple
  // siblings (e.g. /campaigns should not match nested campaign sub-pages).
  if (href === '/campaigns') return pathname === '/campaigns';
  if (href === '/creatives') return pathname === '/creatives';
  if (href === '/audiences') return pathname === '/audiences';
  if (href === '/settings') return pathname === '/settings' || pathname.startsWith('/settings/');
  if (href === '/account-analysis') return pathname.startsWith('/account-analysis');
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
      className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:w-96 animate-slide-up"
      role="dialog"
      aria-label={t('header.notificationPanel')}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{t('header.notifications')}</h3>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
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
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
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
      className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-slide-up"
      role="menu"
      aria-label={t('header.userMenu')}
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">{currentUser?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{currentUser?.email ?? ''}</p>
      </div>
      {menuItems.map((item) => (
        <a
          key={item.labelKey}
          href={item.href}
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
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
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
          role="menuitem"
        >
          <LogOut size={14} />
          {t('header.logout')}
        </button>
      </div>
    </div>
  );
}

function BrandMark({ collapsed }: { collapsed: boolean }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[11px] font-bold text-primary-foreground shadow-sm"
        aria-hidden="true"
      >
        OA
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">OMNI-AD</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
            Operator Console
          </span>
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
  t?: (key: string) => string,
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
      ?? t?.('layout.requestFailed') ?? 'Request failed';
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

interface CurrentUser {
  name: string;
  email: string;
  role: string;
}

interface MeQueryResult {
  result?: { data?: { json?: CurrentUser } };
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('omni-ad-token');
  if (!token) return null;
  const response = await fetch(`${API_URL}/auth.me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as MeQueryResult | null;
  return body?.result?.data?.json ?? null;
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
    throw new Error('Failed to fetch notifications');
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
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Client-side auth gate. The actual security boundary is the API (401 on
  // every tRPC call), but unauthenticated visitors should not see the
  // dashboard chrome or navigation map. Token currently lives in
  // localStorage, so this check must run client-side.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('omni-ad-token');
    if (!token) {
      window.location.replace('/login');
      return;
    }
    setAuthChecked(true);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [emergencyStopModalOpen, setEmergencyStopModalOpen] = useState(false);
  const [emergencyStopped, setEmergencyStopped] = useState(false);
  const [emergencyStopping, setEmergencyStopping] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!authChecked) return;
    fetchCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, [authChecked]);

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

  // Fetch real notifications from API
  const loadNotifications = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // API unavailable -- keep empty state
    } finally {
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
        : t('layout.emergencyStopFailed');
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
        : t('layout.resumeFailed');
      setEmergencyError(message);
    }
  }

  // Block all rendering until the auth gate confirms a token exists.
  if (!authChecked) {
    return <div className="h-screen w-screen bg-background" aria-hidden="true" />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label={t('header.closeMenu')}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative lg:z-auto',
          sidebarOpen ? 'w-[248px]' : 'w-16',
          mobileMenuOpen
            ? 'flex translate-x-0'
            : 'hidden lg:flex lg:translate-x-0',
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <BrandMark collapsed={!sidebarOpen} />
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:block"
            aria-label={sidebarOpen ? t('header.closeSidebar') : t('header.openSidebar')}
          >
            <ChevronLeft
              size={16}
              className={cn('transition-transform', !sidebarOpen && 'rotate-180')}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label={t('header.mainNav')}>
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey || '_top'} className={cn(group.titleKey && 'mt-5 first:mt-0')}>
              {group.titleKey && sidebarOpen && (
                <div className="mb-1.5 px-3 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                    {t(group.titleKey)}
                  </span>
                </div>
              )}
              {group.titleKey && !sidebarOpen && (
                <div className="my-3 mx-2 border-t border-sidebar-border/60" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                        !sidebarOpen && 'justify-center px-2',
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-primary"
                        />
                      )}
                      <span className="relative flex-shrink-0">
                        <span className={cn('transition-colors', active && 'text-primary')}>
                          {item.icon}
                        </span>
                        {!sidebarOpen && item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                            {item.badge}
                          </span>
                        )}
                        {item.activeIndicator && (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2">
                            <span className="absolute inset-0 animate-ping rounded-full bg-success/75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                        )}
                      </span>
                      {sidebarOpen && (
                        <span className="flex flex-1 items-center justify-between">
                          <span className="truncate">{t(item.labelKey)}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/90 px-1.5 text-[10px] font-semibold text-destructive-foreground">
                              {item.badge}
                            </span>
                          )}
                          {item.activeIndicator && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inset-0 animate-ping rounded-full bg-success/75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                            </span>
                          )}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
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

          <div className="flex items-center gap-1.5">
            {/* Emergency stop button */}
            <Button
              variant={emergencyStopped ? 'outline' : 'destructive'}
              size="sm"
              onClick={() => setEmergencyStopModalOpen(true)}
              disabled={emergencyStopped}
              aria-label={t('header.emergencyStop')}
              leadingIcon={<ShieldAlert size={14} />}
            >
              <span className="hidden sm:inline">{t('header.emergencyStop')}</span>
            </Button>

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
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-card">
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
                className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-accent"
                aria-label={t('header.userMenu')}
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info text-xs font-semibold text-primary-foreground shadow-xs">
                  U
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-medium leading-tight text-foreground">
                    {currentUser?.name ?? '—'}
                  </p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {currentUser?.role ?? ''}
                  </p>
                </div>
                <ChevronDown size={12} className="hidden text-muted-foreground sm:block" />
              </button>

              <UserDropdown
                open={userDropdownOpen}
                onClose={() => setUserDropdownOpen(false)}
                currentUser={currentUser}
              />
            </div>
          </div>
        </header>

        {/* Emergency stop banner */}
        {emergencyStopped && (
          <div className="flex items-center justify-between bg-destructive px-4 py-2.5 text-destructive-foreground">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} />
              <span className="text-sm font-semibold">
                {t('header.emergencyStopped')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmergencyResume}
              className="border-white/30 bg-white/10 text-destructive-foreground hover:bg-white/20"
            >
              {t('header.resume')}
            </Button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg animate-slide-up">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert size={20} className="text-destructive" />
              </div>
              <h2 className="text-base font-semibold text-foreground">{t('common.confirmEmergencyStop')}</h2>
            </div>
            <p className="text-sm text-foreground">
              {t('common.emergencyStopBody')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('common.emergencyStopDetail')}
            </p>
            {emergencyError && (
              <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
                <p className="text-sm text-destructive">{emergencyError}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEmergencyStopModalOpen(false)}
                disabled={emergencyStopping}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleEmergencyStop}
                loading={emergencyStopping}
              >
                {t('common.allStop')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
