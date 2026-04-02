'use client';

import { useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Edit3,
  FolderKanban,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';

// ============================================================
// Types
// ============================================================

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
type Platform = 'google' | 'meta' | 'tiktok' | 'line' | 'x' | 'yahoo_japan';
type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversion' | 'retargeting';
type SortField = 'name' | 'status' | 'budget' | 'roas' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platforms: Platform[];
  budget: { total: number; currency: string; dailyLimit?: number };
  roas: number;
  updatedAt: string;
  objective: Objective;
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: '配信中', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  paused: { label: '一時停止', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { label: '完了', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  archived: { label: 'アーカイブ', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const ALL_STATUSES: CampaignStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  google: { label: 'Google', color: 'bg-blue-500' },
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line: { label: 'LINE', color: 'bg-green-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  yahoo_japan: { label: 'Yahoo!', color: 'bg-red-500' },
};

const ALL_PLATFORMS: Platform[] = ['google', 'meta', 'tiktok', 'line', 'x', 'yahoo_japan'];

const OBJECTIVE_OPTIONS: { value: Objective; label: string }[] = [
  { value: 'awareness', label: '認知拡大' },
  { value: 'traffic', label: 'トラフィック' },
  { value: 'engagement', label: 'エンゲージメント' },
  { value: 'leads', label: 'リード獲得' },
  { value: 'conversion', label: 'コンバージョン' },
  { value: 'retargeting', label: 'リターゲティング' },
];

const OBJECTIVE_LABELS: Record<Objective, string> = {
  awareness: '認知拡大',
  traffic: 'トラフィック',
  engagement: 'エンゲージメント',
  leads: 'リード獲得',
  conversion: 'コンバージョン',
  retargeting: 'リターゲティング',
};

const TABLE_COLUMNS: { key: SortField | 'platforms' | 'actions'; label: string; sortable: boolean }[] = [
  { key: 'name', label: '名前', sortable: true },
  { key: 'status', label: 'ステータス', sortable: true },
  { key: 'platforms', label: '配信先', sortable: false },
  { key: 'budget', label: '予算', sortable: true },
  { key: 'roas', label: 'ROAS', sortable: true },
  { key: 'updatedAt', label: '更新日', sortable: true },
  { key: 'actions', label: '操作', sortable: false },
];

const EXPORT_COLUMNS = [
  { key: 'name' as const, label: 'キャンペーン名' },
  { key: 'status' as const, label: 'ステータス', format: (v: Campaign[keyof Campaign]) => STATUS_CONFIG[v as CampaignStatus]?.label ?? String(v) },
  { key: 'platforms' as const, label: '配信先', format: (v: Campaign[keyof Campaign]) => (v as Platform[]).map((p) => PLATFORM_CONFIG[p]?.label ?? p).join(', ') },
  { key: 'budget' as const, label: '予算', format: (v: Campaign[keyof Campaign]) => String((v as Campaign['budget']).total) },
  { key: 'roas' as const, label: 'ROAS', format: (v: Campaign[keyof Campaign]) => `${Number(v).toFixed(1)}x` },
  { key: 'objective' as const, label: '目的', format: (v: Campaign[keyof Campaign]) => OBJECTIVE_LABELS[v as Objective] ?? String(v) },
  { key: 'updatedAt' as const, label: '更新日' },
];

// ============================================================
// Mock data
// ============================================================

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1', name: '春のプロモーション2026', status: 'active',
    platforms: ['google', 'meta', 'line'],
    budget: { total: 500000, currency: 'JPY', dailyLimit: 50000 },
    roas: 3.2, updatedAt: '2026-04-01T10:00:00Z', objective: 'conversion',
  },
  {
    id: '2', name: 'TikTok新規獲得キャンペーン', status: 'paused',
    platforms: ['tiktok'],
    budget: { total: 200000, currency: 'JPY' },
    roas: 1.8, updatedAt: '2026-03-28T14:30:00Z', objective: 'leads',
  },
  {
    id: '3', name: 'ブランド認知拡大', status: 'draft',
    platforms: ['google', 'meta', 'x', 'yahoo_japan'],
    budget: { total: 1000000, currency: 'JPY', dailyLimit: 100000 },
    roas: 0, updatedAt: '2026-03-25T09:00:00Z', objective: 'awareness',
  },
  {
    id: '4', name: '年末セール 2025', status: 'completed',
    platforms: ['google', 'meta', 'line', 'yahoo_japan'],
    budget: { total: 800000, currency: 'JPY' },
    roas: 4.5, updatedAt: '2026-01-15T18:00:00Z', objective: 'retargeting',
  },
  {
    id: '5', name: 'GW特別セール', status: 'draft',
    platforms: ['google', 'meta', 'tiktok'],
    budget: { total: 600000, currency: 'JPY', dailyLimit: 60000 },
    roas: 0, updatedAt: '2026-04-02T08:00:00Z', objective: 'conversion',
  },
  {
    id: '6', name: 'LINE公式キャンペーン', status: 'active',
    platforms: ['line'],
    budget: { total: 300000, currency: 'JPY', dailyLimit: 30000 },
    roas: 2.6, updatedAt: '2026-04-01T16:00:00Z', objective: 'engagement',
  },
];

// ============================================================
// Subcomponents
// ============================================================

function StatusBadge({ status }: { status: CampaignStatus }): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function PlatformBadges({ platforms }: { platforms: Platform[] }): React.ReactElement {
  return (
    <div className="flex gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className={cn('inline-flex h-6 items-center rounded px-1.5 text-[10px] font-medium text-white', PLATFORM_CONFIG[p].color)}
          title={PLATFORM_CONFIG[p].label}
        >
          {PLATFORM_CONFIG[p].label}
        </span>
      ))}
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, currentField, direction, onSort }: SortHeaderProps): React.ReactElement {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        size={14}
        className={cn('transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground/40')}
        style={isActive && direction === 'desc' ? { transform: 'scaleY(-1)' } : undefined}
      />
    </button>
  );
}

function SkeletonRow(): React.ReactElement {
  return (
    <tr className="animate-pulse border-b border-border">
      <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-muted" /></td>
      {TABLE_COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-20 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// -- Campaign Detail Modal --

interface CampaignDetailModalProps {
  campaign: Campaign;
  onClose: () => void;
}

function CampaignDetailModal({ campaign, onClose }: CampaignDetailModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{campaign.name}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">ステータス</p>
              <StatusBadge status={campaign.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">目的</p>
              <p className="text-sm font-medium text-foreground">{OBJECTIVE_LABELS[campaign.objective]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">総予算</p>
              <p className="text-sm font-medium text-foreground">
                {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ROAS</p>
              <p className={cn(
                'text-sm font-semibold',
                campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-muted-foreground',
              )}>
                {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '--'}
              </p>
            </div>
            {campaign.budget.dailyLimit && (
              <div>
                <p className="text-xs text-muted-foreground">日次上限</p>
                <p className="text-sm text-foreground">
                  {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(campaign.budget.dailyLimit)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">更新日</p>
              <p className="text-sm text-foreground">
                {new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(campaign.updatedAt))}
              </p>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">配信プラットフォーム</p>
            <PlatformBadges platforms={campaign.platforms} />
          </div>

          {/* Change history stub */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">変更履歴</p>
            <div className="space-y-2">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                2026/04/01 10:00 — 予算を ¥400,000 から ¥500,000 に変更
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                2026/03/28 14:30 — ステータスを「配信中」に変更
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                2026/03/25 09:00 — キャンペーンを作成
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Create Campaign Modal --

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateCampaignModal({ open, onClose }: CreateCampaignModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Objective>('conversion');
  const [budgetTotal, setBudgetTotal] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name || !budgetTotal || selectedPlatforms.length === 0 || !startDate) return;

    createMutation.mutate({
      name,
      objective,
      totalBudget: budgetTotal,
      dailyBudget: dailyLimit || budgetTotal,
      startDate,
      endDate: endDate || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">新規キャンペーン作成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="campaign-name" className="mb-1 block text-sm font-medium text-foreground">
              キャンペーン名
            </label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="春のプロモーションキャンペーン"
              required
            />
          </div>

          <div>
            <label htmlFor="campaign-objective" className="mb-1 block text-sm font-medium text-foreground">
              目的
            </label>
            <div className="relative">
              <select
                id="campaign-objective"
                value={objective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjective(e.target.value as Objective)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {OBJECTIVE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campaign-budget" className="mb-1 block text-sm font-medium text-foreground">
                総予算 (JPY)
              </label>
              <input
                id="campaign-budget"
                type="number"
                value={budgetTotal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetTotal(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="500000"
                min="1"
                required
              />
            </div>
            <div>
              <label htmlFor="campaign-daily-limit" className="mb-1 block text-sm font-medium text-foreground">
                日次上限 (任意)
              </label>
              <input
                id="campaign-daily-limit"
                type="number"
                value={dailyLimit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyLimit(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="50000"
                min="1"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">配信プラットフォーム</span>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [Platform, { label: string; color: string }][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePlatform(key)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedPlatforms.includes(key)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {config.label}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campaign-start" className="mb-1 block text-sm font-medium text-foreground">
                開始日
              </label>
              <input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="campaign-end" className="mb-1 block text-sm font-medium text-foreground">
                終了日 (任意)
              </label>
              <input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name || !budgetTotal || selectedPlatforms.length === 0 || !startDate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Filter Bar --

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: CampaignStatus | 'all';
  onStatusChange: (value: CampaignStatus | 'all') => void;
  platformFilter: Set<Platform>;
  onPlatformToggle: (platform: Platform) => void;
  objectiveFilter: Objective | 'all';
  onObjectiveChange: (value: Objective | 'all') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformToggle,
  objectiveFilter,
  onObjectiveChange,
  hasActiveFilters,
  onClearFilters,
}: FilterBarProps): React.ReactElement {
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="キャンペーン名で検索..."
          aria-label="キャンペーン検索"
        />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onStatusChange(e.target.value as CampaignStatus | 'all')}
          className="appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="ステータスフィルター"
        >
          <option value="all">全ステータス</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Platform multi-select */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPlatformDropdownOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          aria-label="プラットフォームフィルター"
          aria-expanded={platformDropdownOpen}
        >
          <span>
            {platformFilter.size === 0
              ? '全プラットフォーム'
              : `${platformFilter.size}件選択`}
          </span>
          <ChevronDown size={14} className={cn('transition-transform', platformDropdownOpen && 'rotate-180')} />
        </button>
        {platformDropdownOpen && (
          <div className="absolute left-0 z-50 mt-1 w-48 overflow-hidden rounded-md border border-border bg-card shadow-lg">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPlatformToggle(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <div className={cn(
                  'flex h-4 w-4 items-center justify-center rounded border',
                  platformFilter.has(p) ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}>
                  {platformFilter.has(p) && <span className="text-[10px]">&#10003;</span>}
                </div>
                {PLATFORM_CONFIG[p].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Objective filter */}
      <div className="relative">
        <select
          value={objectiveFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onObjectiveChange(e.target.value as Objective | 'all')}
          className="appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="目的フィルター"
        >
          <option value="all">全目的</option>
          {OBJECTIVE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          <X size={14} />
          フィルターをクリア
        </button>
      )}
    </div>
  );
}

// -- Bulk Action Bar --

interface BulkActionBarProps {
  selectedCount: number;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

function BulkActionBar({
  selectedCount,
  onPause,
  onResume,
  onDelete,
  onDeselect,
}: BulkActionBarProps): React.ReactElement {
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-xl">
        <span className="text-sm font-semibold text-foreground">
          {selectedCount}件選択中
        </span>
        <div className="h-5 w-px bg-border" />
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1.5 rounded-md bg-yellow-100 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
        >
          <Pause size={12} />
          一時停止
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
        >
          <Play size={12} />
          再開
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          <Trash2 size={12} />
          削除
        </button>
        <div className="h-5 w-px bg-border" />
        <button
          type="button"
          onClick={onDeselect}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          選択解除
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CampaignsPage(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<Set<Platform>>(new Set());
  const [objectiveFilter, setObjectiveFilter] = useState<Objective | 'all'>('all');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // tRPC query with fallback to mock data
  const campaignsQuery = trpc.campaigns.list.useQuery(undefined, { retry: false });
  const pauseMutation = trpc.campaigns.pause.useMutation();
  const resumeMutation = trpc.campaigns.resume.useMutation();

  const campaigns: Campaign[] = campaignsQuery.error
    ? MOCK_CAMPAIGNS
    : (campaignsQuery.data as Campaign[] | undefined) ?? MOCK_CAMPAIGNS;

  const isLoading = campaignsQuery.isLoading && !campaignsQuery.error;

  // Apply filters
  const filteredCampaigns = campaigns.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter.size > 0 && !c.platforms.some((p) => platformFilter.has(p))) return false;
    if (objectiveFilter !== 'all' && c.objective !== objectiveFilter) return false;
    return true;
  });

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || platformFilter.size > 0 || objectiveFilter !== 'all';

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * modifier;
      case 'status':
        return a.status.localeCompare(b.status) * modifier;
      case 'budget':
        return (a.budget.total - b.budget.total) * modifier;
      case 'roas':
        return (a.roas - b.roas) * modifier;
      case 'updatedAt':
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * modifier;
      default:
        return 0;
    }
  });

  // Selection helpers
  const allVisibleSelected = sortedCampaigns.length > 0 && sortedCampaigns.every((c) => selectedIds.has(c.id));

  function toggleSelectAll(): void {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCampaigns.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handlePlatformToggle(platform: Platform): void {
    setPlatformFilter((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  function clearFilters(): void {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter(new Set());
    setObjectiveFilter('all');
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            キャンペーン管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全チャネルのキャンペーンを一元管理
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            data={sortedCampaigns}
            columns={EXPORT_COLUMNS}
            filename="campaigns"
          />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Plus size={16} />
            新規キャンペーン作成
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        platformFilter={platformFilter}
        onPlatformToggle={handlePlatformToggle}
        objectiveFilter={objectiveFilter}
        onObjectiveChange={setObjectiveFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {/* Checkbox column */}
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input text-primary accent-primary"
                    aria-label="全て選択"
                  />
                </th>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {column.sortable ? (
                      <SortHeader
                        label={column.label}
                        field={column.key as SortField}
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FolderKanban size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {hasActiveFilters ? '一致するキャンペーンがありません' : 'キャンペーンがまだありません'}
                      </p>
                      {!hasActiveFilters && (
                        <p className="text-sm text-muted-foreground/70">
                          「新規キャンペーン作成」ボタンから最初のキャンペーンを作成しましょう
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className={cn(
                    'border-b border-border transition-colors hover:bg-muted/30',
                    selectedIds.has(campaign.id) && 'bg-primary/5',
                  )}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(campaign.id)}
                        onChange={() => toggleSelect(campaign.id)}
                        className="h-4 w-4 rounded border-input text-primary accent-primary"
                        aria-label={`${campaign.name}を選択`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailCampaign(campaign)}
                        className="font-medium text-primary hover:underline"
                      >
                        {campaign.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadges platforms={campaign.platforms} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(campaign.budget.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-muted-foreground')}>
                        {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(campaign.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {campaign.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => pauseMutation.mutate({ id: campaign.id })}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-yellow-100 hover:text-yellow-700"
                            title="一時停止"
                            aria-label={`${campaign.name}を一時停止`}
                          >
                            <Pause size={14} />
                          </button>
                        ) : campaign.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={() => resumeMutation.mutate({ id: campaign.id })}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-green-100 hover:text-green-700"
                            title="再開"
                            aria-label={`${campaign.name}を再開`}
                          >
                            <Play size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="編集"
                          aria-label={`${campaign.name}を編集`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700"
                          title="削除"
                          aria-label={`${campaign.name}を削除`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onPause={() => {
            selectedIds.forEach((id) => pauseMutation.mutate({ id }));
            setSelectedIds(new Set());
          }}
          onResume={() => {
            selectedIds.forEach((id) => resumeMutation.mutate({ id }));
            setSelectedIds(new Set());
          }}
          onDelete={() => setSelectedIds(new Set())}
          onDeselect={() => setSelectedIds(new Set())}
        />
      )}

      {/* Create campaign modal */}
      <CreateCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Campaign detail modal */}
      {detailCampaign && (
        <CampaignDetailModal
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}
    </div>
  );
}
