/**
 * Local shape of a MonthlyRow as returned by the `monthlyFunnel.getPivot`
 * tRPC procedure. Mirrored here (instead of imported across the workspace)
 * to keep the web build decoupled from the API service source tree.
 */
export interface MonthlyRow {
  month: string;
  impressions: number;
  clicks: number;
  spend: number;
  revenue: number;
  cv1: number;
  cv2: number;
  cv3: number;
  cpc: number;
  ctr: number;
  cvr1: number;
  cpa1: number;
  cvr2: number;
  cpa2: number;
  cvr3: number;
  cpa3: number;
  divergence: number;
}

export interface FunnelStageMeta {
  name: string;
  eventName: string;
  type?: string;
}

export interface PivotMeta {
  stages: FunnelStageMeta[];
  eventNames: string[];
}

export interface MonthlyPivotResult {
  months: MonthlyRow[];
  meta: PivotMeta;
}

export type MonthRange = 6 | 12 | 24;
