'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Minus,
  Plus,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, PageHeader, StatCard } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type GroupStatus = 'active' | 'completed' | 'expired';
type SharePlatform = 'line' | 'x' | 'meta' | 'tiktok';

interface DiscountTier {
  id: string;
  participants: number;
  discountPercent: number;
}

interface GroupBuyGroup {
  id: string;
  initiator: string;
  currentParticipants: number;
  targetParticipants: number;
  currentTier: number;
  status: GroupStatus;
  remainingHours: number;
  createdAt: string;
}

interface ShareData {
  platform: string;
  count: number;
  color: string;
}

interface ViralGrowthPoint {
  hour: string;
  groups: number;
  participants: number;
}

interface CreateFormData {
  name: string;
  product: string;
  tiers: DiscountTier[];
  platforms: Set<SharePlatform>;
  expirationHours: number;
}

// ============================================================
// Constants
// ============================================================

const GROUP_STATUS_CONFIG: Record<GroupStatus, { labelKey: string; className: string }> = {
  active: {
    labelKey: 'groupBuy.statusActive',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  completed: {
    labelKey: 'groupBuy.statusCompleted',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  expired: {
    labelKey: 'groupBuy.statusExpired',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

const SHARE_PLATFORMS: { id: SharePlatform; label: string }[] = [
  { id: 'line', label: 'LINE' },
  { id: 'x', label: 'X' },
  { id: 'meta', label: 'Meta' },
  { id: 'tiktok', label: 'TikTok' },
];

function getMockGroups(t: (key: string, params?: Record<string, string | number>) => string): GroupBuyGroup[] {
  return [
  { id: 'GB-001', initiator: t('campaigns.groupbuy.ha2aa03'), currentParticipants: 7, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 18, createdAt: '2026-04-01 14:30' },
  { id: 'GB-002', initiator: t('campaigns.groupbuy.ha378db'), currentParticipants: 10, targetParticipants: 10, currentTier: 3, status: 'completed', remainingHours: 0, createdAt: '2026-04-01 10:00' },
  { id: 'GB-003', initiator: t('campaigns.groupbuy.h1b5221'), currentParticipants: 4, targetParticipants: 10, currentTier: 1, status: 'active', remainingHours: 36, createdAt: '2026-04-01 18:00' },
  { id: 'GB-004', initiator: t('campaigns.groupbuy.h614a7a'), currentParticipants: 5, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 12, createdAt: '2026-04-01 16:00' },
  { id: 'GB-005', initiator: t('campaigns.groupbuy.ha163dd'), currentParticipants: 2, targetParticipants: 10, currentTier: 0, status: 'expired', remainingHours: 0, createdAt: '2026-03-30 09:00' },
  { id: 'GB-006', initiator: t('campaigns.groupbuy.h06ed61'), currentParticipants: 8, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 6, createdAt: '2026-04-02 08:00' },
  { id: 'GB-007', initiator: t('campaigns.groupbuy.h841e64'), currentParticipants: 10, targetParticipants: 10, currentTier: 3, status: 'completed', remainingHours: 0, createdAt: '2026-04-01 11:30' },
  { id: 'GB-008', initiator: t('campaigns.groupbuy.h73d821'), currentParticipants: 6, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 24, createdAt: '2026-04-02 06:00' },
  { id: 'GB-009', initiator: t('campaigns.groupbuy.hf30e74'), currentParticipants: 3, targetParticipants: 10, currentTier: 1, status: 'active', remainingHours: 42, createdAt: '2026-04-02 09:00' },
  { id: 'GB-010', initiator: t('campaigns.groupbuy.h5a79f9'), currentParticipants: 9, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 4, createdAt: '2026-04-02 07:00' },
  { id: 'GB-011', initiator: t('campaigns.groupbuy.he77f4c'), currentParticipants: 10, targetParticipants: 10, currentTier: 3, status: 'completed', remainingHours: 0, createdAt: '2026-03-31 15:00' },
  { id: 'GB-012', initiator: t('campaigns.groupbuy.h846175'), currentParticipants: 5, targetParticipants: 10, currentTier: 2, status: 'active', remainingHours: 20, createdAt: '2026-04-02 10:00' },
];
}

const MOCK_SHARE_DATA: ShareData[] = [
  { platform: 'LINE', count: 420, color: '#06C755' },
  { platform: 'X', count: 180, color: '#1DA1F2' },
  { platform: 'Meta', count: 250, color: '#1877F2' },
  { platform: 'TikTok', count: 150, color: '#FF0050' },
];

const MOCK_GROWTH_DATA: ViralGrowthPoint[] = [
  { hour: '0h', groups: 2, participants: 6 },
  { hour: '4h', groups: 4, participants: 14 },
  { hour: '8h', groups: 6, participants: 24 },
  { hour: '12h', groups: 8, participants: 38 },
  { hour: '16h', groups: 9, participants: 52 },
  { hour: '20h', groups: 10, participants: 64 },
  { hour: '24h', groups: 12, participants: 78 },
];

const REFERRAL_CHAIN_DATA = [
  { depth: 1, count: 45 },
  { depth: 2, count: 28 },
  { depth: 3, count: 12 },
  { depth: 4, count: 5 },
  { depth: 5, count: 2 },
];

const CONVERSION_BY_PLATFORM = [
  { platform: 'LINE', rate: 12.4 },
  { platform: 'X', rate: 6.8 },
  { platform: 'Meta', rate: 9.2 },
  { platform: 'TikTok', rate: 8.1 },
];

const DEFAULT_TIERS: DiscountTier[] = [
  { id: 't1', participants: 3, discountPercent: 15 },
  { id: 't2', participants: 5, discountPercent: 25 },
  { id: 't3', participants: 10, discountPercent: 35 },
];

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({
  labelKey,
  value,
  icon,
  color,
}: {
  labelKey: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <StatCard
      label={t(labelKey)}
      value={value}
      icon={<span className={color}>{icon}</span>}
    />
  );
}

function CreateGroupBuyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  const { t } = useI18n();
  const [form, setForm] = useState<CreateFormData>({
    name: '',
    product: '',
    tiers: DEFAULT_TIERS,
    platforms: new Set<SharePlatform>(['line', 'x', 'meta']),
    expirationHours: 48,
  });

  if (!open) return null;

  function addTier(): void {
    setForm((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        {
          id: `t${prev.tiers.length + 1}`,
          participants: (prev.tiers[prev.tiers.length - 1]?.participants ?? 5) + 5,
          discountPercent: (prev.tiers[prev.tiers.length - 1]?.discountPercent ?? 30) + 10,
        },
      ],
    }));
  }

  function removeTier(id: string): void {
    if (form.tiers.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((tier) => tier.id !== id),
    }));
  }

  function updateTier(id: string, field: 'participants' | 'discountPercent', value: number): void {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier) =>
        tier.id === id ? { ...tier, [field]: value } : tier,
      ),
    }));
  }

  function togglePlatform(platform: SharePlatform): void {
    setForm((prev) => {
      const next = new Set(prev.platforms);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return { ...prev, platforms: next };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            {t('groupBuy.createTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Campaign name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('groupBuy.campaignName')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              placeholder={t('groupBuy.campaignNamePlaceholder')}
            />
          </div>

          {/* Product */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('groupBuy.productService')}
            </label>
            <input
              type="text"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              placeholder={t('groupBuy.productPlaceholder')}
            />
          </div>

          {/* Discount tiers */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('groupBuy.discountTiers')}
            </label>
            <div className="space-y-2">
              {form.tiers.map((tier, i) => (
                <div key={tier.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={tier.participants}
                      onChange={(e) => updateTier(tier.id, 'participants', parseInt(e.target.value, 10) || 1)}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground text-center focus:border-primary focus:outline-none"
                      aria-label={t('groupBuy.participants')}
                    />
                    <span className="text-xs text-muted-foreground">{t('groupBuy.personsArrow')}</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={tier.discountPercent}
                      onChange={(e) => updateTier(tier.id, 'discountPercent', parseInt(e.target.value, 10) || 1)}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground text-center focus:border-primary focus:outline-none"
                      aria-label={t('groupBuy.discount')}
                    />
                    <span className="text-xs text-muted-foreground">% OFF</span>
                  </div>
                  {form.tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(tier.id)}
                      className="rounded p-1 text-muted-foreground hover:text-red-500"
                      aria-label={t('common.delete')}
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTier}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Plus size={14} />
              {t('groupBuy.addTier')}
            </button>
          </div>

          {/* Share platforms */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('groupBuy.sharePlatforms')}
            </label>
            <div className="flex flex-wrap gap-2">
              {SHARE_PLATFORMS.map((platform) => {
                const selected = form.platforms.has(platform.id);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:border-primary/40',
                    )}
                    aria-pressed={selected}
                  >
                    {selected && <Check size={12} />}
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t('groupBuy.expiration')}
            </label>
            <div className="flex gap-2">
              {[24, 48, 72].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setForm({ ...form, expirationHours: hours })}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    form.expirationHours === hours
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground hover:border-primary/40',
                  )}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={!form.name.trim() || !form.product.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupsTable({ groups }: { groups: GroupBuyGroup[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">
          {t('groupBuy.activeGroups')}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{t('groupBuy.groupId')}</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{t('groupBuy.initiator')}</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">{t('groupBuy.participantsGoal')}</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">{t('groupBuy.currentTier')}</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">{t('common.status')}</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{t('groupBuy.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const statusConfig = GROUP_STATUS_CONFIG[group.status];
              const pct = (group.currentParticipants / group.targetParticipants) * 100;
              return (
                <tr key={group.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium text-foreground">{group.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">{group.initiator}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            pct >= 100 ? 'bg-green-500' : 'bg-primary',
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {group.currentParticipants}/{group.targetParticipants}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {group.currentTier > 0 ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">
                        Tier {group.currentTier}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', statusConfig.className)}>
                      {t(statusConfig.labelKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {group.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} />
                        {group.remainingHours}h
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViralSpreadChart({ data }: { data: ViralGrowthPoint[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        {t('groupBuy.viralGrowth')}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="participants"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              strokeWidth={2}
              name={t('groupBuy.totalParticipants')}
            />
            <Area
              type="monotone"
              dataKey="groups"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.1}
              strokeWidth={2}
              name={t('groupBuy.activeGroupsCount')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ShareAnalytics({
  shareData,
}: {
  shareData: ShareData[];
}): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Pie chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t('groupBuy.platformBreakdown')}
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shareData}
                dataKey="count"
                nameKey="platform"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
              >
                {shareData.map((entry) => (
                  <Cell key={entry.platform} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {shareData.map((entry) => (
            <div key={entry.platform} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[10px] text-muted-foreground">{entry.platform}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral chain */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t('groupBuy.referralChain')}
        </h3>
        <div className="space-y-2">
          {REFERRAL_CHAIN_DATA.map((item) => {
            const maxCount = REFERRAL_CHAIN_DATA[0]?.count ?? 1;
            const pct = (item.count / maxCount) * 100;
            return (
              <div key={item.depth} className="flex items-center gap-2">
                <span className="w-16 text-xs text-muted-foreground">
                  {t('groupBuy.depth')} {item.depth}
                </span>
                <div className="flex-1 h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-foreground">{item.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion by platform */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t('groupBuy.conversionByPlatform')}
        </h3>
        <div className="space-y-3">
          {CONVERSION_BY_PLATFORM.map((item) => (
            <div key={item.platform} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{item.platform}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${(item.rate / 15) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-foreground">{item.rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function GroupBuyPage(): React.ReactElement {
  const { t } = useI18n();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const activeGroups = getMockGroups(t).filter((g) => g.status === 'active');
  const totalParticipants = getMockGroups(t).reduce((sum, g) => sum + g.currentParticipants, 0);
  const viralCoefficient = 2.3;
  const tierAchievementRate = Math.round(
    (getMockGroups(t).filter((g) => g.status === 'completed').length / getMockGroups(t).length) * 100,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            {t('nav.campaigns')}
          </Link>
        }
        title={t('groupBuy.title')}
        description={t('groupBuy.description')}
        actions={
          <Button
            size="sm"
            leadingIcon={<Plus size={14} />}
            onClick={() => setCreateModalOpen(true)}
          >
            {t('groupBuy.createNew')}
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          labelKey="groupBuy.kpiActiveGroups"
          value={String(activeGroups.length)}
          icon={<Users size={16} />}
          color="text-primary"
        />
        <KpiCard
          labelKey="groupBuy.kpiTotalParticipants"
          value={totalParticipants.toLocaleString()}
          icon={<UserPlus size={16} />}
          color="text-blue-500"
        />
        <KpiCard
          labelKey="groupBuy.kpiViralCoefficient"
          value={viralCoefficient.toFixed(1)}
          icon={<TrendingUp size={16} />}
          color="text-green-500"
        />
        <KpiCard
          labelKey="groupBuy.kpiTierAchievement"
          value={`${tierAchievementRate}%`}
          icon={<Trophy size={16} />}
          color="text-yellow-500"
        />
      </div>

      {/* Groups table */}
      <GroupsTable groups={getMockGroups(t)} />

      {/* Viral growth chart */}
      <ViralSpreadChart data={MOCK_GROWTH_DATA} />

      {/* Share analytics */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t('groupBuy.shareAnalytics')}
        </h2>
        <ShareAnalytics shareData={MOCK_SHARE_DATA} />
      </div>

      {/* Create modal */}
      <CreateGroupBuyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
