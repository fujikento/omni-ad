'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Inbox, X } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  type TabItem,
} from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

export interface DrilldownTarget {
  month: string;
  stageIndex: number;
  stageLabel: string;
}

export interface DrilldownDrawerProps {
  funnelId: string;
  open: boolean;
  target: DrilldownTarget | null;
  onClose: () => void;
}

type DrilldownTab = 'campaigns' | 'creatives' | 'channels';

interface DrilldownItem {
  id: string;
  label: string;
  count: number;
}

interface DrilldownResponse {
  campaigns: DrilldownItem[];
  creatives: DrilldownItem[];
  channels: DrilldownItem[];
}

const TABS: TabItem[] = [
  { key: 'campaigns', label: 'キャンペーン' },
  { key: 'creatives', label: 'クリエイティブ' },
  { key: 'channels', label: 'チャネル' },
];

const JP = new Intl.NumberFormat('ja-JP');

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

interface DrilldownListProps {
  items: DrilldownItem[];
  emptyTitle: string;
}

function DrilldownListImpl({ items, emptyTitle }: DrilldownListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={18} />}
        title={emptyTitle}
        description="対象の条件に一致するレコードが見つかりませんでした。"
      />
    );
  }
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
            名前
          </th>
          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
            件数
          </th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 10).map((item) => (
          <tr key={item.id || item.label} className="border-b border-border">
            <td className="px-3 py-2 text-foreground">{item.label || '(名称未設定)'}</td>
            <td className="px-3 py-2 text-right tabular-nums text-foreground">
              {JP.format(item.count)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const DrilldownList = memo(DrilldownListImpl);
DrilldownList.displayName = 'DrilldownList';

// ---------------------------------------------------------------------------
// Drawer shell + query
// ---------------------------------------------------------------------------

function DrilldownDrawerImpl({
  funnelId,
  open,
  target,
  onClose,
}: DrilldownDrawerProps): React.ReactElement | null {
  const [tab, setTab] = useState<DrilldownTab>('campaigns');

  const enabled = open && target !== null && funnelId.length > 0;
  const query = trpc.monthlyFunnel.getDrilldown.useQuery(
    target
      ? { funnelId, month: target.month, stageIndex: target.stageIndex }
      : { funnelId: '', month: '1970-01', stageIndex: 0 },
    { enabled, staleTime: 60_000 },
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const items = useMemo<DrilldownItem[]>(() => {
    if (!query.data) return [];
    const d = query.data as DrilldownResponse;
    if (tab === 'campaigns') return d.campaigns;
    if (tab === 'creatives') return d.creatives;
    return d.channels;
  }, [query.data, tab]);

  if (!open || !target) return null;

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="ドリルダウン"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
      />
      <aside
        className={cn(
          'absolute right-0 top-0 z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lg',
          'transition-transform duration-200',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">ドリルダウン</p>
            <h2 className="text-sm font-semibold text-foreground">
              {`${target.month} · ${target.stageLabel}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="ドリルダウンを閉じる"
          >
            <X size={16} />
          </button>
        </header>
        <div className="border-b border-border px-4 py-2">
          <Tabs
            items={TABS}
            value={tab}
            onValueChange={(k: string) => setTab(k as DrilldownTab)}
            variant="pill"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState
              icon={<AlertCircle size={18} />}
              title="ドリルダウンを取得できませんでした"
              description={query.error.message}
              onRetry={() => void query.refetch()}
            />
          ) : (
            <DrilldownList
              items={items}
              emptyTitle={
                tab === 'campaigns'
                  ? '該当キャンペーンなし'
                  : tab === 'creatives'
                    ? '該当クリエイティブなし'
                    : '該当チャネルなし'
              }
            />
          )}
        </div>
      </aside>
    </div>
  );
}

export const DrilldownDrawer = memo(DrilldownDrawerImpl);
DrilldownDrawer.displayName = 'DrilldownDrawer';
