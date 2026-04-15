import type { ReactNode } from 'react';
import {
  BadgeJapaneseYen,
  BarChart3,
  Clock,
  Palette,
  Pause,
  Rocket,
  Search,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import type {
  AlertType,
  CompetitorStrategy,
  CounterActionStatus,
  CounterActionType,
  Platform,
} from './_types';

export const STRATEGY_CONFIG: Record<
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

export const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  google: { label: 'Google', color: 'bg-blue-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line_yahoo: { label: 'LINE/Yahoo', color: 'bg-green-500' },
  amazon: { label: 'Amazon', color: 'bg-orange-500' },
  microsoft: { label: 'Microsoft', color: 'bg-teal-500' },
};

export const ALERT_TYPE_ICONS: Record<AlertType, ReactNode> = {
  new_creative: <Palette size={16} className="text-purple-500" />,
  budget_increase: <BadgeJapaneseYen size={16} className="text-yellow-600" />,
  new_keyword: <Search size={16} className="text-blue-500" />,
  position_change: <TrendingUp size={16} className="text-green-500" />,
  new_campaign: <Rocket size={16} className="text-orange-500" />,
};

export const COUNTER_ACTION_CONFIG: Record<
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

export const COUNTER_STATUS_CONFIG: Record<
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

export function getDayLabels(
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return [
    t('competitors.he42b99'),
    t('competitors.hdf3bbd'),
    t('competitors.heab619'),
    t('competitors.he0a5e0'),
    t('competitors.h9c4189'),
    t('competitors.h06da77'),
    t('competitors.h3edddd'),
  ] as const;
}

export const STRATEGY_RADIO_OPTIONS: {
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
