'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, ChevronRight, Inbox } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@omni-ad/ui';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/lib/i18n';

interface FunnelSummary {
  id: string;
  name: string;
  description?: string | null;
  stages?: unknown[];
}

export default function ReportsMonthlyFunnelPage(): React.ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const funnelsQuery = trpc.funnels.list.useQuery(undefined, { retry: false });

  const raw = funnelsQuery.data as FunnelSummary | FunnelSummary[] | undefined;
  const funnels: FunnelSummary[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const isLoading = funnelsQuery.isLoading;

  if (funnels.length === 1 && !isLoading) {
    router.replace(`/funnels/${funnels[0]!.id}/monthly`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis & Optimization"
        title={t('funnels.monthlyReport')}
        description={t('funnels.selectFunnel')}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : funnels.length === 0 ? (
        <EmptyState
          icon={<Inbox size={18} />}
          title={t('funnels.noFunnelsToReport')}
          action={
            <Link
              href="/funnels"
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              {t('funnels.title')}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {funnels.map((f) => (
            <Link
              key={f.id}
              href={`/funnels/${f.id}/monthly`}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <BarChart3 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{f.name}</p>
                {f.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>
                ) : null}
              </div>
              <ChevronRight
                size={16}
                className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('funnels.monthlyReport')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          月次多段 CV レポートは、ファネルごとに CV① → CV② → CV③ の遷移率・CPA・乖離率・コホート追跡・アトリビューション・3 か月予測を集計します。
        </CardContent>
      </Card>
    </div>
  );
}
