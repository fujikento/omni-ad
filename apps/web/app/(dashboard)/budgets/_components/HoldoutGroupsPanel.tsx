'use client';

import { memo, useState } from 'react';
import { FlaskConical, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { CreateHoldoutModal } from './CreateHoldoutModal';

type HoldoutGroup = {
  id: string;
  name: string;
  description: string | null;
  testCampaignIds: string[];
  controlCampaignIds: string[];
  active: boolean;
  createdAt: string | Date;
};

type Lift = {
  groupId: string;
  windowHours: number;
  testCampaignCount: number;
  controlCampaignCount: number;
  test: { spend: number; revenue: number; roas: number };
  control: { spend: number; revenue: number; roas: number };
  liftPercent: number;
  incrementalRevenue: number;
  confidence: 'low' | 'medium' | 'high';
};

function LiftRow({ groupId }: { groupId: string }): React.ReactElement {
  const query = trpc.holdout.lift.useQuery(
    { groupId, windowHours: 24 },
    { retry: false, refetchOnWindowFocus: false },
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={10} className="animate-spin" />
        計算中...
      </div>
    );
  }

  const data = query.data as Lift | null | undefined;
  if (!data) return <span className="text-xs text-muted-foreground">データ不足</span>;

  const positive = data.liftPercent >= 0;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="rounded-md bg-muted px-2 py-0.5 font-mono">
        test: {data.test.roas.toFixed(2)}x
      </span>
      <span className="rounded-md bg-muted px-2 py-0.5 font-mono">
        control: {data.control.roas.toFixed(2)}x
      </span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 font-mono font-semibold',
          positive
            ? 'bg-success/15 text-success'
            : 'bg-destructive/15 text-destructive',
        )}
      >
        lift {positive ? '+' : ''}
        {data.liftPercent.toFixed(1)}%
      </span>
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
          data.confidence === 'high'
            ? 'bg-success/10 text-success'
            : data.confidence === 'medium'
              ? 'bg-info/10 text-info'
              : 'bg-warning/10 text-warning',
        )}
      >
        {data.confidence}
      </span>
    </div>
  );
}

export const HoldoutGroupsPanel = memo(function HoldoutGroupsPanel(): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const query = trpc.holdout.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const groups = (query.data as HoldoutGroup[] | undefined) ?? [];

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Holdout 実験と因果 Lift
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus size={12} />
            新規作成
          </button>
          {groups.length > 3 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {expanded ? '閉じる' : '詳細'}
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        treatment と control の campaign 群を分離して真の causal lift を測定。
      </p>

      {query.isLoading ? (
        <div className="mt-4 flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            実験がまだ設定されていません
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            API 経由で holdout group を作成すると、ここに表示されます
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {groups.slice(0, expanded ? undefined : 3).map((group) => (
            <li
              key={group.id}
              className="rounded-md border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{group.name}</span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                      group.active
                        ? 'bg-success/15 text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {group.active ? 'active' : 'paused'}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  test {group.testCampaignIds.length} / control {group.controlCampaignIds.length}
                </span>
              </div>
              {group.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              ) : null}
              <div className="mt-2">
                <LiftRow groupId={group.id} />
              </div>
            </li>
          ))}
          {!expanded && groups.length > 3 ? (
            <li className="text-center">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                残り {groups.length - 3} 件を表示
              </button>
            </li>
          ) : null}
        </ul>
      )}

      <CreateHoldoutModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
});
