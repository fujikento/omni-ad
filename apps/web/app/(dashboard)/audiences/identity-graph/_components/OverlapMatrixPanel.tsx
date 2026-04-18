'use client';

import { memo } from 'react';
import { Loader2, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

const DEFAULT_PLATFORMS = [
  'meta',
  'google',
  'tiktok',
  'line_yahoo',
  'x',
  'amazon',
  'microsoft',
] as const;

function cellClass(overlap: number | undefined): string {
  if (overlap === undefined) return 'text-muted-foreground/40';
  if (overlap >= 70) return 'bg-destructive/15 text-destructive font-semibold';
  if (overlap >= 40) return 'bg-warning/15 text-warning font-medium';
  if (overlap >= 10) return 'bg-info/10 text-info';
  return 'bg-success/10 text-success';
}

export const OverlapMatrixPanel = memo(function OverlapMatrixPanel(): React.ReactElement {
  const query = trpc.identityGraph.getOverlapMatrix.useQuery(
    { platforms: [...DEFAULT_PLATFORMS] },
    { retry: false, refetchOnWindowFocus: false },
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Network size={18} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          プラットフォーム間オーディエンス重複
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        行のプラットフォームのユーザーが、列のプラットフォームにどの程度存在するかを示します。重複が高いと同じユーザーに複数媒体で課金している可能性があります。
      </p>

      {query.isLoading ? (
        <div className="mt-6 flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 py-8">
          <Loader2 size={14} className="mr-2 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">重複を計算中...</span>
        </div>
      ) : query.data === undefined || query.data.platforms.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            identity-graph にデータがないため重複を計算できません
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-muted-foreground">
                  from \ to
                </th>
                {query.data.platforms.map((p) => (
                  <th
                    key={p}
                    className="px-3 py-2 text-center font-mono text-muted-foreground"
                  >
                    {p}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-muted-foreground">total</th>
              </tr>
            </thead>
            <tbody>
              {query.data.platforms.map((from) => (
                <tr key={from}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-mono font-medium text-foreground">
                    {from}
                  </td>
                  {query.data.platforms.map((to) => {
                    if (from === to) {
                      return (
                        <td
                          key={to}
                          className="px-3 py-2 text-center text-muted-foreground/30"
                        >
                          —
                        </td>
                      );
                    }
                    const overlap = query.data.matrix[from]?.[to];
                    return (
                      <td
                        key={to}
                        className={cn(
                          'px-3 py-2 text-center font-mono',
                          cellClass(overlap),
                        )}
                      >
                        {overlap !== undefined ? `${overlap.toFixed(0)}%` : '–'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {query.data.perPlatformTotals[from] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-success/40" />
              &lt; 10% 低い
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-info/40" />
              10–40% 中程度
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-warning/40" />
              40–70% 高い
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-destructive/40" />
              70%+ 過剰（重複課金リスク）
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
