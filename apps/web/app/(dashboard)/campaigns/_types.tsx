import type React from 'react';
import { Globe, Image as ImageIcon, Sliders, Target, Users } from 'lucide-react';

// ============================================================
// Domain types shared across campaigns/* components
// ============================================================

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';
export type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversion' | 'retargeting';
export type BidStrategy = 'auto_maximize_conversions' | 'auto_target_cpa' | 'auto_target_roas' | 'manual_cpc';
export type Gender = 'male' | 'female' | 'unspecified';
export type Device = 'mobile' | 'desktop' | 'tablet' | 'all';
export type CampaignTab = 0 | 1 | 2 | 3 | 4;

export type SortField = 'name' | 'status' | 'budget' | 'roas' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platforms: Platform[];
  budget: { total: number; currency: string; dailyLimit?: number };
  roas: number;
  updatedAt: string;
  objective: Objective;
}

// ============================================================
// Constants
// ============================================================

type StatusVariant = 'neutral' | 'success' | 'warning' | 'info' | 'destructive';

export const STATUS_CONFIG: Record<CampaignStatus, { labelKey: string; variant: StatusVariant }> = {
  draft: { labelKey: 'campaigns.status.draft', variant: 'neutral' },
  active: { labelKey: 'campaigns.status.active', variant: 'success' },
  paused: { labelKey: 'campaigns.status.paused', variant: 'warning' },
  completed: { labelKey: 'campaigns.status.completed', variant: 'info' },
  archived: { labelKey: 'campaigns.status.archived', variant: 'destructive' },
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

export const ALL_PLATFORMS: Platform[] = [
  'meta', 'google', 'x', 'tiktok', 'line_yahoo', 'amazon', 'microsoft',
];

export const OBJECTIVE_KEYS: { value: Objective; labelKey: string }[] = [
  { value: 'awareness', labelKey: 'campaigns.objectiveAwareness' },
  { value: 'traffic', labelKey: 'campaigns.objectiveTraffic' },
  { value: 'engagement', labelKey: 'campaigns.objectiveEngagement' },
  { value: 'leads', labelKey: 'campaigns.objectiveLeads' },
  { value: 'conversion', labelKey: 'campaigns.objectiveConversion' },
  { value: 'retargeting', labelKey: 'campaigns.objectiveRetargeting' },
];

export const OBJECTIVE_LABEL_KEYS: Record<Objective, string> = {
  awareness: 'campaigns.objectiveAwareness',
  traffic: 'campaigns.objectiveTraffic',
  engagement: 'campaigns.objectiveEngagement',
  leads: 'campaigns.objectiveLeads',
  conversion: 'campaigns.objectiveConversion',
  retargeting: 'campaigns.objectiveRetargeting',
};

export const TABLE_COLUMNS: { key: SortField | 'platforms' | 'actions'; labelKey: string; sortable: boolean }[] = [
  { key: 'name', labelKey: 'common.name', sortable: true },
  { key: 'status', labelKey: 'common.status', sortable: true },
  { key: 'platforms', labelKey: 'campaigns.platforms', sortable: false },
  { key: 'budget', labelKey: 'campaigns.budget', sortable: true },
  { key: 'roas', labelKey: 'campaigns.roas', sortable: true },
  { key: 'updatedAt', labelKey: 'campaigns.updatedAt', sortable: true },
  { key: 'actions', labelKey: 'campaigns.actions', sortable: false },
];

// Export columns are resolved at render time using t()
export const EXPORT_COLUMN_DEFS = [
  { key: 'name' as const, labelKey: 'campaigns.name' },
  {
    key: 'status' as const,
    labelKey: 'common.status',
    format: (v: Campaign[keyof Campaign]) => STATUS_CONFIG[v as CampaignStatus]?.labelKey ?? String(v),
  },
  {
    key: 'platforms' as const,
    labelKey: 'campaigns.platforms',
    format: (v: Campaign[keyof Campaign]) =>
      (v as Platform[]).map((p) => PLATFORM_CONFIG[p]?.label ?? p).join(', '),
  },
  {
    key: 'budget' as const,
    labelKey: 'campaigns.budget',
    format: (v: Campaign[keyof Campaign]) => String((v as Campaign['budget']).total),
  },
  {
    key: 'roas' as const,
    labelKey: 'campaigns.roas',
    format: (v: Campaign[keyof Campaign]) => `${Number(v).toFixed(1)}x`,
  },
  {
    key: 'objective' as const,
    labelKey: 'campaigns.objective',
    format: (v: Campaign[keyof Campaign]) => OBJECTIVE_LABEL_KEYS[v as Objective] ?? String(v),
  },
  { key: 'updatedAt' as const, labelKey: 'campaigns.updatedAt' },
];

export const CAMPAIGN_TABS: { labelKey: string; icon: React.ReactNode }[] = [
  { labelKey: 'campaigns.basicInfo', icon: <Globe size={14} /> },
  { labelKey: 'campaigns.conversionSettings', icon: <Target size={14} /> },
  { labelKey: 'campaigns.targeting', icon: <Users size={14} /> },
  { labelKey: 'campaigns.creative', icon: <ImageIcon size={14} /> },
  { labelKey: 'campaigns.platform', icon: <Sliders size={14} /> },
];

export const BID_STRATEGY_OPTIONS: { value: BidStrategy; labelKey: string; descKey: string }[] = [
  { value: 'auto_maximize_conversions', labelKey: 'campaigns.bidMaxConversions', descKey: 'campaigns.bidMaxConversionsDesc' },
  { value: 'auto_target_cpa', labelKey: 'campaigns.bidTargetCpa', descKey: 'campaigns.bidTargetCpaDesc' },
  { value: 'auto_target_roas', labelKey: 'campaigns.bidTargetRoas', descKey: 'campaigns.bidTargetRoasDesc' },
  { value: 'manual_cpc', labelKey: 'campaigns.bidManualCpc', descKey: 'campaigns.bidManualCpcDesc' },
];

// ============================================================
// Localised helper lists (require t() at call time)
// ============================================================

type TFn = (key: string, params?: Record<string, string | number>) => string;

export function getConversionPoints(t: TFn): readonly string[] {
  return [t('campaigns.hcb222d'), t('campaigns.h41ac90'), t('campaigns.hf06d76')] as const;
}

export function getAgeOptions(): readonly string[] {
  return ['18', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65+'] as const;
}

export function getRegionSuggestions(t: TFn): readonly string[] {
  return [
    t('campaigns.h707ba1'), t('campaigns.hd94e2b'), t('campaigns.h20b7eb'),
    t('campaigns.h81fd0e'), t('campaigns.haf0713'), t('campaigns.he31419'),
    t('campaigns.hcda9a8'), t('campaigns.h841dd1'), t('campaigns.h030dd7'),
    t('campaigns.h403713'),
  ] as const;
}

export function getInterestSuggestions(t: TFn): readonly string[] {
  return [
    t('campaigns.h081747'), t('campaigns.hb93315'), t('campaigns.h85da04'),
    t('campaigns.hf11732'), t('campaigns.h874834'), t('campaigns.hc9aa09'),
    t('campaigns.h9d859b'), t('campaigns.h8e545f'), t('campaigns.h054653'),
    t('campaigns.h8640cb'),
  ] as const;
}

export function getExclusionAudiences(t: TFn): readonly string[] {
  return [
    t('campaigns.h6b9f86'), t('campaigns.hf666f2'), t('campaigns.hb7b07f'),
  ] as const;
}
