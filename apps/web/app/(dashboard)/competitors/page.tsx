'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  BadgeJapaneseYen,
  BarChart3,
  Globe,
  Loader2,
  Palette,
  Pause,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/show-toast';
import { useI18n } from '@/lib/i18n';

// ============================================================
// Types
// ============================================================

type CompetitorStrategy = 'aggressive' | 'defensive' | 'opportunistic';
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

type AlertType =
  | 'new_creative'
  | 'budget_increase'
  | 'new_keyword'
  | 'position_change'
  | 'new_campaign';

type CounterActionType =
  | 'bid_adjustment'
  | 'budget_shift'
  | 'creative_counter'
  | 'targeting_expansion'
  | 'keyword_defense'
  | 'timing_attack'
  | 'skip';

type CounterActionStatus = 'executed' | 'proposed' | 'rolled_back';

interface CompetitorAlert {
  id: string;
  type: AlertType;
  competitorName: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}

interface Competitor {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  strategy: CompetitorStrategy;
  platforms: Platform[];
  adCount: number;
  estimatedMonthlyBudget: number;
  overlapRate: number;
  latestActivity: string;
  latestActivityTime: string;
}

interface ImpressionShareDataPoint {
  date: string;
  ours: number;
  competitorA: number;
  competitorB: number;
  competitorC: number;
}

interface CounterAction {
  id: string;
  type: CounterActionType;
  status: CounterActionStatus;
  competitorName: string;
  campaignName: string;
  reasoning: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  actionDetail: string;
  result: string | null;
  timestamp: string;
  timeAgo: string;
}

interface WeakWindowCell {
  day: number;
  hour: number;
  competitorCpc: number;
  avgCpc: number;
  impressionShare: number;
}

interface KpiCardData {
  label: string;
  value: string;
  trend: string;
  trendPositive: boolean;
}

// ============================================================
// Constants
// ============================================================

const STRATEGY_CONFIG: Record<
  CompetitorStrategy,
  { labelKey: string; badgeClass: string }
> = {
  aggressive: {
    labelKey: 'competitors.strategyAggressive',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  defensive: {
    labelKey: 'competitors.strategyDefensive',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  opportunistic: {
    labelKey: 'competitors.strategyOpportunistic',
    badgeClass:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
};

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  google: { label: 'Google', color: 'bg-blue-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line_yahoo: { label: 'LINE/Yahoo', color: 'bg-green-500' },
  amazon: { label: 'Amazon', color: 'bg-orange-500' },
  microsoft: { label: 'Microsoft', color: 'bg-teal-500' },
};

const ALERT_TYPE_ICONS: Record<AlertType, ReactNode> = {
  new_creative: <Palette size={16} className="text-purple-500" />,
  budget_increase: <BadgeJapaneseYen size={16} className="text-yellow-600" />,
  new_keyword: <Search size={16} className="text-blue-500" />,
  position_change: <TrendingUp size={16} className="text-green-500" />,
  new_campaign: <Rocket size={16} className="text-orange-500" />,
};

const COUNTER_ACTION_CONFIG: Record<
  CounterActionType,
  { icon: ReactNode; labelKey: string; badgeClass: string }
> = {
  bid_adjustment: {
    icon: <BadgeJapaneseYen size={16} />,
    labelKey: 'competitors.counterBidAdjustment',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  budget_shift: {
    icon: <BarChart3 size={16} />,
    labelKey: 'competitors.counterBudgetShift',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  creative_counter: {
    icon: <Palette size={16} />,
    labelKey: 'competitors.counterCreativeCounter',
    badgeClass:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  targeting_expansion: {
    icon: <Target size={16} />,
    labelKey: 'competitors.counterTargetingExpansion',
    badgeClass:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  keyword_defense: {
    icon: <Shield size={16} />,
    labelKey: 'competitors.counterKeywordDefense',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  timing_attack: {
    icon: <Clock size={16} />,
    labelKey: 'competitors.counterTimingAttack',
    badgeClass:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
  skip: {
    icon: <Pause size={16} />,
    labelKey: 'competitors.counterSkip',
    badgeClass:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

const COUNTER_STATUS_CONFIG: Record<
  CounterActionStatus,
  { labelKey: string; badgeClass: string }
> = {
  executed: {
    labelKey: 'competitors.statusExecuted',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  proposed: {
    labelKey: 'competitors.statusProposed',
    badgeClass:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  rolled_back: {
    labelKey: 'competitors.statusRolledBack',
    badgeClass:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

const STRATEGY_RADIO_OPTIONS: {
  value: CompetitorStrategy;
  labelKey: string;
  descriptionKey: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: 'aggressive',
    labelKey: 'competitors.strategyAggressive',
    descriptionKey: 'competitors.strategyAggressiveDesc',
    borderColor: 'border-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    value: 'defensive',
    labelKey: 'competitors.strategyDefensive',
    descriptionKey: 'competitors.strategyDefensiveDesc',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'opportunistic',
    labelKey: 'competitors.strategyOpportunisticLabel',
    descriptionKey: 'competitors.strategyOpportunisticDesc',
    borderColor: 'border-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
];

// ============================================================
// Mock Data
// ============================================================

const MOCK_ALERTS: CompetitorAlert[] = [
  {
    id: 'a1',
    type: 'new_creative',
    competitorName: 'CompetitorA',
    messageKey: 'competitors.alertNewCreatives',
    messageParams: { name: 'CompetitorA', count: 5 },
    timestamp: '2h',
    acknowledged: false,
  },
  {
    id: 'a2',
    type: 'budget_increase',
    competitorName: 'CompetitorC',
    messageKey: 'competitors.alertBudgetIncrease',
    messageParams: { name: 'CompetitorC', percent: 30 },
    timestamp: '4h',
    acknowledged: false,
  },
  {
    id: 'a3',
    type: 'position_change',
    competitorName: 'CompetitorE',
    messageKey: 'competitors.alertPositionGain',
    messageParams: { name: 'CompetitorE' },
    timestamp: '5h',
    acknowledged: false,
  },
  {
    id: 'a4',
    type: 'new_keyword',
    competitorName: 'CompetitorA',
    messageKey: 'competitors.alertNewKeywords',
    messageParams: { name: 'CompetitorA', count: 12 },
    timestamp: '6h',
    acknowledged: true,
  },
  {
    id: 'a5',
    type: 'new_campaign',
    competitorName: 'CompetitorB',
    messageKey: 'competitors.alertNewCampaign',
    messageParams: { name: 'CompetitorB' },
    timestamp: '8h',
    acknowledged: true,
  },
  {
    id: 'a6',
    type: 'budget_increase',
    competitorName: 'CompetitorD',
    messageKey: 'competitors.alertBudgetDouble',
    messageParams: { name: 'CompetitorD', platform: 'TikTok' },
    timestamp: '12h',
    acknowledged: true,
  },
  {
    id: 'a7',
    type: 'position_change',
    competitorName: 'CompetitorC',
    messageKey: 'competitors.alertPositionImproved',
    messageParams: { name: 'CompetitorC', delta: '0.5' },
    timestamp: '1d',
    acknowledged: true,
  },
  {
    id: 'a8',
    type: 'new_creative',
    competitorName: 'CompetitorE',
    messageKey: 'competitors.alertNewVideoAds',
    messageParams: { name: 'CompetitorE', count: 3 },
    timestamp: '1d',
    acknowledged: true,
  },
];

const MOCK_COMPETITORS: Competitor[] = [
  {
    id: 'c1',
    name: 'CompetitorA',
    domain: 'competitor-a.co.jp',
    active: true,
    strategy: 'aggressive',
    platforms: ['google', 'meta', 'tiktok'],
    adCount: 85,
    estimatedMonthlyBudget: 3800000,
    overlapRate: 62,
    latestActivity: '新クリエイティブ5本追加',
    latestActivityTime: '2時間前',
  },
  {
    id: 'c2',
    name: 'CompetitorB',
    domain: 'competitor-b.jp',
    active: true,
    strategy: 'defensive',
    platforms: ['google', 'line_yahoo'],
    adCount: 42,
    estimatedMonthlyBudget: 1800000,
    overlapRate: 45,
    latestActivity: '新キャンペーン開始',
    latestActivityTime: '8時間前',
  },
  {
    id: 'c3',
    name: 'CompetitorC',
    domain: 'competitor-c.com',
    active: true,
    strategy: 'opportunistic',
    platforms: ['google', 'meta', 'tiktok', 'line_yahoo', 'amazon'],
    adCount: 210,
    estimatedMonthlyBudget: 5200000,
    overlapRate: 71,
    latestActivity: '推定予算30%増加',
    latestActivityTime: '4時間前',
  },
  {
    id: 'c4',
    name: 'CompetitorD',
    domain: 'competitor-d.co.jp',
    active: true,
    strategy: 'defensive',
    platforms: ['meta', 'tiktok'],
    adCount: 67,
    estimatedMonthlyBudget: 2400000,
    overlapRate: 38,
    latestActivity: 'TikTok予算倍増',
    latestActivityTime: '12時間前',
  },
  {
    id: 'c5',
    name: 'CompetitorE',
    domain: 'competitor-e.jp',
    active: true,
    strategy: 'aggressive',
    platforms: ['google', 'amazon'],
    adCount: 93,
    estimatedMonthlyBudget: 3100000,
    overlapRate: 55,
    latestActivity: '主要KWで1位獲得',
    latestActivityTime: '5時間前',
  },
];

const MOCK_KPI_CARDS: (Omit<KpiCardData, 'label' | 'value' | 'trend'> & { labelKey: string; valueKey?: string; value: string; trendKey?: string; trend: string })[] = [
  {
    labelKey: 'competitors.kpiAvgImpressionShare',
    value: '42.3%',
    trend: '+2.1%',
    trendPositive: true,
  },
  {
    labelKey: 'competitors.kpiAvgPosition',
    value: '1.8',
    valueKey: 'competitors.positionUnit',
    trend: '+0.3',
    trendPositive: true,
  },
  {
    labelKey: 'competitors.kpiDetectedCount',
    value: '7',
    valueKey: 'competitors.companiesUnit',
    trend: '+2',
    trendPositive: false,
  },
  {
    labelKey: 'competitors.kpiMonthlyActions',
    value: '23',
    valueKey: 'competitors.timesUnit',
    trendKey: 'competitors.successCount',
    trend: '18',
    trendPositive: true,
  },
];

function generateImpressionShareData(): ImpressionShareDataPoint[] {
  const data: ImpressionShareDataPoint[] = [];
  const baseDate = new Date('2026-03-03');
  for (let i = 0; i < 30; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    data.push({
      date: `${month}/${day}`,
      ours: 38 + Math.round(Math.sin(i / 4) * 5 + Math.random() * 3),
      competitorA:
        22 + Math.round(Math.cos(i / 5) * 4 + Math.random() * 2),
      competitorB:
        15 + Math.round(Math.sin(i / 6) * 3 + Math.random() * 2),
      competitorC:
        18 + Math.round(Math.cos(i / 3) * 4 + Math.random() * 2),
    });
  }
  return data;
}

const MOCK_IMPRESSION_SHARE_DATA = generateImpressionShareData();

const MOCK_COUNTER_ACTIONS: CounterAction[] = [
  {
    id: 'ca1',
    type: 'bid_adjustment',
    status: 'executed',
    competitorName: 'CompetitorA',
    campaignName: 'Google検索 ブランドKW',
    reasoning:
      'CompetitorAがブランドキーワードのCPCを18%引き上げました。インプレッションシェアが5pt低下しており、即座の対抗入札が必要です。',
    confidence: 92,
    risk: 'low',
    actionDetail: 'Google検索 CPC: ¥150 → ¥172 (+15%)',
    result: 'インプレッションシェア: 38% → 45% (+7pt)',
    timestamp: '2026-04-02T13:00:00Z',
    timeAgo: '1時間前',
  },
  {
    id: 'ca2',
    type: 'budget_shift',
    status: 'executed',
    competitorName: 'CompetitorC',
    campaignName: 'Meta リターゲティング',
    reasoning:
      'CompetitorCのMeta広告予算が30%増加しています。当社のリターゲティング効率が高いため、予算を追加投入してシェアを維持します。',
    confidence: 85,
    risk: 'medium',
    actionDetail: 'Meta予算: ¥150,000/日 → ¥180,000/日 (+20%)',
    result: 'ROAS: 3.2 → 3.5 (+9%)',
    timestamp: '2026-04-02T12:00:00Z',
    timeAgo: '2時間前',
  },
  {
    id: 'ca3',
    type: 'creative_counter',
    status: 'proposed',
    competitorName: 'CompetitorA',
    campaignName: 'TikTok 新規獲得',
    reasoning:
      'CompetitorAが新クリエイティブ5本を投入し、エンゲージメント率が上昇しています。対抗クリエイティブの制作を推奨します。',
    confidence: 78,
    risk: 'low',
    actionDetail: '新クリエイティブ3本の制作・入稿を提案',
    result: null,
    timestamp: '2026-04-02T11:30:00Z',
    timeAgo: '2.5時間前',
  },
  {
    id: 'ca4',
    type: 'keyword_defense',
    status: 'executed',
    competitorName: 'CompetitorE',
    campaignName: 'Google検索 一般KW',
    reasoning:
      'CompetitorEが主要キーワード「マーケティングツール」で1位を獲得。防御入札と品質スコア改善施策を実行します。',
    confidence: 88,
    risk: 'medium',
    actionDetail:
      'キーワード入札: ¥280 → ¥320 (+14%), 広告文A/Bテスト開始',
    result: '掲載順位: 3位 → 2位',
    timestamp: '2026-04-02T10:00:00Z',
    timeAgo: '4時間前',
  },
  {
    id: 'ca5',
    type: 'timing_attack',
    status: 'executed',
    competitorName: 'CompetitorB',
    campaignName: 'Google検索 コンバージョンKW',
    reasoning:
      'CompetitorBは平日18:00-22:00に配信を強化する傾向があります。その時間帯を避け、早朝6:00-9:00に予算を集中させることでCPAを削減できます。',
    confidence: 82,
    risk: 'low',
    actionDetail: '配信スケジュール調整: 6:00-9:00に予算の40%を集中',
    result: 'CPA: ¥3,200 → ¥2,700 (-16%)',
    timestamp: '2026-04-02T09:00:00Z',
    timeAgo: '5時間前',
  },
  {
    id: 'ca6',
    type: 'targeting_expansion',
    status: 'executed',
    competitorName: 'CompetitorC',
    campaignName: 'Meta 類似オーディエンス',
    reasoning:
      'CompetitorCが既存オーディエンスを飽和させている兆候があります。新たな類似オーディエンスを追加し、未開拓セグメントを先取りします。',
    confidence: 75,
    risk: 'medium',
    actionDetail: '類似オーディエンス3セグメント追加 (2%, 5%, 8%)',
    result: 'リーチ: +45%, CPA: ¥2,100 (目標内)',
    timestamp: '2026-04-02T08:00:00Z',
    timeAgo: '6時間前',
  },
  {
    id: 'ca7',
    type: 'skip',
    status: 'executed',
    competitorName: 'CompetitorD',
    campaignName: 'TikTok ブランド認知',
    reasoning:
      'CompetitorDのTikTok予算倍増はブランド認知目的と推定されます。当社のコンバージョン重視キャンペーンとは競合領域が異なるため、対抗不要と判断しました。',
    confidence: 90,
    risk: 'low',
    actionDetail: '対抗アクション不要 - 競合領域の重複なし',
    result: null,
    timestamp: '2026-04-02T07:00:00Z',
    timeAgo: '7時間前',
  },
  {
    id: 'ca8',
    type: 'bid_adjustment',
    status: 'rolled_back',
    competitorName: 'CompetitorA',
    campaignName: 'Google検索 商品KW',
    reasoning:
      'CompetitorAの入札強化に対抗しましたが、CPAが目標を30%超過。ガードレール上限に達したためロールバックしました。',
    confidence: 65,
    risk: 'high',
    actionDetail: 'CPC: ¥200 → ¥245 (+22%) → ¥200 (ロールバック)',
    result: 'CPA超過のためロールバック実行',
    timestamp: '2026-04-01T20:00:00Z',
    timeAgo: '18時間前',
  },
  {
    id: 'ca9',
    type: 'budget_shift',
    status: 'executed',
    competitorName: 'CompetitorE',
    campaignName: 'Amazon スポンサープロダクト',
    reasoning:
      'CompetitorEのAmazon広告が強化されています。スポンサープロダクト広告の予算を増額し、商品ページの露出を確保します。',
    confidence: 80,
    risk: 'low',
    actionDetail: 'Amazon予算: ¥80,000/日 → ¥100,000/日 (+25%)',
    result: 'ACoS: 15% → 13% (-2pt)',
    timestamp: '2026-04-01T18:00:00Z',
    timeAgo: '20時間前',
  },
  {
    id: 'ca10',
    type: 'creative_counter',
    status: 'executed',
    competitorName: 'CompetitorC',
    campaignName: 'Meta ストーリーズ',
    reasoning:
      'CompetitorCの新ストーリーズ広告のCTRが高い。同フォーマットでの対抗クリエイティブを即座に入稿しました。',
    confidence: 84,
    risk: 'low',
    actionDetail: 'ストーリーズ用クリエイティブ4本を新規入稿',
    result: 'CTR: 2.1% → 2.8% (+33%)',
    timestamp: '2026-04-01T15:00:00Z',
    timeAgo: '23時間前',
  },
  {
    id: 'ca11',
    type: 'keyword_defense',
    status: 'executed',
    competitorName: 'CompetitorA',
    campaignName: 'Google検索 ブランドKW',
    reasoning:
      'CompetitorAがブランド名での出稿を開始しました。ブランドキーワードの防御入札を強化し、品質スコアの優位性を活用します。',
    confidence: 95,
    risk: 'low',
    actionDetail:
      'ブランドKW入札: ¥50 → ¥65 (+30%), サイトリンク追加',
    result: 'ブランドKWシェア: 85% → 95% (+10pt)',
    timestamp: '2026-04-01T12:00:00Z',
    timeAgo: '1日前',
  },
  {
    id: 'ca12',
    type: 'timing_attack',
    status: 'proposed',
    competitorName: 'CompetitorC',
    campaignName: 'Google検索 一般KW',
    reasoning:
      'CompetitorCは週末の配信が弱い傾向があります。土日に予算を集中させることで、低CPCでシェアを拡大できます。',
    confidence: 72,
    risk: 'low',
    actionDetail: '土日の予算配分を平日比+30%に設定',
    result: null,
    timestamp: '2026-04-02T13:30:00Z',
    timeAgo: '30分前',
  },
  {
    id: 'ca13',
    type: 'targeting_expansion',
    status: 'proposed',
    competitorName: 'CompetitorD',
    campaignName: 'Meta コンバージョン',
    reasoning:
      'CompetitorDがカバーしていない35-44歳男性セグメントで高いCVRが期待できます。テスト配信を推奨します。',
    confidence: 68,
    risk: 'medium',
    actionDetail:
      '35-44歳男性セグメントへのテスト配信 (予算¥30,000/日)',
    result: null,
    timestamp: '2026-04-02T13:15:00Z',
    timeAgo: '45分前',
  },
  {
    id: 'ca14',
    type: 'bid_adjustment',
    status: 'executed',
    competitorName: 'CompetitorB',
    campaignName: 'LINE広告 リマーケティング',
    reasoning:
      'CompetitorBのLINE広告が縮小傾向にあります。この機会にCPCを微調整し、低コストでシェアを拡大します。',
    confidence: 87,
    risk: 'low',
    actionDetail: 'LINE CPC: ¥85 → ¥92 (+8%)',
    result: 'インプレッション: +22%, CPA据置',
    timestamp: '2026-04-01T10:00:00Z',
    timeAgo: '1日前',
  },
  {
    id: 'ca15',
    type: 'budget_shift',
    status: 'executed',
    competitorName: 'CompetitorA',
    campaignName: 'TikTok コンバージョン',
    reasoning:
      'CompetitorAのTikTok広告効率が低下している兆候があります。当社のTikTokコンバージョンキャンペーンに予算をシフトし、シェアを拡大します。',
    confidence: 79,
    risk: 'low',
    actionDetail: 'TikTok予算: ¥120,000/日 → ¥145,000/日 (+21%)',
    result: 'CVR: 1.8% → 2.2% (+22%)',
    timestamp: '2026-04-01T08:00:00Z',
    timeAgo: '1日前',
  },
];

function generateWeakWindowData(): WeakWindowCell[] {
  const cells: WeakWindowCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const baseCompetitorCpc =
        120 + Math.sin((hour - 12) / 3) * 40 + (day >= 5 ? -30 : 0);
      const cpc = Math.max(
        50,
        Math.round(baseCompetitorCpc + (Math.random() - 0.5) * 20)
      );
      const avgCpc = 130;
      const shareBase =
        45 + Math.sin((hour - 14) / 4) * 15 + (day >= 5 ? 10 : 0);
      const share = Math.max(
        15,
        Math.min(
          85,
          Math.round(shareBase + (Math.random() - 0.5) * 10)
        )
      );
      cells.push({
        day,
        hour,
        competitorCpc: cpc,
        avgCpc,
        impressionShare: share,
      });
    }
  }
  return cells;
}

const MOCK_WEAK_WINDOWS = generateWeakWindowData();

// ============================================================
// Subcomponents
// ============================================================

function AlertBanner({
  alerts,
  onAcknowledge,
}: {
  alerts: CompetitorAlert[];
  onAcknowledge: (id: string) => void;
}): React.ReactElement | null {
  const { t } = useI18n();
  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  if (unacknowledged.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/30"
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle
          size={16}
          className="text-yellow-600 dark:text-yellow-400"
        />
        <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
          {t('competitors.alertCount', { count: unacknowledged.length })}
        </span>
      </div>
      <div className="space-y-2">
        {unacknowledged.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between rounded-md bg-white/60 px-3 py-2 dark:bg-black/20"
          >
            <div className="flex items-center gap-2">
              <span>{ALERT_TYPE_ICONS[alert.type]}</span>
              <span className="text-sm text-yellow-900 dark:text-yellow-200">
                {t(alert.messageKey, alert.messageParams)}
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-500">
                {t(`competitors.time.${alert.timestamp}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAcknowledge(alert.id)}
              className="rounded-md bg-yellow-200 px-2.5 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700"
            >
              {t('competitors.acknowledge')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCardRow({
  cards,
}: {
  cards: typeof MOCK_KPI_CARDS;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.labelKey}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {t(card.labelKey)}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {card.value}{card.valueKey ? t(card.valueKey) : ''}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                card.trendPositive
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {card.trendPositive ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {card.trendKey ? t(card.trendKey, { count: card.trend }) : card.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StrategyBadge({
  strategy,
}: {
  strategy: CompetitorStrategy;
}): React.ReactElement {
  const { t } = useI18n();
  const config = STRATEGY_CONFIG[strategy];
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        config.badgeClass
      )}
    >
      {t(config.labelKey)}
    </span>
  );
}

function PlatformIcons({
  platforms,
}: {
  platforms: Platform[];
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-white',
            PLATFORM_CONFIG[p].color
          )}
          title={PLATFORM_CONFIG[p].label}
        >
          {PLATFORM_CONFIG[p].label}
        </span>
      ))}
    </div>
  );
}

function ImpressionShareChart({
  data,
}: {
  data: ImpressionShareDataPoint[];
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t('competitors.impressionShareTrend')}
      </h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
          />
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
            formatter={(value: number, name: string) => [
              `${value}%`,
              name,
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ours"
            name={t('competitors.ownCompany')}
            stroke="#3B82F6"
            strokeWidth={3}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="competitorA"
            name="CompetitorA"
            stroke="#EF4444"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="competitorB"
            name="CompetitorB"
            stroke="#8B5CF6"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="competitorC"
            name="CompetitorC"
            stroke="#F59E0B"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompetitorMapCard({
  competitor,
  onSettings,
  onDelete,
}: {
  competitor: Competitor;
  onSettings: (id: string) => void;
  onDelete: (id: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {competitor.name}
            </h3>
            {competitor.active && (
              <span
                className="inline-flex h-2 w-2 rounded-full bg-green-500"
                title={t('competitors.active')}
              />
            )}
          </div>
          <a
            href={`https://${competitor.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Globe size={10} />
            {competitor.domain}
            <ExternalLink size={10} />
          </a>
        </div>
        <StrategyBadge strategy={competitor.strategy} />
      </div>

      <div className="mt-3">
        <PlatformIcons platforms={competitor.platforms} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">{t('competitors.adCount')}</p>
          <p className="text-lg font-bold text-foreground">
            {competitor.adCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">{t('competitors.estimatedBudget')}</p>
          <p className="text-lg font-bold text-foreground">
            {(competitor.estimatedMonthlyBudget / 10000).toFixed(0)}{t('competitors.tenThousandUnit')}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">
            {t('competitors.overlapRate')}
          </p>
          <p className="text-lg font-bold text-foreground">
            {competitor.overlapRate}%
          </p>
        </div>
      </div>

      <div className="mt-3 rounded bg-muted/50 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <Clock size={10} className="mr-1 inline" />
          {competitor.latestActivityTime}: {competitor.latestActivity}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/competitors/${competitor.id}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('competitors.detail')}
        </a>
        <button
          type="button"
          onClick={() => onSettings(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${competitor.name} ${t('competitors.settings')}`}
        >
          <Settings size={12} className="mr-1 inline" />
          {t('competitors.settings')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(competitor.id)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
          aria-label={`${competitor.name} ${t('common.delete')}`}
        >
          <Trash2 size={12} className="mr-1 inline" />
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

function CounterActionCard({
  action,
}: {
  action: CounterAction;
}): React.ReactElement {
  const { t } = useI18n();
  const typeConfig = COUNTER_ACTION_CONFIG[action.type];
  const statusConfig = COUNTER_STATUS_CONFIG[action.status];

  const riskColorMap: Record<CounterAction['risk'], string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-green-600 dark:text-green-400',
  };
  const riskLabelKeyMap: Record<CounterAction['risk'], string> = {
    high: 'competitors.riskHigh',
    medium: 'competitors.riskMedium',
    low: 'competitors.riskLow',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base">{typeConfig.icon}</span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            typeConfig.badgeClass
          )}
        >
          {t(typeConfig.labelKey)}
        </span>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            statusConfig.badgeClass
          )}
        >
          {t(statusConfig.labelKey)}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {action.timeAgo}
        </span>
      </div>

      {/* Competitor + Campaign */}
      <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
        <span className="font-medium">{action.competitorName}</span>
        <span className="text-muted-foreground">/</span>
        <span>{action.campaignName}</span>
      </div>

      {/* Reasoning */}
      <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">
        {action.reasoning}
      </blockquote>

      {/* Confidence + Risk */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs">
          <Target size={10} className="text-primary" />
          {t('competitors.confidence')}: {action.confidence}%
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            riskColorMap[action.risk]
          )}
        >
          <Shield size={10} />
          {t('competitors.risk')}: {t(riskLabelKeyMap[action.risk])}
        </span>
      </div>

      {/* Action detail */}
      <div className="mt-2 rounded bg-muted/50 px-3 py-2 text-xs text-foreground">
        {action.actionDetail}
      </div>

      {/* Result */}
      {action.result !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
          <TrendingUp size={12} />
          {t('competitors.result')}: {action.result}
        </div>
      )}

      {/* Rollback button */}
      {action.status === 'executed' && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={10} />
          {t('competitors.rollback')}
        </button>
      )}
    </div>
  );
}

function CounterActionTimeline({
  actions,
  expanded,
  onToggle,
}: {
  actions: CounterAction[];
  expanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.counterLog')}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('competitors.counterLogCount', { count: actions.length })}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={20} className="text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 px-6 pb-6">
          {actions.map((action) => (
            <CounterActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeakWindowsHeatmap({
  data,
}: {
  data: WeakWindowCell[];
}): React.ReactElement {
  const { t } = useI18n();
  const [hoveredCell, setHoveredCell] =
    useState<WeakWindowCell | null>(null);

  function getCellColor(cell: WeakWindowCell): string {
    const ratio = cell.competitorCpc / cell.avgCpc;
    if (ratio < 0.7) return 'bg-green-500/80';
    if (ratio < 0.85) return 'bg-green-400/60';
    if (ratio < 0.95) return 'bg-green-300/40';
    if (ratio < 1.05) return 'bg-yellow-300/40';
    if (ratio < 1.15) return 'bg-orange-400/60';
    return 'bg-red-500/80';
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold text-foreground">
        {t('competitors.weakWindowMap')}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {t('competitors.weakWindowDesc')}
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]" role="grid" aria-label={t('competitors.weakWindowLabel')}>
          {/* Hour labels */}
          <div className="mb-1 flex" role="row">
            <div className="w-10 flex-shrink-0" role="columnheader" />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] text-muted-foreground"
                role="columnheader"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div
              key={dayIdx}
              className="flex items-center gap-0.5"
              role="row"
            >
              <div
                className="w-10 flex-shrink-0 pr-2 text-right text-xs font-medium text-muted-foreground"
                role="rowheader"
              >
                {DAY_LABELS[dayIdx]}
              </div>
              {Array.from({ length: 24 }, (_, hourIdx) => {
                const cell = data.find(
                  (c) => c.day === dayIdx && c.hour === hourIdx
                );
                if (!cell) return null;
                const isHovered =
                  hoveredCell?.day === dayIdx &&
                  hoveredCell?.hour === hourIdx;
                return (
                  <div
                    key={hourIdx}
                    className={cn(
                      'aspect-square flex-1 cursor-pointer rounded-sm transition-opacity',
                      getCellColor(cell),
                      isHovered ? 'ring-2 ring-foreground' : ''
                    )}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    role="gridcell"
                    aria-label={`${DAY_LABELS[dayIdx]}曜 ${hourIdx}:00 CPC ¥${cell.competitorCpc}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell !== null && (
        <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          {DAY_LABELS[hoveredCell.day]}曜 {hoveredCell.hour}:00 - CPC
          ¥{hoveredCell.competitorCpc} (平均比
          {Math.round(
            ((hoveredCell.competitorCpc - hoveredCell.avgCpc) /
              hoveredCell.avgCpc) *
              100
          )}
          %), インプレッションシェア {hoveredCell.impressionShare}%
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-green-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendWeak')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-yellow-300/40" />
          <span className="text-[10px] text-muted-foreground">{t('competitors.legendEven')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-sm bg-red-500/80" />
          <span className="text-[10px] text-muted-foreground">
            {t('competitors.legendStrong')}
          </span>
        </div>
      </div>
    </div>
  );
}

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
}

function AddCompetitorModal({
  open,
  onClose,
}: AddCompetitorModalProps): React.ReactElement | null {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(
    []
  );
  const [keywords, setKeywords] = useState('');
  const [strategy, setStrategy] =
    useState<CompetitorStrategy>('defensive');
  const [maxBidIncrease, setMaxBidIncrease] = useState(15);
  const [maxBudgetShift, setMaxBudgetShift] = useState(20);
  const [isAdding, setIsAdding] = useState(false);

  if (!open) return null;

  function handleTogglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name || !domain) return;
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      showToast(t('competitors.addedToast', { name }));
      onClose();
    }, 1500);
  }

  const allPlatforms: Platform[] = [
    'google',
    'meta',
    'tiktok',
    'line_yahoo',
    'amazon',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('competitors.modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Brand name */}
          <div>
            <label
              htmlFor="comp-name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.brandName')}
            </label>
            <input
              id="comp-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="CompetitorX"
              required
            />
          </div>

          {/* Domain */}
          <div>
            <label
              htmlFor="comp-domain"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.domain')}
            </label>
            <input
              id="comp-domain"
              type="text"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDomain(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="competitor-x.co.jp"
              required
            />
          </div>

          {/* Platforms */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.monitorPlatforms')}
            </p>
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((p) => {
                const checked = selectedPlatforms.includes(p);
                return (
                  <label
                    key={p}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => handleTogglePlatform(p)}
                    />
                    {PLATFORM_CONFIG[p].label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label
              htmlFor="comp-keywords"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('competitors.keywords')}
            </label>
            <input
              id="comp-keywords"
              type="text"
              value={keywords}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setKeywords(e.target.value)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('competitors.keywordsPlaceholder')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t('competitors.keywordsHint')}
            </p>
          </div>

          {/* Strategy */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('competitors.counterStrategy')}
            </p>
            <div className="space-y-2">
              {STRATEGY_RADIO_OPTIONS.map((opt) => {
                const selected = strategy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStrategy(opt.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all',
                      selected
                        ? `${opt.borderColor} ${opt.bgColor}`
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                        selected
                          ? 'border-transparent bg-primary'
                          : 'border-muted-foreground/40'
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold',
                          selected
                            ? opt.textColor
                            : 'text-foreground'
                        )}
                      >
                        {t(opt.labelKey)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t(opt.descriptionKey)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardrails */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t('competitors.guardrails')}
            </h3>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBidIncrease')}</span>
                <span className="font-medium text-foreground">
                  {maxBidIncrease}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={maxBidIncrease}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) => setMaxBidIncrease(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="最大入札上昇率"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>30%</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('competitors.maxBudgetShift')}</span>
                <span className="font-medium text-foreground">
                  {maxBudgetShift}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={maxBudgetShift}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) => setMaxBudgetShift(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="最大予算シフト率"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isAdding || !name || !domain}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {t('competitors.addBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function CompetitorsPage(): React.ReactElement {
  const { t } = useI18n();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [counterLogExpanded, setCounterLogExpanded] = useState(true);
  const [alerts, setAlerts] =
    useState<CompetitorAlert[]>(MOCK_ALERTS);
  const [scanning, setScanning] = useState(false);

  // TODO: Wire to tRPC when backend is ready
  // const { data, isLoading } = trpc.competitors.list.useQuery();
  // const scanMutation = trpc.competitors.scan.useMutation();

  const monitoringEnabled = true;

  function handleAcknowledgeAlert(id: string): void {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      )
    );
  }

  function handleScan(): void {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      showToast(t('competitors.scanComplete'));
    }, 3000);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('competitors.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('competitors.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              monitoringEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                monitoringEnabled
                  ? 'bg-green-500'
                  : 'bg-gray-500'
              )}
            />
            {t('competitors.autoMonitoring')}: {monitoringEnabled ? t('competitors.monitoringOn') : t('competitors.monitoringOff')}
          </span>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={cn(scanning && 'animate-spin')}
            />
            {t('competitors.scan')}
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={14} />
            {t('competitors.addCompetitor')}
          </button>
        </div>
      </div>

      {/* Alert banner */}
      <AlertBanner
        alerts={alerts}
        onAcknowledge={handleAcknowledgeAlert}
      />

      {/* KPI cards */}
      <KpiCardRow cards={MOCK_KPI_CARDS} />

      {/* Impression share chart */}
      <ImpressionShareChart data={MOCK_IMPRESSION_SHARE_DATA} />

      {/* Competitor map */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('competitors.competitorMap')}
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {MOCK_COMPETITORS.map((competitor) => (
            <CompetitorMapCard
              key={competitor.id}
              competitor={competitor}
              onSettings={() => {
                showToast(t('competitors.settingsToast', { name: competitor.name }));
              }}
              onDelete={() => {
                if (window.confirm(t('competitors.deleteConfirm', { name: competitor.name }))) {
                  showToast(t('competitors.deleteToast', { name: competitor.name }));
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Weak windows heatmap */}
      <WeakWindowsHeatmap data={MOCK_WEAK_WINDOWS} />

      {/* Counter-action timeline */}
      <CounterActionTimeline
        actions={MOCK_COUNTER_ACTIONS}
        expanded={counterLogExpanded}
        onToggle={() => setCounterLogExpanded((prev) => !prev)}
      />

      {/* Add competitor modal */}
      <AddCompetitorModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}
