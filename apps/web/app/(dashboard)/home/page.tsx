'use client';

import {
  Activity,
  ArrowUpRight,
  DollarSign,
  MousePointerClick,
  Plus,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  PlatformBadge,
  PlatformIcon,
  StatCard,
} from '@omni-ad/ui';
import { Platform, PLATFORM_BRAND_COLORS, PLATFORM_SHORT_NAMES } from '@omni-ad/shared';
import { useI18n } from '@/lib/i18n';

interface PlatformSummary {
  platform: Platform;
  spend: string;
  roas: string;
  delta: number;
  status: 'live' | 'paused' | 'disconnected';
}

const PLATFORM_SUMMARIES: PlatformSummary[] = [
  { platform: Platform.META, spend: '¥284,500', roas: '4.82', delta: 12.3, status: 'live' },
  { platform: Platform.GOOGLE, spend: '¥412,100', roas: '3.91', delta: 5.8, status: 'live' },
  { platform: Platform.X, spend: '¥48,200', roas: '2.14', delta: -3.2, status: 'live' },
  { platform: Platform.TIKTOK, spend: '¥156,800', roas: '5.42', delta: 24.1, status: 'live' },
  { platform: Platform.LINE_YAHOO, spend: '¥92,300', roas: '3.55', delta: 2.1, status: 'live' },
  { platform: Platform.AMAZON, spend: '¥0', roas: '—', delta: 0, status: 'disconnected' },
  { platform: Platform.MICROSOFT, spend: '¥0', roas: '—', delta: 0, status: 'disconnected' },
];

interface ActivityItem {
  id: string;
  kind: 'deploy' | 'pause' | 'alert' | 'optimize';
  title: string;
  meta: string;
  platform?: Platform;
  time: string;
}

const RECENT_ACTIVITY: ActivityItem[] = [
  { id: '1', kind: 'optimize', title: 'AI が予算を自動再配分', meta: '+¥12,000 / day', platform: Platform.META, time: '2分前' },
  { id: '2', kind: 'deploy', title: '新クリエイティブをデプロイ', meta: 'Summer Sale v3', platform: Platform.TIKTOK, time: '18分前' },
  { id: '3', kind: 'alert', title: 'CPA 閾値を超過', meta: 'Campaign #A8472', platform: Platform.GOOGLE, time: '1時間前' },
  { id: '4', kind: 'pause', title: 'キャンペーンを自動停止', meta: 'ROAS < 1.5', platform: Platform.X, time: '3時間前' },
];

const ACTIVITY_ICON: Record<ActivityItem['kind'], React.ReactElement> = {
  deploy: <Zap size={14} className="text-info" />,
  pause: <Activity size={14} className="text-warning" />,
  alert: <Activity size={14} className="text-destructive" />,
  optimize: <TrendingUp size={14} className="text-success" />,
};

export default function DashboardPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={t('dashboard.title')}
        description="全プラットフォーム横断の配信状況・AI 判断・承認待ちを 1 画面で把握します。"
        actions={
          <>
            <Button variant="secondary" size="sm" leadingIcon={<Activity size={14} />}>
              ライブモニター
            </Button>
            <Button size="sm" leadingIcon={<Plus size={14} />}>
              新規キャンペーン
            </Button>
          </>
        }
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="総広告費 (今月)"
          value="¥993,900"
          delta={8.4}
          deltaTone="inverse"
          deltaLabel="vs 先月"
          icon={<DollarSign size={16} />}
        />
        <StatCard
          label="平均 ROAS"
          value="4.12"
          unit="x"
          delta={12.8}
          deltaLabel="vs 先月"
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="コンバージョン"
          value="8,472"
          delta={18.6}
          deltaLabel="vs 先月"
          icon={<Target size={16} />}
        />
        <StatCard
          label="アクティブキャンペーン"
          value="23"
          delta={0}
          deltaLabel="稼働中"
          icon={<MousePointerClick size={16} />}
        />
      </div>

      {/* Platform grid + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>プラットフォーム別パフォーマンス</CardTitle>
              <CardDescription>直近 7 日間の広告費と ROAS</CardDescription>
            </div>
            <Badge variant="outline" size="sm" dot dotClassName="bg-success">
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {PLATFORM_SUMMARIES.map((summary) => {
                const brandColor = PLATFORM_BRAND_COLORS[summary.platform];
                const isConnected = summary.status !== 'disconnected';
                return (
                  <div
                    key={summary.platform}
                    className={
                      'relative overflow-hidden rounded-md border border-border bg-card p-3 transition-colors hover:border-border/60'
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-0.5"
                      style={{ backgroundColor: brandColor, opacity: isConnected ? 1 : 0.25 }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={summary.platform} size={16} />
                        <span className="text-xs font-semibold text-foreground">
                          {PLATFORM_SHORT_NAMES[summary.platform]}
                        </span>
                      </div>
                      {isConnected ? (
                        <Badge size="sm" variant="success" dot>
                          Live
                        </Badge>
                      ) : (
                        <Badge size="sm" variant="neutral">
                          未接続
                        </Badge>
                      )}
                    </div>
                    {isConnected ? (
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Spend
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {summary.spend}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            ROAS
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {summary.roas}x
                            </span>
                            {summary.delta !== 0 && (
                              <span
                                className={
                                  summary.delta > 0
                                    ? 'text-[10px] font-medium tabular-nums text-success'
                                    : 'text-[10px] font-medium tabular-nums text-destructive'
                                }
                              >
                                {summary.delta > 0 ? '+' : ''}
                                {summary.delta.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5">
                        <a
                          href="/settings"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                        >
                          接続する
                          <ArrowUpRight size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>アクティビティ</CardTitle>
            <CardDescription>AI とオペレーターの直近の操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RECENT_ACTIVITY.length === 0 ? (
              <EmptyState
                icon={<Activity size={18} />}
                title="アクティビティなし"
                description="広告運用を開始するとここに履歴が表示されます。"
              />
            ) : (
              RECENT_ACTIVITY.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
                >
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted">
                    {ACTIVITY_ICON[item.kind]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight text-foreground">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {item.platform && <PlatformBadge platform={item.platform} size="sm" />}
                      <span className="text-xs text-muted-foreground">{item.meta}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty-state CTA when nothing connected */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.welcomeTitle')}</CardTitle>
          <CardDescription>{t('dashboard.welcomeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/settings"
              className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              <Plus size={14} />
              {t('dashboard.connectPlatform')}
            </a>
            <span className="text-xs text-muted-foreground">
              対応: Meta, Google, X, TikTok, LINE/Yahoo, Amazon, Microsoft
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
