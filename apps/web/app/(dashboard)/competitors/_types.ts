// Shared types for the competitors dashboard.

export type CompetitorStrategy = 'aggressive' | 'defensive' | 'opportunistic';
export type Platform =
  | 'meta'
  | 'google'
  | 'x'
  | 'tiktok'
  | 'line_yahoo'
  | 'amazon'
  | 'microsoft';

export type AlertType =
  | 'new_creative'
  | 'budget_increase'
  | 'new_keyword'
  | 'position_change'
  | 'new_campaign';

export type CounterActionType =
  | 'bid_adjustment'
  | 'budget_shift'
  | 'creative_counter'
  | 'targeting_expansion'
  | 'keyword_defense'
  | 'timing_attack'
  | 'skip';

export type CounterActionStatus = 'executed' | 'proposed' | 'rolled_back';

export interface CompetitorAlert {
  id: string;
  type: AlertType;
  competitorName: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
  timestamp: string;
  acknowledged: boolean;
}

export interface Competitor {
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

export interface ImpressionShareDataPoint {
  date: string;
  ours: number;
  competitorA: number;
  competitorB: number;
  competitorC: number;
}

export interface CounterAction {
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

export interface WeakWindowCell {
  day: number;
  hour: number;
  competitorCpc: number;
  avgCpc: number;
  impressionShare: number;
}

export interface KpiCardInput {
  labelKey: string;
  value: string;
  valueKey?: string;
  trend: string;
  trendKey?: string;
  trendPositive: boolean;
}
