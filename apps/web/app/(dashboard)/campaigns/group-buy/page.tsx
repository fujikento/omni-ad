'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Inbox,
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
            {groups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Inbox size={28} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              groups.map((group) => {
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
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViralSpreadChart({ data }: { data: ViralGrowthPoint[] }): React.ReactElement {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t('groupBuy.viralGrowth')}
        </h3>
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

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

  const emptyCard = (titleKey: string): React.ReactElement => (
    <div key={titleKey} className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t(titleKey)}</h3>
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
        <Inbox size={24} className="text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">{t('common.noData')}</p>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Pie chart */}
      {shareData.length === 0 ? (
        emptyCard('groupBuy.platformBreakdown')
      ) : (
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
      )}

      {/* Referral chain */}
      {emptyCard('groupBuy.referralChain')}

      {/* Conversion by platform */}
      {emptyCard('groupBuy.conversionByPlatform')}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function GroupBuyPage(): React.ReactElement {
  const { t } = useI18n();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // trpc.groupBuy.listGroups requires a campaignId; this page is the
  // cross-campaign summary, so we render empty state until a campaign
  // context is available.
  const groups: GroupBuyGroup[] = [];
  const growthData: ViralGrowthPoint[] = [];
  const shareData: ShareData[] = [];

  const activeGroups = groups.filter((g) => g.status === 'active');
  const totalParticipants = groups.reduce((sum, g) => sum + g.currentParticipants, 0);
  const completedCount = groups.filter((g) => g.status === 'completed').length;
  const viralCoefficient = 0;
  const tierAchievementRate =
    groups.length > 0 ? Math.round((completedCount / groups.length) * 100) : 0;

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
      <GroupsTable groups={groups} />

      {/* Viral growth chart */}
      <ViralSpreadChart data={growthData} />

      {/* Share analytics */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t('groupBuy.shareAnalytics')}
        </h2>
        <ShareAnalytics shareData={shareData} />
      </div>

      {/* Create modal */}
      <CreateGroupBuyModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
