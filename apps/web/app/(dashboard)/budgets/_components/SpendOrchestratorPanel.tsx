'use client';

import { memo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';

type Confidence = 'low' | 'medium' | 'high';

type Shift = {
  from: string;
  to: string;
  amount: number;
  reason: string;
  overlapPercent?: number;
};

type PlatformROAS = {
  platform: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  ctr: number;
  dataPoints: number;
};

type CreativePoolWarning = {
  platform: string;
  creativeCount: number;
  recommendedMinimum: number;
  message: string;
};

type Plan = {
  generatedAt: string;
  lookbackHours: number;
  totalBudget: number;
  currentAllocations: Record<string, number>;
  proposedAllocations: Record<string, number>;
  shifts: Shift[];
  platformROAS: PlatformROAS[];
  predictedRoasImprovement: number;
  confidence: Confidence;
  reasoning: string;
  creativePoolWarnings?: CreativePoolWarning[];
};

const CONFIDENCE_STYLES: Record<Confidence, { label: string; badge: string }> = {
  high: {
    label: '信頼度: 高',
    badge:
      'bg-success/15 text-success dark:bg-success/20 dark:text-success-foreground',
  },
  medium: {
    label: '信頼度: 中',
    badge:
      'bg-info/15 text-info dark:bg-info/20 dark:text-info-foreground',
  },
  low: {
    label: '信頼度: 低',
    badge:
      'bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning-foreground',
  },
};

function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatROAS(value: number): string {
  return `${value.toFixed(2)}x`;
}

function PlatformLabel({ platform }: { platform: string }): React.ReactElement {
  return <span className="font-mono text-xs">{platform}</span>;
}

export const SpendOrchestratorPanel = memo(function SpendOrchestratorPanel(): React.ReactElement {
  const [lookbackHours] = useState<number>(24);

  const previewQuery = trpc.unifiedSpendOrchestrator.preview.useQuery(
    { lookbackHours },
    { refetchOnWindowFocus: false },
  );

  const utils = trpc.useUtils();
  const applyMutation = trpc.unifiedSpendOrchestrator.apply.useMutation({
    onSuccess: (data) => {
      showToast(
        `再配分プラン適用: ${data?.shiftsApplied ?? 0}件のシフト記録`,
      );
      void utils.unifiedSpendOrchestrator.preview.invalidate();
    },
    onError: (err) => {
      showToast(`適用失敗: ${err.message}`);
    },
  });

  const plan = previewQuery.data as Plan | undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            クロスプラットフォーム予算最適化
          </h2>
          {plan ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                CONFIDENCE_STYLES[plan.confidence].badge,
              )}
            >
              {CONFIDENCE_STYLES[plan.confidence].label}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => previewQuery.refetch()}
          disabled={previewQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {previewQuery.isFetching ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          再計算
        </button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        過去 {lookbackHours} 時間の ROAS に基づき、低成績プラットフォームから高成績プラットフォームへ予算を自動シフトします。
      </p>

      {previewQuery.isLoading ? (
        <div className="mt-6 flex items-center justify-center rounded-md border border-dashed border-border bg-muted/30 py-8">
          <Loader2 size={16} className="mr-2 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">分析中...</span>
        </div>
      ) : plan === undefined ? (
        <div className="mt-6 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">データを取得できませんでした</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">総予算</div>
              <div className="mt-1 font-mono text-base font-semibold text-foreground">
                {formatYen(plan.totalBudget)}
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">提案シフト数</div>
              <div className="mt-1 font-mono text-base font-semibold text-foreground">
                {plan.shifts.length}件
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">ROAS 改善見込み</div>
              <div
                className={cn(
                  'mt-1 font-mono text-base font-semibold',
                  plan.predictedRoasImprovement >= 0
                    ? 'text-success'
                    : 'text-destructive',
                )}
              >
                {plan.predictedRoasImprovement >= 0 ? '+' : ''}
                {plan.predictedRoasImprovement.toFixed(3)}
              </div>
            </div>
          </div>

          {plan.platformROAS.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">プラットフォーム別 ROAS</h3>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Platform</th>
                      <th className="px-3 py-2 text-right">消化</th>
                      <th className="px-3 py-2 text-right">売上</th>
                      <th className="px-3 py-2 text-right">ROAS</th>
                      <th className="px-3 py-2 text-right">データ点</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {plan.platformROAS.map((p) => (
                      <tr key={p.platform}>
                        <td className="px-3 py-2">
                          <PlatformLabel platform={p.platform} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatYen(p.spend)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatYen(p.revenue)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-mono font-semibold',
                            p.roas >= 2
                              ? 'text-success'
                              : p.roas >= 1
                                ? 'text-foreground'
                                : 'text-destructive',
                          )}
                        >
                          {formatROAS(p.roas)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {p.dataPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {plan.shifts.length > 0 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">提案シフト</h3>
              <ul className="space-y-2">
                {plan.shifts.map((s, i) => (
                  <li
                    key={`${s.from}-${s.to}-${i}`}
                    className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <PlatformLabel platform={s.from} />
                      <ArrowRight size={14} className="text-muted-foreground" />
                      <PlatformLabel platform={s.to} />
                    </div>
                    <div className="flex-1 text-xs text-muted-foreground">
                      {s.reason}
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {formatYen(s.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan.creativePoolWarnings && plan.creativePoolWarnings.length > 0 ? (
            <div className="mt-5 rounded-md border border-warning/40 bg-warning/5 p-4">
              <h3 className="mb-2 text-sm font-semibold text-warning">
                クリエイティブ不足警告
              </h3>
              <ul className="space-y-1.5">
                {plan.creativePoolWarnings.map((w) => (
                  <li
                    key={w.platform}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-xs font-medium text-warning">
                      {w.platform}
                    </span>
                    <span className="flex-1">{w.message}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {w.creativeCount}/{w.recommendedMinimum}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <a href="/creatives/mass-production" className="text-primary hover:underline">
                  一括生成で補充する →
                </a>
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm text-muted-foreground">{plan.reasoning}</p>
            {plan.shifts.length > 0 ? (
              <Button
                type="button"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate({ plan })}
              >
                {applyMutation.isPending ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 size={14} className="mr-2" />
                )}
                プランを適用
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
});
