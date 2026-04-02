'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { showToast } from '@/lib/show-toast';

// -- Types --

type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  platform: Platform;
  fatigueScore: number;
  lastUpdated: string;
  description: string;
}

interface OverlapCircle {
  id: string;
  name: string;
  size: number;
  color: string;
}

// -- Constants --

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  google: 'Google',
  x: 'X',
  tiktok: 'TikTok',
  line_yahoo: 'LINE/Yahoo',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: 'bg-indigo-500',
  google: 'bg-blue-500',
  x: 'bg-gray-700',
  tiktok: 'bg-pink-500',
  line_yahoo: 'bg-green-500',
  amazon: 'bg-orange-500',
  microsoft: 'bg-teal-500',
};

const MOCK_SEGMENTS: AudienceSegment[] = [
  { id: '1', name: '高価値リピーター', size: 15200, platform: 'google', fatigueScore: 12, lastUpdated: '2026-04-01T10:00:00Z', description: '過去3ヶ月で3回以上購入した顧客' },
  { id: '2', name: 'カート離脱者', size: 28400, platform: 'meta', fatigueScore: 45, lastUpdated: '2026-04-01T12:00:00Z', description: 'カートに商品を入れたが購入しなかったユーザー' },
  { id: '3', name: '新規訪問者', size: 125000, platform: 'google', fatigueScore: 8, lastUpdated: '2026-04-02T06:00:00Z', description: '過去7日間の新規サイト訪問者' },
  { id: '4', name: 'LINE友達', size: 45000, platform: 'line_yahoo', fatigueScore: 22, lastUpdated: '2026-03-30T18:00:00Z', description: 'LINE公式アカウントの友達' },
  { id: '5', name: 'TikTokエンゲージ', size: 89000, platform: 'tiktok', fatigueScore: 15, lastUpdated: '2026-04-01T08:00:00Z', description: 'TikTok広告にエンゲージしたユーザー' },
  { id: '6', name: 'メルマガ購読者', size: 32000, platform: 'line_yahoo', fatigueScore: 58, lastUpdated: '2026-03-28T14:00:00Z', description: 'メールマガジン購読中のユーザー' },
  { id: '7', name: 'X フォロワー', size: 18500, platform: 'x', fatigueScore: 30, lastUpdated: '2026-04-01T16:00:00Z', description: 'X公式アカウントのフォロワー' },
  { id: '8', name: 'アプリユーザー', size: 67000, platform: 'meta', fatigueScore: 20, lastUpdated: '2026-04-02T04:00:00Z', description: 'モバイルアプリのアクティブユーザー' },
];

const MOCK_OVERLAP_CIRCLES: OverlapCircle[] = [
  { id: '1', name: '高価値リピーター', size: 15200, color: '#4285F4' },
  { id: '2', name: 'カート離脱者', size: 28400, color: '#6366F1' },
  { id: '4', name: 'LINE友達', size: 45000, color: '#06C755' },
];

// -- Subcomponents --

function FatigueIndicator({ score }: { score: number }): React.ReactElement {
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  const config = {
    high: { label: '高', className: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
    medium: { label: '中', className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    low: { label: '低', className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  };
  const c = config[level];

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full', level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-green-500')}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', c.className)}>
        {score > 40 && <AlertTriangle size={10} className="mr-0.5" />}
        {score}%
      </span>
    </div>
  );
}

function OverlapVisualization({ circles }: { circles: OverlapCircle[] }): React.ReactElement {
  const maxSize = Math.max(...circles.map((c) => c.size));

  return (
    <div className="relative flex h-64 items-center justify-center">
      {circles.map((circle, i) => {
        const normalizedSize = (circle.size / maxSize) * 120 + 60;
        const offsetX = (i - 1) * 50;
        const offsetY = i % 2 === 0 ? -15 : 15;
        return (
          <div
            key={circle.id}
            className="absolute flex items-center justify-center rounded-full border-2 border-white/50"
            style={{
              width: normalizedSize,
              height: normalizedSize,
              backgroundColor: `${circle.color}30`,
              borderColor: circle.color,
              transform: `translate(${offsetX}px, ${offsetY}px)`,
            }}
            title={`${circle.name}: ${circle.size.toLocaleString()}`}
          >
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">{circle.name.split(' ')[0]}</p>
              <p className="text-[10px] text-muted-foreground">{(circle.size / 1000).toFixed(1)}K</p>
            </div>
          </div>
        );
      })}
      {/* Overlap center indicator */}
      <div className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
        2.1K
      </div>
    </div>
  );
}

interface CreateSegmentModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateSegmentModal({ open, onClose }: CreateSegmentModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Platform>('google');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  function handleCreate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name) return;
    setIsCreating(true);
    setTimeout(() => {
      setIsCreating(false);
      onClose();
    }, 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">新規セグメント作成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="segment-name" className="mb-1 block text-sm font-medium text-foreground">セグメント名</label>
            <input
              id="segment-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="高エンゲージメントユーザー"
              required
            />
          </div>

          <div>
            <label htmlFor="segment-platform" className="mb-1 block text-sm font-medium text-foreground">プラットフォーム</label>
            <div className="relative">
              <select
                id="segment-platform"
                value={platform}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlatform(e.target.value as Platform)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label htmlFor="segment-description" className="mb-1 block text-sm font-medium text-foreground">説明</label>
            <textarea
              id="segment-description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="セグメントの条件を説明..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isCreating || !name}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page --

export default function AudiencesPage(): React.ReactElement {
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetPlatforms, setSelectedTargetPlatforms] = useState<Set<Platform>>(new Set());

  function toggleTargetPlatform(platform: Platform): void {
    setSelectedTargetPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  const audiencesQuery = trpc.audiences.list.useQuery(undefined, { retry: false });

  const segments = audiencesQuery.error ? MOCK_SEGMENTS : (audiencesQuery.data as AudienceSegment[] | undefined) ?? MOCK_SEGMENTS;
  const isLoading = audiencesQuery.isLoading && !audiencesQuery.error;

  const filteredSegments = searchQuery
    ? segments.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            オーディエンスグラフ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            クロスチャネルのオーディエンスデータを統合・可視化
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            data={segments}
            columns={[
              { key: 'name' as const, label: 'セグメント名' },
              { key: 'platform' as const, label: 'プラットフォーム', format: (v: AudienceSegment[keyof AudienceSegment]) => PLATFORM_LABELS[v as Platform] ?? String(v) },
              { key: 'size' as const, label: 'サイズ', format: (v: AudienceSegment[keyof AudienceSegment]) => String(v) },
              { key: 'fatigueScore' as const, label: '疲労度', format: (v: AudienceSegment[keyof AudienceSegment]) => `${v}%` },
              { key: 'description' as const, label: '説明' },
            ]}
            filename="audiences"
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Plus size={16} />
            新規セグメント作成
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="セグメントを検索..."
        />
      </div>

      {/* Overlap visualization + Lookalike panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overlap visualization */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">セグメント重複分析</h2>
          <p className="mt-1 text-sm text-muted-foreground">選択されたセグメント間のオーバーラップ</p>
          <OverlapVisualization circles={MOCK_OVERLAP_CIRCLES} />
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {MOCK_OVERLAP_CIRCLES.map((circle) => (
              <div key={circle.id} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: circle.color }} />
                <span className="text-xs text-muted-foreground">{circle.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-platform lookalike */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">クロスプラットフォーム類似オーディエンス</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            既存セグメントを基に他プラットフォームで類似オーディエンスを生成
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="source-segment" className="mb-1 block text-xs font-medium text-foreground">ソースセグメント</label>
              <div className="relative">
                <select
                  id="source-segment"
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {segments.slice(0, 5).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({(s.size / 1000).toFixed(1)}K)</option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <span className="mb-2 block text-xs font-medium text-foreground">ターゲットプラットフォーム</span>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTargetPlatform(key)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedTargetPlatforms.has(key)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedTargetPlatforms.size === 0) {
                  showToast('ターゲットプラットフォームを選択してください');
                  return;
                }
                showToast('類似オーディエンス生成を開始しました');
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Copy size={14} />
              類似オーディエンスを生成
            </button>
          </div>
        </div>
      </div>

      {/* Segment list */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">セグメント名</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">プラットフォーム</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">サイズ</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">疲労度</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">最終更新</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">説明</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="animate-pulse border-b border-border">
                    {Array.from({ length: 6 }, (__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredSegments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {searchQuery ? '一致するセグメントがありません' : 'セグメントがまだありません'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSegments.map((segment) => (
                  <tr key={segment.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{segment.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white', PLATFORM_COLORS[segment.platform])}>
                        {PLATFORM_LABELS[segment.platform]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {segment.size.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <FatigueIndicator score={segment.fatigueScore} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(segment.lastUpdated)}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      <span className="line-clamp-1">{segment.description}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create segment modal */}
      <CreateSegmentModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
