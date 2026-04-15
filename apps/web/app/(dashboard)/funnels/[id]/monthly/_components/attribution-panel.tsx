'use client';

import { memo, useMemo, useState } from 'react';
import { AlertCircle, Inbox, Layers } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  type TabItem,
} from '@omni-ad/ui';
import { trpc } from '@/lib/trpc';

// Attribution model ids mirror the tRPC procedure's z.enum list.
type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'linear'
  | 'time_decay'
  | 'position_based';

const MODEL_TABS: TabItem[] = [
  { key: 'first_touch', label: 'ファーストタッチ' },
  { key: 'last_touch', label: 'ラストタッチ' },
  { key: 'linear', label: '均等配分' },
  { key: 'time_decay', label: 'タイムディケイ' },
  { key: 'position_based', label: 'ポジションベース' },
];

// Palette uses semantic tokens via hsl(var(--…)) so dark mode tracks automatically.
// No new hex values are introduced.
const CHANNEL_SHADES = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--accent-foreground))',
];

function shadeFor(index: number): string {
  return CHANNEL_SHADES[index % CHANNEL_SHADES.length] ?? CHANNEL_SHADES[0]!;
}

export interface AttributionPanelProps {
  funnelId: string;
  month: string;
}

interface StageAttributionPayload {
  stageName: string;
  channels: Array<{ channel: string; credit: number }>;
}

interface ChartDatum {
  stage: string;
  // Dynamic keys per channel (credit values). Legend is built off CHANNELS list.
  [channel: string]: string | number;
}

interface ShapedModel {
  channels: string[];
  data: ChartDatum[];
}

function shapeForChart(stages: StageAttributionPayload[]): ShapedModel {
  const channelSet = new Set<string>();
  for (const s of stages) {
    for (const c of s.channels) channelSet.add(c.channel);
  }
  const channels = Array.from(channelSet).sort();
  const data: ChartDatum[] = stages.map((s) => {
    const row: ChartDatum = { stage: s.stageName };
    for (const ch of channels) {
      const match = s.channels.find((c) => c.channel === ch);
      row[ch] = match ? Number(match.credit.toFixed(2)) : 0;
    }
    return row;
  });
  return { channels, data };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AttributionPanelImpl({
  funnelId,
  month,
}: AttributionPanelProps): React.ReactElement {
  const [model, setModel] = useState<AttributionModel>('last_touch');

  const query = trpc.monthlyFunnel.getAttribution.useQuery(
    { funnelId, month, model },
    { enabled: funnelId.length > 0 && month.length > 0, staleTime: 60_000 },
  );

  const shaped = useMemo<ShapedModel | null>(() => {
    if (!query.data) return null;
    const stages = query.data as StageAttributionPayload[];
    if (stages.length === 0) return null;
    return shapeForChart(stages);
  }, [query.data]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm">アトリビューション</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {`${month} のチャネル別クレジット配分 — モデルごとに再計算します。`}
          </p>
        </div>
        <Tabs
          items={MODEL_TABS}
          value={model}
          onValueChange={(k: string) => setModel(k as AttributionModel)}
          variant="pill"
        />
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : query.isError ? (
          <ErrorState
            icon={<AlertCircle size={18} />}
            title="アトリビューションを取得できませんでした"
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        ) : !shaped || shaped.channels.length === 0 ? (
          <EmptyState
            icon={<Layers size={18} />}
            title="対象月のタッチポイントがありません"
            description={`${month} の conversion_events とタッチポイントが一致しませんでした。`}
          />
        ) : shaped.data.every((d) =>
            shaped.channels.every((ch) => Number(d[ch] ?? 0) === 0),
          ) ? (
          <EmptyState
            icon={<Inbox size={18} />}
            title="全チャネル 0 クレジット"
            description="選択したモデルでは該当月にクレジットが発生していません。"
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={shaped.data}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => value.toFixed(2)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {shaped.channels.map((ch, i) => (
                <Bar key={ch} dataKey={ch} stackId="credit" fill={shadeFor(i)}>
                  {shaped.data.map((_, idx) => (
                    <Cell key={idx} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export const AttributionPanel = memo(AttributionPanelImpl);
AttributionPanel.displayName = 'AttributionPanel';
