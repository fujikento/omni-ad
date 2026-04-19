'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileUp,
  Fingerprint,
  Globe,
  Link2,
  Inbox,
  Plus,
  Shield,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader, StatCard } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';
import { OverlapMatrixPanel } from './_components/OverlapMatrixPanel';
import { SaturationPanel } from './_components/SaturationPanel';

// ============================================================
// Types
// ============================================================

interface PlatformIdentity {
  platform: string;
  matched: number;
  unmatched: number;
  color: string;
}

interface JourneyTouchpoint {
  id: string;
  platform: string;
  action: string;
  timestamp: string;
  icon: React.ReactNode;
}

interface SegmentCriteria {
  platform: string;
  action: string;
}

interface UnifiedSegment {
  id: string;
  name: string;
  criteria: SegmentCriteria[];
  size: number;
}

// ============================================================
// Constants
// ============================================================

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  Meta: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Google: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  TikTok: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  LINE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  X: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ============================================================
// Subcomponents
// ============================================================

function KpiCard({
  labelKey,
  value,
  subValue,
  icon,
  color,
}: {
  labelKey: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <StatCard
      label={t(labelKey)}
      value={value}
      icon={<span className={color}>{icon}</span>}
    >
      {subValue ? (
        <p className="text-xs tabular-nums text-muted-foreground">{subValue}</p>
      ) : null}
    </StatCard>
  );
}

function PlatformCoverageMap({ platforms }: { platforms: PlatformIdentity[] }): React.ReactElement {
  const { t } = useI18n();

  const chartData = platforms.map((p) => ({
    platform: p.platform,
    matched: p.matched,
    unmatched: p.unmatched,
  }));

  if (platforms.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t('identityGraph.platformCoverage')}
        </h2>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">
        {t('identityGraph.platformCoverage')}
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="platform" tick={{ fontSize: 11 }} width={60} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value.toLocaleString(),
                name === 'matched' ? t('identityGraph.matched') : t('identityGraph.unmatched'),
              ]}
            />
            <Bar dataKey="matched" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} name="matched" />
            <Bar dataKey="unmatched" stackId="a" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} name="unmatched" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
          <span className="text-xs text-muted-foreground">{t('identityGraph.matched')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
          <span className="text-xs text-muted-foreground">{t('identityGraph.unmatched')}</span>
        </div>
      </div>
    </div>
  );
}

function CrossPlatformJourney({ touchpoints }: { touchpoints: JourneyTouchpoint[] }): React.ReactElement {
  const { t } = useI18n();

  if (touchpoints.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          {t('identityGraph.journeyTitle')}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {t('identityGraph.journeyDesc')}
        </p>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Inbox size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-base font-semibold text-foreground">
        {t('identityGraph.journeyTitle')}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('identityGraph.journeyDesc')}
      </p>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {touchpoints.map((tp, i) => (
          <div key={tp.id} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 min-w-[140px]">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  PLATFORM_BADGE_COLORS[tp.platform] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {tp.icon}
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  PLATFORM_BADGE_COLORS[tp.platform] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {tp.platform}
              </span>
              <span className="text-xs font-medium text-foreground text-center">
                {t(tp.action)}
              </span>
              <span className="text-[10px] text-muted-foreground">{tp.timestamp}</span>
            </div>
            {i < touchpoints.length - 1 && (
              <ArrowRight size={16} className="flex-shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportPanel(): React.ReactElement {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(): void {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    setUploaded(true);
  }

  function handleFileSelect(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files.length > 0) {
      setUploaded(true);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-base font-semibold text-foreground">
        {t('identityGraph.importTitle')}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('identityGraph.importDesc')}
      </p>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          uploaded ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' : '',
        )}
      >
        {uploaded ? (
          <>
            <Check size={24} className="text-green-500" />
            <p className="mt-2 text-sm font-medium text-success">
              {t('identityGraph.importComplete')}
            </p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-muted-foreground" />
            <p className="mt-2 text-sm text-foreground">{t('identityGraph.importButton')}</p>
            <p className="mt-1 text-xs text-muted-foreground">CSV (email/phone)</p>
            <button
              type="button"
              onClick={handleFileSelect}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              <FileUp size={14} />
              {t('identityGraph.selectFile')}
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
          aria-label={t('identityGraph.selectFile')}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 rounded-md bg-muted/50 px-3 py-2">
        <Shield size={14} className="flex-shrink-0 text-green-500" />
        <p className="text-xs text-muted-foreground">
          {t('identityGraph.hashNotice')}
        </p>
      </div>
    </div>
  );
}

function SegmentBuilder({ segments }: { segments: UnifiedSegment[] }): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('identityGraph.segmentBuilder')}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('identityGraph.segmentBuilderDesc')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          <Plus size={14} />
          {t('identityGraph.createSegment')}
        </button>
      </div>

      {segments.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('identityGraph.noSegments')}
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="rounded-lg border border-border p-3 transition-all hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{segment.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {segment.criteria.map((criterion, i) => (
                      <div key={`${segment.id}-${criterion.platform}-${criterion.action}`} className="flex items-center gap-1">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            PLATFORM_BADGE_COLORS[criterion.platform] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {criterion.platform}: {criterion.action}
                        </span>
                        {i < segment.criteria.length - 1 && (
                          <span className="text-[10px] text-muted-foreground">+</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="flex-shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  {segment.size.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function IdentityGraphPage(): React.ReactElement {
  const { t } = useI18n();

  const segmentsQuery = trpc.identityGraph.listSegments.useQuery(undefined, {
    retry: false,
  });

  // tRPC listSegments returns { segments, total } — extract the array.
  const segments: UnifiedSegment[] = (() => {
    const raw = segmentsQuery.data as
      | { segments?: UnifiedSegment[] }
      | UnifiedSegment[]
      | undefined;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.segments ?? [];
  })();

  // Datasets below require backend endpoints that are not wired yet.
  // Start empty so each section renders its own empty state.
  const platforms: PlatformIdentity[] = [];
  const touchpoints: JourneyTouchpoint[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/audiences"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} />
            {t('nav.audiences')}
          </Link>
        }
        title={t('identityGraph.title')}
        description={t('identityGraph.description')}
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          labelKey="identityGraph.kpiUnifiedProfiles"
          value="0"
          icon={<Fingerprint size={16} />}
          color="text-primary"
        />
        <KpiCard
          labelKey="identityGraph.kpiMatchRate"
          value="0%"
          icon={<Link2 size={16} />}
          color="text-blue-500"
        />
        <KpiCard
          labelKey="identityGraph.kpiPlatformCoverage"
          value="0 / 7"
          icon={<Globe size={16} />}
          color="text-green-500"
        />
        <KpiCard
          labelKey="identityGraph.kpiDuplicates"
          value="0"
          icon={<Database size={16} />}
          color="text-yellow-500"
        />
      </div>

      {/* Cross-platform saturation — wasted-spend signal */}
      <SaturationPanel />

      {/* Cross-platform audience overlap matrix */}
      <OverlapMatrixPanel />

      {/* Platform coverage */}
      <PlatformCoverageMap platforms={platforms} />

      {/* Cross-platform journey */}
      <CrossPlatformJourney touchpoints={touchpoints} />

      {/* Import + Segment builder side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ImportPanel />
        <SegmentBuilder segments={segments} />
      </div>
    </div>
  );
}
