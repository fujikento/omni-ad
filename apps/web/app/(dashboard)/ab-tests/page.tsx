'use client';

import { useState } from 'react';
import {
  Award,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
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

// ============================================================
// Types
// ============================================================

type TestStatus = 'running' | 'completed' | 'paused' | 'draft';
type MetricType = 'ctr' | 'cvr' | 'roas' | 'cpa';
type TestType = 'creative' | 'headline' | 'cta' | 'targeting' | 'bidding' | 'lp';
type TrafficAllocation = 'equal' | 'thompson' | 'epsilon';
type SortKey = 'created' | 'significance' | 'lift';

interface Variant {
  name: string;
  description: string;
  impressions: number;
  clicks: number;
  conversions: number;
  rate: number;
  ci: { lower: number; upper: number } | null;
  pValue: number | null;
  isWinner: boolean;
}

interface ABTest {
  id: string;
  name: string;
  status: TestStatus;
  metric: MetricType;
  testType: TestType;
  campaignName: string;
  variantCount: number;
  currentSamples: number;
  requiredSamples: number;
  significance: number;
  bestVariant: string;
  lift: number;
  createdAt: string;
  variants: Variant[];
  pValue: number | null;
  confidenceInterval: { lower: number; upper: number } | null;
}

interface CreateFormVariant {
  name: string;
  description: string;
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<TestStatus, { labelKey: string; className: string }> = {
  running: {
    labelKey: 'abTests.running',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  completed: {
    labelKey: 'abTests.completed',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  paused: {
    labelKey: 'abTests.paused',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  draft: {
    labelKey: 'abTests.draft',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

const METRIC_CONFIG: Record<MetricType, { label: string; className: string; format: (v: number) => string }> = {
  ctr: {
    label: 'CTR',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  cvr: {
    label: 'CVR',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  roas: {
    label: 'ROAS',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    format: (v) => `${v.toFixed(2)}x`,
  },
  cpa: {
    label: 'CPA',
    className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    format: (v) => `${v.toLocaleString()}`,
  },
};

const TEST_TYPE_CONFIG: Record<TestType, { labelKey: string; className: string }> = {
  creative: { labelKey: 'abTests.testType.creative', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  headline: { labelKey: 'abTests.testType.headline', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  cta: { labelKey: 'abTests.testType.cta', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  targeting: { labelKey: 'abTests.testType.targeting', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  bidding: { labelKey: 'abTests.testType.bidding', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  lp: { labelKey: 'abTests.testType.lp', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

function getCampaignOptions(t: (key: string, params?: Record<string, string | number>) => string) {
  return [
  t('abtests.hc6f094'),
  t('abtests.haa8e92'),
  t('abtests.h986608'),
  t('abtests.h5f8f25'),
  t('abtests.h72fcf2'),
  t('abtests.h60ef5c'),
  t('abtests.h09330f'),
  t('abtests.h3ed7bb'),
];
}

const TRAFFIC_OPTIONS: { value: TrafficAllocation; labelKey: string; descKey: string }[] = [
  { value: 'equal', labelKey: 'abTests.equalAllocation', descKey: 'abTests.equalAllocationDesc' },
  { value: 'thompson', labelKey: 'abTests.thompsonSampling', descKey: 'abTests.thompsonDesc' },
  { value: 'epsilon', labelKey: 'abTests.epsilonGreedy', descKey: 'abTests.epsilonDesc' },
];

// ============================================================
// Mock Data (25 tests)
// ============================================================

function generateMockTests(t: (key: string, params?: Record<string, string | number>) => string): ABTest[] {
  const names = [
    t('abtests.h115194'), t('abtests.hdd82ff'), t('abtests.h7dfccf'), t('abtests.h9fd32b'),
    t('abtests.h61aa86'), t('abtests.h16c3ca'), t('abtests.haa46d0'), t('abtests.h6b7e11'),
    t('abtests.h855fc4'), t('abtests.hcda532'), t('abtests.hf8f528'), t('abtests.hda1767'),
    t('abtests.h37ab0d'), t('abtests.h59df6c'), t('abtests.h4f73cd'), t('abtests.hb51571'),
    t('abtests.h5f4060'), t('abtests.h6a7254'), t('abtests.h861234'), t('abtests.h4f579c'),
    t('abtests.h4633c0'), t('abtests.h7798f4'), t('abtests.h713bc9'), t('abtests.h1dc3ce'),
    t('abtests.hf5fb5e'),
  ];

  const testTypes: TestType[] = ['creative', 'headline', 'cta', 'targeting', 'bidding', 'lp'];
  const metrics: MetricType[] = ['ctr', 'cvr', 'roas', 'cpa'];
  const statuses: TestStatus[] = ['running', 'running', 'running', 'completed', 'paused'];

  return names.map((name, i) => {
    const status = statuses[i % statuses.length] as TestStatus;
    const metric = metrics[i % metrics.length] as MetricType;
    const testType = testTypes[i % testTypes.length] as TestType;
    const variantCount = Math.floor(Math.random() * 4) + 2;
    const significance = status === 'completed'
      ? 95 + Math.random() * 5
      : Math.floor(Math.random() * 100);
    const currentSamples = Math.floor(Math.random() * 80000) + 5000;
    const requiredSamples = currentSamples + Math.floor(Math.random() * 40000);
    const lift = (Math.random() * 30 - 5);

    const variants: Variant[] = Array.from({ length: variantCount }, (_, vi) => {
      const isWinner = vi === 0;
      const rate = metric === 'roas'
        ? 2 + Math.random() * 3
        : metric === 'cpa'
          ? 500 + Math.random() * 2000
          : 0.01 + Math.random() * 0.08;
      return {
        name: vi === 0 ? '__control__' : `__variant_${String.fromCharCode(65 + vi)}__`,
        description: vi === 0 ? '__original__' : `__test_pattern_${vi}__`,
        impressions: Math.floor(currentSamples / variantCount),
        clicks: Math.floor(currentSamples / variantCount * 0.04),
        conversions: Math.floor(currentSamples / variantCount * 0.01),
        rate,
        ci: status === 'completed' ? { lower: rate * 0.9, upper: rate * 1.1 } : null,
        pValue: status === 'completed' ? Math.random() * 0.05 : null,
        isWinner,
      };
    });

    const bestVariantName = variants.find((v) => v.isWinner)?.name ?? '__control__';

    return {
      id: `t${i + 1}`,
      name,
      status,
      metric,
      testType,
      campaignName: getCampaignOptions(t)[i % getCampaignOptions(t).length] ?? '',
      variantCount,
      currentSamples,
      requiredSamples: status === 'completed' ? currentSamples : requiredSamples,
      significance: Math.round(significance * 10) / 10,
      bestVariant: bestVariantName,
      lift: Math.round(lift * 10) / 10,
      createdAt: `2026-03-${String(Math.max(1, 30 - i)).padStart(2, '0')}`,
      variants,
      pValue: status === 'completed' ? Math.random() * 0.05 : null,
      confidenceInterval: status === 'completed'
        ? { lower: lift - 2, upper: lift + 2 }
        : null,
    };
  });
}

// Mock tests generated inside component via useMemo

// ============================================================
// Helpers
// ============================================================

function translateVariantName(
  name: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (name === '__control__') return t('abTests.control');
  if (name === '__original__') return t('abTests.original');
  const variantMatch = /^__variant_([A-Z])__$/.exec(name);
  if (variantMatch) {
    return `${t('abTests.variants')} ${variantMatch[1]}`;
  }
  const patternMatch = /^__test_pattern_(\d+)__$/.exec(name);
  if (patternMatch) {
    return `${t('abTests.testPattern')} ${patternMatch[1]}`;
  }
  return name;
}

// ============================================================
// Subcomponents
// ============================================================

function StatusBadge({ status }: { status: TestStatus }): React.ReactElement {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
}

function MetricBadge({ metric }: { metric: MetricType }): React.ReactElement {
  const config = METRIC_CONFIG[metric];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function TypeBadge({ testType }: { testType: TestType }): React.ReactElement {
  const { t } = useI18n();
  const config = TEST_TYPE_CONFIG[testType];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', config.className)}>
      {t(config.labelKey)}
    </span>
  );
}

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
}

function KPICard({ label, value, icon, trend }: KPICardProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {trend && (
        <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
      )}
    </div>
  );
}

function MiniProgressBar({ current, total }: { current: number; total: number }): React.ReactElement {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground">
        {(current / 1000).toFixed(1)}K
      </span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">
        / {(total / 1000).toFixed(0)}K
      </span>
    </div>
  );
}

function SignificanceCell({ significance }: { significance: number }): React.ReactElement {
  const color = significance >= 95
    ? 'text-green-600 dark:text-green-400'
    : significance >= 80
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-muted-foreground';

  return (
    <span className={cn('text-sm font-semibold', color)}>
      {significance.toFixed(1)}%
    </span>
  );
}

// -- Test Detail Modal --

interface TestDetailModalProps {
  test: ABTest;
  onClose: () => void;
  onDeclareWinner: (testId: string) => void;
}

function TestDetailModal({ test, onClose, onDeclareWinner }: TestDetailModalProps): React.ReactElement {
  const { t } = useI18n();
  const metricConfig = METRIC_CONFIG[test.metric];

  const chartData = test.variants.map((v) => ({
    name: v.name,
    value: test.metric === 'roas' || test.metric === 'cpa' ? v.rate : v.rate * 100,
  }));

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
          {/* Per-variant metrics table */}
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
                          {variant.isWinner && <Trophy size={12} className="text-green-600 dark:text-green-400" />}
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

          {/* Chart */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t('abTests.variantComparison')}</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: number) => {
                      if (test.metric === 'roas') return `${v.toFixed(1)}x`;
                      if (test.metric === 'cpa') return `${v.toLocaleString()}`;
                      return `${v.toFixed(1)}%`;
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    formatter={(value: number) => {
                      if (test.metric === 'roas') return `${value.toFixed(2)}x`;
                      if (test.metric === 'cpa') return `${value.toLocaleString()}`;
                      return `${value.toFixed(2)}%`;
                    }}
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

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            {test.status === 'running' && test.significance >= 95 && (
              <button
                type="button"
                onClick={() => onDeclareWinner(test.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
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

// -- Create Test Modal --

interface CreateTestModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateTestModal({ open, onClose }: CreateTestModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [testType, setTestType] = useState<TestType>('creative');
  const [metric, setMetric] = useState<MetricType>('ctr');
  const [campaign, setCampaign] = useState(getCampaignOptions(t)[0] ?? '');
  const [variants, setVariants] = useState<CreateFormVariant[]>([
    { name: '', description: '' },
    { name: '', description: '' },
  ]);
  const [trafficAllocation, setTrafficAllocation] = useState<TrafficAllocation>('equal');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mde, setMde] = useState(10);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);
  const [fromBatch, setFromBatch] = useState(false);

  if (!open) return null;

  // Sample size calculation
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const baselineRate = metric === 'ctr' ? 0.05 : metric === 'cvr' ? 0.02 : 0;
  const mdeDecimal = mde / 100;

  let perVariant = 0;
  if (metric === 'roas' || metric === 'cpa') {
    perVariant = Math.ceil((2 * (zAlpha + zBeta) ** 2) / (mdeDecimal ** 2));
  } else {
    const p1 = baselineRate;
    const p2 = baselineRate * (1 + mdeDecimal);
    const diff = p1 - p2;
    if (diff !== 0) {
      perVariant = Math.ceil(
        ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (diff ** 2),
      );
    }
  }
  const totalSample = perVariant * variants.length;
  const estimatedDays = perVariant > 0 ? Math.ceil(totalSample / 1500) : 0;

  function addVariant(): void {
    setVariants((prev) => [...prev, { name: '', description: '' }]);
  }

  function removeVariant(index: number): void {
    if (variants.length <= 2) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariant(index: number, field: keyof CreateFormVariant, value: string): void {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{t('abTests.createTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Test name */}
          <div>
            <label htmlFor="ab-test-name" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.testName')}</label>
            <input
              id="ab-test-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('abtests.h115194')}
              required
            />
          </div>

          {/* Campaign */}
          <div>
            <label htmlFor="ab-campaign" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.campaignSelect')}</label>
            <div className="relative">
              <select
                id="ab-campaign"
                value={campaign}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCampaign(e.target.value)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {getCampaignOptions(t).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Test type */}
          <div>
            <label htmlFor="ab-test-type" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.testTypeLabel')}</label>
            <div className="relative">
              <select
                id="ab-test-type"
                value={testType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTestType(e.target.value as TestType)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{t(config.labelKey)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Metric */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.targetMetric')}</span>
            <div className="flex flex-wrap gap-2">
              {(['ctr', 'cvr', 'roas', 'cpa'] as const).map((m) => (
                <label
                  key={m}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                    metric === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <input
                    type="radio"
                    name="ab-metric"
                    value={m}
                    checked={metric === m}
                    onChange={() => setMetric(m)}
                    className="sr-only"
                  />
                  {METRIC_CONFIG[m].label}
                </label>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.addVariant')}</span>
            <div className="space-y-3">
              {variants.map((variant, idx) => (
                <div key={idx} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {idx === 0 ? t('abTests.controlLabel') : t('abTests.testLabel', { letter: String.fromCharCode(65 + idx) })}
                    </span>
                    {idx >= 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="rounded p-0.5 text-muted-foreground hover:text-red-600"
                        aria-label={t('abTests.removeVariant')}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'name', e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('abTests.variantName')}
                    required
                  />
                  <input
                    type="text"
                    value={variant.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'description', e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t('abTests.descriptionOptional')}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Plus size={14} />
              {t('abTests.addVariant')}
            </button>
          </div>

          {/* Traffic allocation */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">{t('abTests.trafficAllocation')}</span>
            <div className="space-y-2">
              {TRAFFIC_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                    trafficAllocation === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name="traffic"
                    value={opt.value}
                    checked={trafficAllocation === opt.value}
                    onChange={() => setTrafficAllocation(opt.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t(opt.labelKey)}</p>
                    <p className="text-xs text-muted-foreground">{t(opt.descKey)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Batch toggle */}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('abTests.batchAutoCreate')}</p>
              <p className="text-xs text-muted-foreground">{t('abTests.batchAutoCreateDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setFromBatch(!fromBatch)}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                fromBatch ? 'bg-primary' : 'bg-muted',
              )}
              role="switch"
              aria-checked={fromBatch}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  fromBatch ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {/* Advanced settings */}
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-muted-foreground" />
                {t('abTests.statisticalSettings')}
              </div>
              <ChevronDown size={14} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="ab-mde" className="text-sm font-medium text-foreground">{t('abTests.mde')}</label>
                    <span className="text-sm font-semibold text-primary">{mde}%</span>
                  </div>
                  <input
                    id="ab-mde"
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={mde}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMde(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                </div>
                <div>
                  <label htmlFor="ab-alpha" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.alpha')}</label>
                  <input
                    id="ab-alpha"
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.1}
                    value={alpha}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlpha(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="ab-power" className="mb-1 block text-sm font-medium text-foreground">{t('abTests.power')}</label>
                  <input
                    id="ab-power"
                    type="number"
                    step={0.05}
                    min={0.5}
                    max={0.99}
                    value={power}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPower(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Auto-calculated sample */}
          <div className="rounded-md bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary">{t('abTests.requiredSampleSize')}</p>
            <p className="mt-1 text-sm text-foreground">
              {t('abTests.perVariant')} <span className="font-bold">{perVariant.toLocaleString()}</span> {t('abTests.impressionsUnit')}
              <span className="text-muted-foreground"> ({t('abTests.totalLabel')} {totalSample.toLocaleString()})</span>
            </p>
            {estimatedDays > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('abTests.estimatedDays', { days: String(estimatedDays) })}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name || variants.some((v) => !v.name)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t('abTests.createTest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Bulk Actions Bar --

interface BulkActionsBarProps {
  selectedCount: number;
  hasSignificantTests: boolean;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onDeclareWinners: () => void;
  onClearSelection: () => void;
}

function BulkActionsBar({
  selectedCount,
  hasSignificantTests,
  onPause,
  onResume,
  onDelete,
  onDeclareWinners,
  onClearSelection,
}: BulkActionsBarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <span className="text-sm font-semibold text-foreground">{t('abTests.selectedCount', { count: String(selectedCount) })}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPause}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Pause size={12} />
          {t('abTests.bulkPause')}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Play size={12} />
          {t('abTests.bulkResume')}
        </button>
        {hasSignificantTests && (
          <button
            type="button"
            onClick={onDeclareWinners}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            <Trophy size={12} />
            {t('abTests.bulkDeclareWinners')}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-card px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <Trash2 size={12} />
          {t('abTests.bulkDelete')}
        </button>
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
      >
        {t('abTests.deselect')}
      </button>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ABTestsPage(): React.ReactElement {
  const { t } = useI18n();
  const [tests, setTests] = useState<ABTest[]>(() => generateMockTests(t));
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTest, setDetailTest] = useState<ABTest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState<TestStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TestType | 'all'>('all');
  const [metricFilter, setMetricFilter] = useState<MetricType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Computed stats
  const runningCount = tests.filter((t) => t.status === 'running').length;
  const completedCount = tests.filter((t) => t.status === 'completed').length;
  const winnersToday = 23;
  const avgSignificanceDays = 4.2;

  // Filtered & sorted tests
  const filteredTests = tests.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.testType !== typeFilter) return false;
    if (metricFilter !== 'all' && t.metric !== metricFilter) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedTests = [...filteredTests].sort((a, b) => {
    if (sortKey === 'significance') return b.significance - a.significance;
    if (sortKey === 'lift') return b.lift - a.lift;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const totalPages = Math.ceil(sortedTests.length / perPage);
  const paginatedTests = sortedTests.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Handlers
  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll(): void {
    const allIds = paginatedTests.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleDeclareWinner(testId: string): void {
    setTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: 'completed' as const, significance: 97 } : t)),
    );
    setDetailTest(null);
  }

  function handleBulkPause(): void {
    setTests((prev) =>
      prev.map((t) => (selectedIds.has(t.id) && t.status === 'running' ? { ...t, status: 'paused' as const } : t)),
    );
    setSelectedIds(new Set());
  }

  function handleBulkResume(): void {
    setTests((prev) =>
      prev.map((t) => (selectedIds.has(t.id) && t.status === 'paused' ? { ...t, status: 'running' as const } : t)),
    );
    setSelectedIds(new Set());
  }

  function handleBulkDelete(): void {
    setTests((prev) => prev.filter((t) => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
  }

  function handleBulkDeclareWinners(): void {
    setTests((prev) =>
      prev.map((t) =>
        selectedIds.has(t.id) && t.significance >= 95
          ? { ...t, status: 'completed' as const }
          : t,
      ),
    );
    setSelectedIds(new Set());
  }

  const selectedTests = tests.filter((t) => selectedIds.has(t.id));
  const hasSignificantInSelection = selectedTests.some((t) => t.significance >= 95 && t.status === 'running');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('abTests.title')}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {t('abTests.running')}: <span className="font-semibold text-green-600">{runningCount}{t('abTests.totalRunning')}</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">
              {t('abTests.completed')}: <span className="font-semibold text-blue-600">{completedCount}{t('abTests.totalCompleted')}</span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground">
              {t('abTests.winRate')}: <span className="font-semibold text-foreground">78%</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/creatives/mass-production"
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Zap size={16} />
            {t('abTests.batchCreate')}
          </a>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Plus size={16} />
            {t('abTests.create')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label={t('abTests.kpiRunningTests')}
          value={String(runningCount)}
          icon={<FlaskConical size={20} />}
          trend={t('abTests.trendWeekly', { count: '12' })}
        />
        <KPICard
          label={t('abTests.kpiTodayWinners')}
          value={String(winnersToday)}
          icon={<Trophy size={20} />}
          trend={t('abTests.trendAvg7d', { count: '18' })}
        />
        <KPICard
          label={t('abTests.kpiAvgDays')}
          value={`${avgSignificanceDays}${t('abTests.daysUnit')}`}
          icon={<Clock size={20} />}
          trend={t('abTests.trendMonthly', { days: '0.8' })}
        />
        <KPICard
          label={t('abTests.kpiTotalSamples')}
          value="12.4M"
          icon={<BarChart3 size={20} />}
          trend={t('abTests.trendImpressions30d')}
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(e.target.value as TestStatus | 'all');
              setCurrentPage(1);
            }}
            className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('abTests.filterStatusLabel')}
          >
            <option value="all">{t('abTests.filterAll')}</option>
            <option value="running">{t('abTests.running')}</option>
            <option value="completed">{t('abTests.completed')}</option>
            <option value="paused">{t('abTests.paused')}</option>
            <option value="draft">{t('abTests.draft')}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setTypeFilter(e.target.value as TestType | 'all');
              setCurrentPage(1);
            }}
            className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('abTests.filterTypeLabel')}
          >
            <option value="all">{t('abTests.filterAllTypes')}</option>
            {Object.entries(TEST_TYPE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{t(config.labelKey)}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Metric filter */}
        <div className="relative">
          <select
            value={metricFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setMetricFilter(e.target.value as MetricType | 'all');
              setCurrentPage(1);
            }}
            className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('abTests.filterMetricLabel')}
          >
            <option value="all">{t('abTests.filterAllMetrics')}</option>
            {Object.entries(METRIC_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('abTests.searchPlaceholder')}
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortKey}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortKey(e.target.value as SortKey)}
            className="appearance-none rounded-md border border-input bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('abTests.sortLabel')}
          >
            <option value="created">{t('abTests.sortCreated')}</option>
            <option value="significance">{t('abTests.sortSignificance')}</option>
            <option value="lift">{t('abTests.sortLift')}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          hasSignificantTests={hasSignificantInSelection}
          onPause={handleBulkPause}
          onResume={handleBulkResume}
          onDelete={handleBulkDelete}
          onDeclareWinners={handleBulkDeclareWinners}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Test Table */}
      {paginatedTests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-16">
          <FlaskConical size={48} className="text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || metricFilter !== 'all'
              ? t('abTests.emptyNoMatch')
              : t('abTests.emptyNoTests')}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {t('abTests.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={paginatedTests.length > 0 && paginatedTests.every((t) => selectedIds.has(t.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-input accent-primary"
                    aria-label={t('abTests.selectAll')}
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableTestName')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableType')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableMetric')}</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">{t('abTests.tableVariants')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableSamples')}</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground">{t('abTests.tableSignificance')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableBestVariant')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{t('abTests.tableStatus')}</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground">{t('abTests.tableAction')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTests.map((test) => (
                <tr
                  key={test.id}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/20',
                    selectedIds.has(test.id) && 'bg-primary/5',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(test.id)}
                      onChange={() => toggleSelect(test.id)}
                      className="h-4 w-4 rounded border-input accent-primary"
                      aria-label={t('abTests.selectTest', { name: test.name })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setDetailTest(test)}
                      className="text-left hover:underline"
                    >
                      <span className="font-medium text-foreground">{test.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{test.campaignName}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <TypeBadge testType={test.testType} />
                  </td>
                  <td className="px-3 py-2.5">
                    <MetricBadge metric={test.metric} />
                  </td>
                  <td className="px-3 py-2.5 text-center text-foreground">
                    {test.variantCount}
                  </td>
                  <td className="px-3 py-2.5">
                    <MiniProgressBar current={test.currentSamples} total={test.requiredSamples} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <SignificanceCell significance={test.significance} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {test.lift > 0 && <Trophy size={12} className="text-green-600 dark:text-green-400" />}
                      <span className="text-sm text-foreground">{translateVariantName(test.bestVariant, t)}</span>
                      <span className={cn(
                        'text-xs font-semibold',
                        test.lift > 0 ? 'text-green-600' : test.lift < 0 ? 'text-red-600' : 'text-muted-foreground',
                      )}>
                        {test.lift > 0 ? '+' : ''}{test.lift.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setDetailTest(test)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label={t('abTests.actionDetail')}
                        title={t('abTests.actionDetail')}
                      >
                        <ChevronRight size={14} />
                      </button>
                      {test.status === 'running' && (
                        <button
                          type="button"
                          onClick={() => setTests((prev) =>
                            prev.map((t) => (t.id === test.id ? { ...t, status: 'paused' as const } : t)),
                          )}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={t('abTests.actionPause')}
                          title={t('abTests.actionPause')}
                        >
                          <Pause size={14} />
                        </button>
                      )}
                      {test.status === 'paused' && (
                        <button
                          type="button"
                          onClick={() => setTests((prev) =>
                            prev.map((t) => (t.id === test.id ? { ...t, status: 'running' as const } : t)),
                          )}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={t('abTests.actionResume')}
                          title={t('abTests.actionResume')}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {test.status === 'running' && test.significance >= 95 && (
                        <button
                          type="button"
                          onClick={() => handleDeclareWinner(test.id)}
                          className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                          aria-label={t('abTests.actionDeclareWinner')}
                          title={t('abTests.actionDeclareWinner')}
                        >
                          <Award size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sortedTests.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('abTests.paginationShowing', { total: String(sortedTests.length), from: String((currentPage - 1) * perPage + 1), to: String(Math.min(currentPage * perPage, sortedTests.length)) })}</span>
            <div className="relative">
              <select
                value={perPage}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none rounded-md border border-input bg-background py-1 pl-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t('abTests.paginationPerPage')}
              >
                <option value={20}>{t('abTests.paginationItems', { count: '20' })}</option>
                <option value={50}>{t('abTests.paginationItems', { count: '50' })}</option>
                <option value={100}>{t('abTests.paginationItems', { count: '100' })}</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              aria-label={t('abTests.prevPage')}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
                    currentPage === pageNum
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-accent',
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              aria-label={t('abTests.nextPage')}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateTestModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {detailTest && (
        <TestDetailModal
          test={detailTest}
          onClose={() => setDetailTest(null)}
          onDeclareWinner={handleDeclareWinner}
        />
      )}
    </div>
  );
}
