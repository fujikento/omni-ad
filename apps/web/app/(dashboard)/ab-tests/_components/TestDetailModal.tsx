import { memo, useMemo } from 'react';
import { Clock, FlaskConical, Trophy, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { METRIC_CONFIG, translateVariantName, type ABTest } from '../_types';
import { StatusBadge } from './Badges';

interface TestDetailModalProps {
  test: ABTest;
  onClose: () => void;
  onDeclareWinner: (testId: string) => void;
}

function TestDetailModalInner({ test, onClose, onDeclareWinner }: TestDetailModalProps): React.ReactElement {
  const { t } = useI18n();
  const metricConfig = METRIC_CONFIG[test.metric];

  const chartData = useMemo(
    () =>
      test.variants.map((v) => ({
        name: v.name,
        value: test.metric === 'roas' || test.metric === 'cpa' ? v.rate : v.rate * 100,
      })),
    [test.variants, test.metric],
  );

  const tickFormatter = (v: number): string => {
    if (test.metric === 'roas') return `${v.toFixed(1)}x`;
    if (test.metric === 'cpa') return `${v.toLocaleString()}`;
    return `${v.toFixed(1)}%`;
  };

  const tooltipFormatter = (value: number): string => {
    if (test.metric === 'roas') return `${value.toFixed(2)}x`;
    if (test.metric === 'cpa') return `${value.toLocaleString()}`;
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <FlaskConical size={18} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-foreground">{test.name}</h2>
            <StatusBadge status={test.status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('abTests.variantMetrics')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-medium text-muted-foreground">{t('abTests.variantColumn')}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t('metrics.impressions')}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t('metrics.clicks')}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t('metrics.conversions')}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{metricConfig.label}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t('abTests.confidenceInterval')}</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">{t('abTests.pValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {test.variants.map((variant) => (
                    <tr key={variant.name} className={cn(
                      'border-b border-border',
                      variant.isWinner && 'bg-green-50/50 dark:bg-green-950/10',
                    )}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          {variant.isWinner && <Trophy size={12} className="text-success" />}
                          <span className="font-medium text-foreground">{translateVariantName(variant.name, t)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-foreground">{variant.impressions.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-foreground">{variant.clicks.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-foreground">{variant.conversions.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{metricConfig.format(variant.rate)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {variant.ci
                          ? `[${metricConfig.format(variant.ci.lower)}, ${metricConfig.format(variant.ci.upper)}]`
                          : '-'}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {variant.pValue !== null ? variant.pValue.toFixed(4) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('abTests.variantComparison')}</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={tickFormatter}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            {test.status === 'running' && test.significance >= 95 && (
              <button
                type="button"
                onClick={() => onDeclareWinner(test.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90"
              >
                <Trophy size={14} />
                {t('abTests.declareWinner')}
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Clock size={14} />
              {t('abTests.extendTest')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TestDetailModal = memo(TestDetailModalInner);
