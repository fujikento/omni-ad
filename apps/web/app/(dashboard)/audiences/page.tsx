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
import { Button, PageHeader } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ExportButton } from '@/app/components/export-button';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

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

// -- Subcomponents --

function FatigueIndicator({ score }: { score: number }): React.ReactElement {
  const { t } = useI18n();

  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  const config = {
    high: { label: t('audiences.h4296d7'), className: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
    medium: { label: t('audiences.haed1df'), className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    low: { label: t('audiences.h19ac67'), className: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
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
  const { t } = useI18n();
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
          <h2 className="text-lg font-semibold text-foreground">{t('audiences.createModal.title')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="segment-name" className="mb-1 block text-sm font-medium text-foreground">{t('audiences.createModal.name')}</label>
            <input
              id="segment-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('audiences.he5477d')}
              required
            />
          </div>

          <div>
            <label htmlFor="segment-platform" className="mb-1 block text-sm font-medium text-foreground">{t('audiences.createModal.platform')}</label>
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
            <label htmlFor="segment-description" className="mb-1 block text-sm font-medium text-foreground">{t('audiences.createModal.description')}</label>
            <textarea
              id="segment-description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={t('audiences.createModal.descriptionPlaceholder')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isCreating || !name}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page --

export default function AudiencesPage(): React.ReactElement {
  const { t } = useI18n();
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

  const segments = (audiencesQuery.data as AudienceSegment[] | undefined) ?? [];
  const overlapCircles: OverlapCircle[] = [];
  const isLoading = audiencesQuery.isLoading;

  const filteredSegments = searchQuery
    ? segments.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  function formatDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ad Management"
        title={t('audiences.title')}
        description={t('audiences.description')}
        actions={
          <>
            <ExportButton
              data={segments}
              columns={[
                { key: 'name' as const, label: t('audiences.export.name') },
                { key: 'platform' as const, label: t('audiences.export.platform'), format: (v: AudienceSegment[keyof AudienceSegment]) => PLATFORM_LABELS[v as Platform] ?? String(v) },
                { key: 'size' as const, label: t('audiences.export.size'), format: (v: AudienceSegment[keyof AudienceSegment]) => String(v) },
                { key: 'fatigueScore' as const, label: t('audiences.export.fatigue'), format: (v: AudienceSegment[keyof AudienceSegment]) => `${v}%` },
                { key: 'description' as const, label: t('audiences.export.description') },
              ]}
              filename="audiences"
            />
            <Button
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('audiences.createSegment')}
            </Button>
          </>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('audiences.searchSegments')}
        />
      </div>

      {/* Overlap visualization + Lookalike panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overlap visualization */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t('audiences.overlapAnalysis')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('audiences.overlapDescription')}</p>
          {overlapCircles.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
              <Users size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            </div>
          ) : (
            <>
              <OverlapVisualization circles={overlapCircles} />
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {overlapCircles.map((circle) => (
                  <div key={circle.id} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: circle.color }} />
                    <span className="text-xs text-muted-foreground">{circle.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cross-platform lookalike */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t('audiences.crossPlatformLookalike')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('audiences.lookalikeDescription')}
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="source-segment" className="mb-1 block text-xs font-medium text-foreground">{t('audiences.sourceSegment')}</label>
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
              <span className="mb-2 block text-xs font-medium text-foreground">{t('audiences.targetPlatforms')}</span>
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
                  showToast(t('audiences.selectTargetPlatform'));
                  return;
                }
                showToast(t('audiences.lookalikeStarted'));
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Copy size={14} />
              {t('audiences.generateLookalike')}
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('audiences.segmentName')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('audiences.platformColumn')}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t('audiences.size')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('audiences.fatigueScore')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('audiences.lastUpdated')}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('audiences.descriptionColumn')}</th>
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
                        {searchQuery ? t('audiences.noMatchingSegments') : t('audiences.noSegments')}
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
