'use client';

import { memo, useMemo } from 'react';
import { PageHeader, SegmentedControl } from '@omni-ad/ui';
import { ExportButton } from '@/app/components/export-button';
import type { MonthRange, MonthlyRow, PivotMeta } from '../_types';

export interface MonthlyFunnelHeaderProps {
  funnelName?: string;
  range: MonthRange;
  onRangeChange: (value: MonthRange) => void;
  months: MonthlyRow[];
  meta?: PivotMeta;
}

const JP = new Intl.NumberFormat('ja-JP');
const RANGE_OPTIONS = [
  { value: '6' as const, label: '6ヶ月' },
  { value: '12' as const, label: '12ヶ月' },
  { value: '24' as const, label: '24ヶ月' },
];

interface ExportRow {
  month: string;
  imp: number;
  clicks: number;
  cpc: number;
  ctr: number;
  cv1: number;
  cvr1: number;
  cpa1: number;
  cv2: number;
  cvr2: number;
  cpa2: number;
  cv3: number;
  cvr3: number;
  cpa3: number;
  spend: number;
  divergence: number;
}

function buildExportRows(months: MonthlyRow[]): ExportRow[] {
  return months.map((r) => ({
    month: r.month,
    imp: r.impressions,
    clicks: r.clicks,
    cpc: Math.round(r.cpc),
    ctr: Number((r.ctr * 100).toFixed(2)),
    cv1: r.cv1,
    cvr1: Number((r.cvr1 * 100).toFixed(2)),
    cpa1: Math.round(r.cpa1),
    cv2: r.cv2,
    cvr2: Number((r.cvr2 * 100).toFixed(2)),
    cpa2: Math.round(r.cpa2),
    cv3: r.cv3,
    cvr3: Number((r.cvr3 * 100).toFixed(2)),
    cpa3: Math.round(r.cpa3),
    spend: Math.round(r.spend),
    divergence: Number((r.divergence * 100).toFixed(2)),
  }));
}

function MonthlyFunnelHeaderImpl({
  funnelName,
  range,
  onRangeChange,
  months,
  meta,
}: MonthlyFunnelHeaderProps): React.ReactElement {
  const exportData = useMemo(() => buildExportRows(months), [months]);
  const stage1 = meta?.stages[0]?.name ?? 'CV①';
  const stage2 = meta?.stages[1]?.name ?? 'CV②';
  const stage3 = meta?.stages[2]?.name ?? 'CV③';

  const fmt = (value: string | number): string =>
    typeof value === 'number' ? JP.format(value) : String(value);

  const columns = useMemo(
    () => [
      { key: 'month' as const, label: '月' },
      { key: 'imp' as const, label: 'imp', format: fmt },
      { key: 'clicks' as const, label: 'Click', format: fmt },
      { key: 'cpc' as const, label: 'CPC', format: fmt },
      { key: 'ctr' as const, label: 'CTR (%)' },
      { key: 'cv1' as const, label: `CV① ${stage1}` },
      { key: 'cvr1' as const, label: 'CV①CVR (%)' },
      { key: 'cpa1' as const, label: 'CV①CPA' },
      { key: 'cv2' as const, label: `CV② ${stage2}` },
      { key: 'cvr2' as const, label: 'CV②CVR (%)' },
      { key: 'cpa2' as const, label: 'CV②CPA' },
      { key: 'cv3' as const, label: `CV③ ${stage3}` },
      { key: 'cvr3' as const, label: 'CV③CVR (%)' },
      { key: 'cpa3' as const, label: 'CV③CPA' },
      { key: 'spend' as const, label: '消化金額' },
      { key: 'divergence' as const, label: '乖離率 (%)' },
    ],
    [stage1, stage2, stage3],
  );

  return (
    <PageHeader
      eyebrow="Funnel Analytics"
      title={funnelName ? `${funnelName} — 月次ピボット` : '月次ピボット'}
      description="月次ごとに imp → Click → CV①/②/③ の推移と乖離率を俯瞰します。"
      actions={
        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="表示期間"
            value={String(range)}
            onValueChange={(v: string) => onRangeChange(Number(v) as MonthRange)}
            options={RANGE_OPTIONS}
            size="sm"
          />
          <ExportButton data={exportData} columns={columns} filename="monthly-funnel" />
        </div>
      }
    />
  );
}

export const MonthlyFunnelHeader = memo(MonthlyFunnelHeaderImpl);
MonthlyFunnelHeader.displayName = 'MonthlyFunnelHeader';
