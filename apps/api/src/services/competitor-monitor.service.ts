/**
 * Competitor Monitor Service
 *
 * Monitors competitor activity via auction insights and Meta Ad Library,
 * detects threats/opportunities, and generates alerts for the auto-counter
 * system to act upon.
 */

import { db } from '@omni-ad/db';
import {
  auctionInsightSnapshots,
  competitorAlerts,
  competitorCreatives,
  competitorProfiles,
  campaigns,
  metricsDaily,
} from '@omni-ad/db/schema';
import type {
  AlertData,
} from '@omni-ad/db/schema';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompetitorProfileSelect = typeof competitorProfiles.$inferSelect;
type CompetitorAlertSelect = typeof competitorAlerts.$inferSelect;

type AlertType = CompetitorAlertSelect['alertType'];
type AlertSeverity = CompetitorAlertSelect['severity'];

interface AddCompetitorInput {
  name: string;
  domain: string;
  platforms?: string[];
  keywords?: string[];
  metaPageIds?: string[];
  autoCounterEnabled?: boolean;
  counterStrategy?: CompetitorProfileSelect['counterStrategy'];
  maxBidIncreasePercent?: number;
  maxBudgetShiftPercent?: number;
}

interface UpdateCompetitorInput {
  name?: string;
  domain?: string;
  platforms?: string[];
  keywords?: string[];
  metaPageIds?: string[] | null;
  autoCounterEnabled?: boolean;
  counterStrategy?: CompetitorProfileSelect['counterStrategy'];
  maxBidIncreasePercent?: number;
  maxBudgetShiftPercent?: number;
}

interface ListAlertsFilter {
  acknowledged?: boolean;
  alertType?: AlertType;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}

interface CollectionResult {
  snapshotsCreated: number;
  alertsGenerated: number;
}

interface MetaAdLibraryParams {
  searchTerms?: string;
  adReachedCountries: string;
  adType: 'ALL' | 'POLITICAL_AND_ISSUE_ADS';
  limit: number;
  searchPageIds?: string;
}

interface MetaAdRecord {
  id: string;
  ad_creation_time: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time?: string;
  page_name: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  spend?: { lower_bound: string; upper_bound: string };
  impressions?: { lower_bound: string; upper_bound: string };
  currency?: string;
}

interface MetaAdLibraryResponse {
  data: MetaAdRecord[];
  paging?: { cursors: { after: string }; next: string };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CompetitorMonitorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompetitorMonitorError';
  }
}

export class CompetitorNotFoundError extends Error {
  constructor(competitorId: string) {
    super(`Competitor not found: ${competitorId}`);
    this.name = 'CompetitorNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Competitor Profile CRUD
// ---------------------------------------------------------------------------

export async function addCompetitor(
  organizationId: string,
  input: AddCompetitorInput,
): Promise<CompetitorProfileSelect> {
  const [created] = await db
    .insert(competitorProfiles)
    .values({
      organizationId,
      name: input.name,
      domain: input.domain,
      platforms: input.platforms ?? ['google', 'meta'],
      keywords: input.keywords ?? [],
      metaPageIds: input.metaPageIds ?? null,
      autoCounterEnabled: input.autoCounterEnabled ?? true,
      counterStrategy: input.counterStrategy ?? 'defensive',
      maxBidIncreasePercent: input.maxBidIncreasePercent ?? 15,
      maxBudgetShiftPercent: input.maxBudgetShiftPercent ?? 20,
    })
    .returning();

  if (!created) {
    throw new CompetitorMonitorError('Failed to create competitor profile');
  }

  return created;
}

export async function listCompetitors(
  organizationId: string,
): Promise<CompetitorProfileSelect[]> {
  return db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.organizationId, organizationId),
        eq(competitorProfiles.active, true),
      ),
    )
    .orderBy(competitorProfiles.name);
}

export async function updateCompetitor(
  competitorId: string,
  organizationId: string,
  input: UpdateCompetitorInput,
): Promise<CompetitorProfileSelect> {
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updateSet['name'] = input.name;
  if (input.domain !== undefined) updateSet['domain'] = input.domain;
  if (input.platforms !== undefined) updateSet['platforms'] = input.platforms;
  if (input.keywords !== undefined) updateSet['keywords'] = input.keywords;
  if (input.metaPageIds !== undefined)
    updateSet['metaPageIds'] = input.metaPageIds;
  if (input.autoCounterEnabled !== undefined)
    updateSet['autoCounterEnabled'] = input.autoCounterEnabled;
  if (input.counterStrategy !== undefined)
    updateSet['counterStrategy'] = input.counterStrategy;
  if (input.maxBidIncreasePercent !== undefined)
    updateSet['maxBidIncreasePercent'] = input.maxBidIncreasePercent;
  if (input.maxBudgetShiftPercent !== undefined)
    updateSet['maxBudgetShiftPercent'] = input.maxBudgetShiftPercent;

  const [updated] = await db
    .update(competitorProfiles)
    .set(updateSet)
    .where(
      and(
        eq(competitorProfiles.id, competitorId),
        eq(competitorProfiles.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new CompetitorNotFoundError(competitorId);
  }

  return updated;
}

export async function removeCompetitor(
  competitorId: string,
  organizationId: string,
): Promise<CompetitorProfileSelect> {
  const [deactivated] = await db
    .update(competitorProfiles)
    .set({ active: false, updatedAt: sql`now()` })
    .where(
      and(
        eq(competitorProfiles.id, competitorId),
        eq(competitorProfiles.organizationId, organizationId),
      ),
    )
    .returning();

  if (!deactivated) {
    throw new CompetitorNotFoundError(competitorId);
  }

  return deactivated;
}

// ---------------------------------------------------------------------------
// Data Collection: Auction Insights
// ---------------------------------------------------------------------------

export async function collectAuctionInsights(
  organizationId: string,
): Promise<CollectionResult> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Get active campaigns
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      sql`${campaigns.status} IN ('active')`,
    ),
    with: { platformDeployments: true },
  });

  let snapshotsCreated = 0;
  let alertsGenerated = 0;

  for (const campaign of activeCampaigns) {
    // Fetch recent metrics to derive auction insight proxy
    const recentMetrics = await db
      .select()
      .from(metricsDaily)
      .where(
        and(
          eq(metricsDaily.campaignId, campaign.id),
          gte(metricsDaily.date, yesterday),
        ),
      )
      .orderBy(desc(metricsDaily.date))
      .limit(2);

    if (recentMetrics.length === 0) continue;

    const todayMetric = recentMetrics[0];
    if (!todayMetric) continue;

    // Create snapshot from available metrics
    // In production, this would call Google Ads API / Microsoft Ads API
    const impressionShare = todayMetric.impressions > 0
      ? Math.min(1, todayMetric.impressions / (todayMetric.impressions * 1.3))
      : 0;
    const avgCpc = todayMetric.clicks > 0
      ? Number(todayMetric.spend) / todayMetric.clicks
      : 0;

    for (const deployment of campaign.platformDeployments) {
      const [snapshot] = await db
        .insert(auctionInsightSnapshots)
        .values({
          organizationId,
          campaignId: campaign.id,
          platform: deployment.platform,
          snapshotDate: today,
          impressionShare,
          avgCpc,
          rawData: {
            impressions: todayMetric.impressions,
            clicks: todayMetric.clicks,
            spend: Number(todayMetric.spend),
          },
        })
        .returning();

      if (snapshot) snapshotsCreated++;
    }

    // Compare with previous day for anomaly detection
    const previousSnapshots = await db
      .select()
      .from(auctionInsightSnapshots)
      .where(
        and(
          eq(auctionInsightSnapshots.organizationId, organizationId),
          eq(auctionInsightSnapshots.campaignId, campaign.id),
          eq(auctionInsightSnapshots.snapshotDate, yesterday),
        ),
      );

    for (const prevSnapshot of previousSnapshots) {
      // Impression share drop > 5%
      const isDrop = prevSnapshot.impressionShare - impressionShare > 0.05;
      if (isDrop) {
        await createAlertInternal(
          organizationId,
          'impression_share_drop',
          'high',
          `${campaign.name}: インプレッションシェアが低下`,
          `キャンペーン「${campaign.name}」のインプレッションシェアが${(prevSnapshot.impressionShare * 100).toFixed(1)}%から${(impressionShare * 100).toFixed(1)}%に低下しました`,
          {
            previousValue: prevSnapshot.impressionShare,
            currentValue: impressionShare,
            threshold: 0.05,
            affectedCampaigns: [campaign.id],
          },
        );
        alertsGenerated++;
      }

      // CPC increase > 10%
      if (prevSnapshot.avgCpc && avgCpc > 0) {
        const cpcIncrease =
          (avgCpc - prevSnapshot.avgCpc) / prevSnapshot.avgCpc;
        if (cpcIncrease > 0.1) {
          await createAlertInternal(
            organizationId,
            'bid_war',
            'medium',
            `${campaign.name}: CPC上昇を検知`,
            `キャンペーン「${campaign.name}」のCPCが${(cpcIncrease * 100).toFixed(1)}%上昇しました。競合の入札強化の可能性があります`,
            {
              previousValue: prevSnapshot.avgCpc,
              currentValue: avgCpc,
              threshold: 0.1,
              affectedCampaigns: [campaign.id],
            },
          );
          alertsGenerated++;
        }
      }
    }
  }

  return { snapshotsCreated, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Data Collection: Competitor Creatives
// ---------------------------------------------------------------------------

export async function collectCompetitorCreatives(
  organizationId: string,
): Promise<CollectionResult> {
  const activeCompetitors = await db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.organizationId, organizationId),
        eq(competitorProfiles.active, true),
      ),
    );

  let snapshotsCreated = 0;
  let alertsGenerated = 0;

  for (const competitor of activeCompetitors) {
    if (!competitor.metaPageIds || competitor.metaPageIds.length === 0) {
      continue;
    }

    try {
      const records = await callMetaAdLibrary({
        searchPageIds: competitor.metaPageIds.join(','),
        adReachedCountries: 'JP',
        adType: 'ALL',
        limit: 50,
      });

      // Count existing creatives for surge detection
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
      const existingCreatives = await db
        .select()
        .from(competitorCreatives)
        .where(
          and(
            eq(competitorCreatives.competitorId, competitor.id),
            gte(competitorCreatives.firstSeenAt, sevenDaysAgo),
          ),
        );

      const avgWeeklyCount = existingCreatives.length || 1;

      const { inserted, activeUpdates, inactiveUpdates } =
        await upsertCompetitorRecords(
          organizationId,
          competitor.id,
          records,
        );
      const newCreativeCount = inserted;
      snapshotsCreated += inserted;
      void activeUpdates;
      void inactiveUpdates;

      // Detect creative surge (>3x normal weekly volume)
      if (newCreativeCount > avgWeeklyCount * 3 && newCreativeCount > 3) {
        await createAlertInternal(
          organizationId,
          'creative_surge',
          'high',
          `${competitor.name}: クリエイティブ急増を検知`,
          `${competitor.name}が直近で${newCreativeCount}件の新しいクリエイティブを投入しました（通常の${(newCreativeCount / avgWeeklyCount).toFixed(1)}倍）`,
          {
            competitorName: competitor.name,
            competitorDomain: competitor.domain,
            details: {
              newCount: newCreativeCount,
              normalAverage: avgWeeklyCount,
            },
          },
        );
        alertsGenerated++;
      }

      // Detect competitor pause (all creatives inactive)
      const activeCreativesCount = records.filter(
        (r) => !r.ad_delivery_stop_time,
      ).length;
      if (records.length > 0 && activeCreativesCount === 0) {
        await createAlertInternal(
          organizationId,
          'competitor_pause',
          'medium',
          `${competitor.name}: 全広告停止を検知`,
          `${competitor.name}のMeta広告がすべて停止されています。市場シェア獲得のチャンスです`,
          {
            competitorName: competitor.name,
            competitorDomain: competitor.domain,
          },
        );
        alertsGenerated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // Log but don't fail the entire collection
      process.stderr.write(
        `[competitor-monitor] Meta Ad Library fetch failed for ${competitor.name}: ${message}\n`,
      );
    }
  }

  return { snapshotsCreated, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Batched upsert helper for competitor creatives
// ---------------------------------------------------------------------------

interface UpsertResult {
  inserted: number;
  activeUpdates: number;
  inactiveUpdates: number;
}

async function fetchExistingCreativeIds(
  competitorId: string,
  externalIds: string[],
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: competitorCreatives.id,
      externalAdId: competitorCreatives.externalAdId,
    })
    .from(competitorCreatives)
    .where(
      and(
        eq(competitorCreatives.competitorId, competitorId),
        inArray(competitorCreatives.externalAdId, externalIds),
      ),
    );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.externalAdId) map.set(row.externalAdId, row.id);
  }
  return map;
}

function buildInsertRow(
  organizationId: string,
  competitorId: string,
  record: MetaAdRecord,
): typeof competitorCreatives.$inferInsert {
  const titles = record.ad_creative_link_titles ?? [];
  const bodies = record.ad_creative_bodies ?? [];
  return {
    organizationId,
    competitorId,
    platform: 'meta',
    externalAdId: record.id,
    headline: titles[0] ?? null,
    bodyText: bodies[0] ?? null,
    startDate: record.ad_delivery_start_time ?? null,
    isActive: !record.ad_delivery_stop_time,
    estimatedSpend: record.spend
      ? `${record.spend.lower_bound}-${record.spend.upper_bound}`
      : null,
  };
}

async function applyBulkUpdate(ids: string[], isActive: boolean): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(competitorCreatives)
    .set({ lastSeenAt: sql`now()`, isActive })
    .where(inArray(competitorCreatives.id, ids));
}

/**
 * Replaces a per-record findFirst + insert/update loop (2N round-trips)
 * with: 1 pre-fetch + 1 bulk insert + up to 2 bulk updates (≤ 4 queries).
 * Update buckets differ only by `isActive`, collapsing N per-row updates
 * into one UPDATE per bucket via `inArray`.
 */
async function upsertCompetitorRecords(
  organizationId: string,
  competitorId: string,
  records: MetaAdRecord[],
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { inserted: 0, activeUpdates: 0, inactiveUpdates: 0 };
  }

  const existing = await fetchExistingCreativeIds(
    competitorId,
    records.map((r) => r.id),
  );

  const toInsert: (typeof competitorCreatives.$inferInsert)[] = [];
  const activeIds: string[] = [];
  const inactiveIds: string[] = [];

  for (const record of records) {
    const existingId = existing.get(record.id);
    if (existingId) {
      (record.ad_delivery_stop_time ? inactiveIds : activeIds).push(existingId);
    } else {
      toInsert.push(buildInsertRow(organizationId, competitorId, record));
    }
  }

  if (toInsert.length > 0) {
    await db.insert(competitorCreatives).values(toInsert);
  }
  await applyBulkUpdate(activeIds, true);
  await applyBulkUpdate(inactiveIds, false);

  return {
    inserted: toInsert.length,
    activeUpdates: activeIds.length,
    inactiveUpdates: inactiveIds.length,
  };
}

// ---------------------------------------------------------------------------
// Market Shift Detection
// ---------------------------------------------------------------------------

export async function detectMarketShifts(
  organizationId: string,
): Promise<CollectionResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Compare recent 7-day averages against prior 7-day averages
  const recentSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, sevenDaysAgo),
      ),
    );

  const olderSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, fourteenDaysAgo),
        lte(auctionInsightSnapshots.snapshotDate, sevenDaysAgo),
      ),
    );

  let alertsGenerated = 0;

  if (recentSnapshots.length > 0 && olderSnapshots.length > 0) {
    const recentAvgCpc = computeAvg(
      recentSnapshots.map((s) => s.avgCpc).filter(isNotNull),
    );
    const olderAvgCpc = computeAvg(
      olderSnapshots.map((s) => s.avgCpc).filter(isNotNull),
    );

    const recentAvgIS = computeAvg(
      recentSnapshots.map((s) => s.impressionShare),
    );
    const olderAvgIS = computeAvg(
      olderSnapshots.map((s) => s.impressionShare),
    );

    // CPC trending up significantly (>15% week-over-week)
    if (olderAvgCpc > 0 && (recentAvgCpc - olderAvgCpc) / olderAvgCpc > 0.15) {
      await createAlertInternal(
        organizationId,
        'market_shift',
        'medium',
        '市場全体のCPC上昇傾向',
        `過去7日間の平均CPCが前週比${(((recentAvgCpc - olderAvgCpc) / olderAvgCpc) * 100).toFixed(1)}%上昇しています。競合環境の変化が考えられます`,
        {
          previousValue: olderAvgCpc,
          currentValue: recentAvgCpc,
          details: { metric: 'cpc', period: '7d' },
        },
      );
      alertsGenerated++;
    }

    // Impression share declining (>5% week-over-week)
    if (olderAvgIS > 0 && olderAvgIS - recentAvgIS > 0.05) {
      await createAlertInternal(
        organizationId,
        'market_shift',
        'high',
        '市場全体のインプレッションシェア低下',
        `過去7日間の平均インプレッションシェアが${(olderAvgIS * 100).toFixed(1)}%から${(recentAvgIS * 100).toFixed(1)}%に低下しています`,
        {
          previousValue: olderAvgIS,
          currentValue: recentAvgIS,
          details: { metric: 'impression_share', period: '7d' },
        },
      );
      alertsGenerated++;
    }
  }

  return { snapshotsCreated: 0, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Alert Management
// ---------------------------------------------------------------------------

async function createAlertInternal(
  organizationId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  data: AlertData,
  competitorId?: string,
): Promise<CompetitorAlertSelect> {
  const [alert] = await db
    .insert(competitorAlerts)
    .values({
      organizationId,
      competitorId: competitorId ?? null,
      alertType,
      severity,
      title,
      description,
      data,
    })
    .returning();

  if (!alert) {
    throw new CompetitorMonitorError('Failed to create alert');
  }

  // Send dashboard notification
  const notificationTypeMap: Record<AlertSeverity, 'alert' | 'warning' | 'info'> = {
    critical: 'alert',
    high: 'warning',
    medium: 'info',
    low: 'info',
  };

  await createNotification({
    organizationId,
    type: notificationTypeMap[severity],
    title: `[競合] ${title}`,
    message: description.slice(0, 300),
    source: 'competitive_monitor',
    metadata: {
      alertId: alert.id,
      alertType,
      severity,
    },
  });

  return alert;
}

export async function createAlert(
  organizationId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  data: AlertData,
  competitorId?: string,
): Promise<CompetitorAlertSelect> {
  return createAlertInternal(
    organizationId,
    alertType,
    severity,
    title,
    description,
    data,
    competitorId,
  );
}

export async function listAlerts(
  organizationId: string,
  filters?: ListAlertsFilter,
): Promise<CompetitorAlertSelect[]> {
  const conditions = [eq(competitorAlerts.organizationId, organizationId)];

  if (filters?.acknowledged !== undefined) {
    conditions.push(eq(competitorAlerts.acknowledged, filters.acknowledged));
  }
  if (filters?.alertType) {
    conditions.push(eq(competitorAlerts.alertType, filters.alertType));
  }
  if (filters?.severity) {
    conditions.push(eq(competitorAlerts.severity, filters.severity));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return db
    .select()
    .from(competitorAlerts)
    .where(and(...conditions))
    .orderBy(desc(competitorAlerts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function acknowledgeAlert(
  alertId: string,
  organizationId: string,
): Promise<CompetitorAlertSelect> {
  const [updated] = await db
    .update(competitorAlerts)
    .set({ acknowledged: true })
    .where(
      and(
        eq(competitorAlerts.id, alertId),
        eq(competitorAlerts.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new CompetitorMonitorError(`Alert not found: ${alertId}`);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Meta Ad Library Client (reused from competitive.service.ts pattern)
// ---------------------------------------------------------------------------

function isMetaAdLibraryResponse(
  value: unknown,
): value is MetaAdLibraryResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v['data']);
}

async function callMetaAdLibrary(
  params: MetaAdLibraryParams,
): Promise<MetaAdRecord[]> {
  const accessToken = process.env['META_AD_LIBRARY_TOKEN'];
  if (!accessToken) {
    throw new CompetitorMonitorError('META_AD_LIBRARY_TOKEN not configured');
  }

  const searchParams = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: `["${params.adReachedCountries}"]`,
    ad_type: params.adType,
    limit: String(params.limit),
    fields: [
      'id',
      'ad_creation_time',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'page_name',
      'ad_creative_bodies',
      'ad_creative_link_titles',
      'spend',
      'impressions',
      'currency',
    ].join(','),
  });

  if (params.searchTerms) {
    searchParams.set('search_terms', params.searchTerms);
  }
  if (params.searchPageIds) {
    searchParams.set('search_page_ids', params.searchPageIds);
  }

  const url = `https://graph.facebook.com/v19.0/ads_archive?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'user-agent': 'OMNI-AD-CompetitorMonitor/1.0' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new CompetitorMonitorError(
      `Meta Ad Library API error ${response.status}: ${text}`,
    );
  }

  const body: unknown = await response.json();
  if (!isMetaAdLibraryResponse(body)) {
    throw new CompetitorMonitorError(
      'Unexpected response shape from Meta Ad Library API',
    );
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// Utility Helpers
// ---------------------------------------------------------------------------

function computeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
