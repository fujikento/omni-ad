'use client';

import { memo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@omni-ad/ui';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { showToast } from '@/lib/show-toast';

type Confidence = 'low' | 'medium' | 'high';

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  high: 'bg-success/15 text-success dark:bg-success/20 dark:text-success-foreground',
  medium: 'bg-info/15 text-info dark:bg-info/20 dark:text-info-foreground',
  low: 'bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning-foreground',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: '信頼度: 高',
  medium: '信頼度: 中',
  low: '信頼度: 低',
};

function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

export const TodaysMoveCard = memo(function TodaysMoveCard(): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(false);

  const previewQuery = trpc.unifiedSpendOrchestrator.preview.useQuery(
    { lookbackHours: 24 },
    {
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const utils = trpc.useUtils();
  const applyMutation = trpc.unifiedSpendOrchestrator.applyPlan.useMutation({
    onSuccess: () => {
      showToast('予算再配分プランを適用しました');
      void utils.unifiedSpendOrchestrator.preview.invalidate();
    },
    onError: (err) => {
      showToast(`適用失敗: ${err.message}`);
    },
  });

  if (dismissed) return null;
  if (previewQuery.isLoading || previewQuery.isError) return null;

  const plan = previewQuery.data;
  if (!plan || plan.shifts.length === 0) return null;
  if (plan.confidence === 'low') return null;

  // Sort by amount, take the highest-impact single shift as the hero move.
  const topShift = [...plan.shifts].sort((a, b) => b.amount - a.amount)[0];
  if (!topShift) return null;

  const confidence = plan.confidence as Confidence;

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-card to-primary/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-primary">
              本日の最優先アクション
            </div>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">
              予算をシフトしてください
            </h2>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            CONFIDENCE_BADGE[confidence],
          )}
        >
          {CONFIDENCE_LABEL[confidence]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm font-medium text-foreground">
            {topShift.from}
          </span>
          <ArrowRight size={16} className="text-muted-foreground" />
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm font-medium text-foreground">
            {topShift.to}
          </span>
        </div>
        <div className="font-mono text-2xl font-bold text-foreground">
          {formatYen(topShift.amount)}
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-muted-foreground">予測 ROAS 改善</div>
          <div
            className={cn(
              'font-mono text-lg font-semibold',
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

      <p className="mt-3 text-sm text-muted-foreground">{topShift.reason}</p>

      {plan.shifts.length > 1 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          他に{plan.shifts.length - 1}件のシフト提案があります。
          <a href="/budgets" className="ml-1 text-primary hover:underline">
            すべて確認する →
          </a>
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          onClick={() => applyMutation.mutate({ plan })}
          disabled={applyMutation.isPending}
        >
          {applyMutation.isPending ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <CheckCircle2 size={14} className="mr-2" />
          )}
          適用する
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          後で
        </button>
      </div>
    </div>
  );
});
