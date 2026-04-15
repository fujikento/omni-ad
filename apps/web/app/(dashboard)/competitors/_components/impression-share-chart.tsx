'use client';

import { memo } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '@/lib/i18n';
import type { ImpressionShareDataPoint } from '../_types';

interface ImpressionShareChartProps {
  data: ImpressionShareDataPoint[];
}

function ImpressionShareChartInner({
  data,
}: ImpressionShareChartProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t('competitors.impressionShareTrend')}
      </h2>
      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <BarChart3 size={28} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
              }}
            />
            <YAxis
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
              }}
              domain={[0, 60]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ours"
              name={t('competitors.ownCompany')}
              stroke="hsl(var(--chart-1))"
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="competitorA"
              name="CompetitorA"
              stroke="hsl(var(--chart-2))"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
            <Line
              type="monotone"
              dataKey="competitorB"
              name="CompetitorB"
              stroke="hsl(var(--chart-3))"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
            <Line
              type="monotone"
              dataKey="competitorC"
              name="CompetitorC"
              stroke="hsl(var(--chart-4))"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export const ImpressionShareChart = memo(ImpressionShareChartInner);
