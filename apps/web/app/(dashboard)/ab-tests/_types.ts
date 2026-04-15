export type TestStatus = 'running' | 'completed' | 'paused' | 'draft';
export type MetricType = 'ctr' | 'cvr' | 'roas' | 'cpa';
export type TestType = 'creative' | 'headline' | 'cta' | 'targeting' | 'bidding' | 'lp';
export type TrafficAllocation = 'equal' | 'thompson' | 'epsilon';
export type SortKey = 'created' | 'significance' | 'lift';

export interface Variant {
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

export interface ABTest {
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

export interface CreateFormVariant {
  name: string;
  description: string;
}

export const STATUS_CONFIG: Record<TestStatus, { labelKey: string; className: string }> = {
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

export const METRIC_CONFIG: Record<MetricType, { label: string; className: string; format: (v: number) => string }> = {
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

export const TEST_TYPE_CONFIG: Record<TestType, { labelKey: string; className: string }> = {
  creative: { labelKey: 'abTests.testType.creative', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  headline: { labelKey: 'abTests.testType.headline', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  cta: { labelKey: 'abTests.testType.cta', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  targeting: { labelKey: 'abTests.testType.targeting', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  bidding: { labelKey: 'abTests.testType.bidding', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  lp: { labelKey: 'abTests.testType.lp', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
};

export const TRAFFIC_OPTIONS: { value: TrafficAllocation; labelKey: string; descKey: string }[] = [
  { value: 'equal', labelKey: 'abTests.equalAllocation', descKey: 'abTests.equalAllocationDesc' },
  { value: 'thompson', labelKey: 'abTests.thompsonSampling', descKey: 'abTests.thompsonDesc' },
  { value: 'epsilon', labelKey: 'abTests.epsilonGreedy', descKey: 'abTests.epsilonDesc' },
];

type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getCampaignOptions(t: Translator): string[] {
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

export function translateVariantName(name: string, t: Translator): string {
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
