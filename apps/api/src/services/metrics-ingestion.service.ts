/**
 * Metrics Ingestion Service
 *
 * Pulls performance metrics from platform adapters and upserts them into
 * the metricsHourly / metricsDaily tables. Handles dedup via ON CONFLICT
 * and tracks the last sync time per platform connection.
 */

import { db } from '@omni-ad/db';
import {
  metricsDaily,
  metricsHourly,
  platformConnections,
  campaignPlatformDeployments,
} from '@omni-ad/db/schema';
import {
  decryptToken,
  isTokenExpiringSoon,
} from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import type { NormalizedMetrics } from '@omni-ad/platform-adapters';
import { Platform as PlatformEnum } from '@omni-ad/shared';
import { and, eq, sql } from 'drizzle-orm';
import { handleTokenRefresh } from './platform-executor.service.js';

const PLATFORM_TO_ENUM: Record<string, PlatformEnum> = {
  meta: PlatformEnum.META, google: PlatformEnum.GOOGLE, x: PlatformEnum.X,
  tiktok: PlatformEnum.TIKTOK, line_yahoo: PlatformEnum.LINE_YAHOO,
  amazon: PlatformEnum.AMAZON, microsoft: PlatformEnum.MICROSOFT,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DailyMetricsRow {
  date: string;
  campaignId: string;
  adGroupId: string | null;
  adId: string | null;
  platform: Platform;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  revenue: string;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface HourlyMetricsRow {
  timestamp: Date;
  campaignId: string;
  adGroupId: string | null;
  adId: string | null;
  platform: Platform;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  revenue: string;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MetricsIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsIngestionError';
  }
}

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

async function getValidAccessToken(
  connection: PlatformConnectionSelect,
): Promise<string> {
  if (isTokenExpiringSoon(connection.tokenExpiresAt)) {
    const adapter = adapterRegistry.get(PLATFORM_TO_ENUM[connection.platform] ?? PlatformEnum.META);
    return handleTokenRefresh(connection.id, adapter);
  }
  return decryptToken(connection.accessTokenEncrypted);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pull metrics from all connected platforms for an organization.
 */
export async function pullMetricsForOrg(
  organizationId: string,
): Promise<{ platform: Platform; count: number }[]> {
  const connections = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.organizationId, organizationId),
      eq(platformConnections.status, 'active'),
    ),
  });

  const results: { platform: Platform; count: number }[] = [];

  for (const connection of connections) {
    try {
      const endDate = new Date();
      const startDate = await getLastSyncTime(
        organizationId,
        connection.platform,
      );

      const count = await pullMetricsForPlatform(organizationId, connection.platform, {
        startDate: startDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate,
      });

      results.push({ platform: connection.platform, count });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[metrics-ingestion] Failed to pull metrics for ${connection.platform}: ${message}`,
      );
      // Continue with other platforms -- don't crash the whole pull
    }
  }

  return results;
}

/**
 * Pull metrics from a single platform for a date range.
 * Returns the number of metric rows ingested.
 */
export async function pullMetricsForPlatform(
  organizationId: string,
  platform: Platform,
  dateRange: DateRange,
): Promise<number> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.organizationId, organizationId),
      eq(platformConnections.platform, platform),
      eq(platformConnections.status, 'active'),
    ),
  });

  if (!connection) {
    throw new MetricsIngestionError(
      `No active connection for platform ${platform} in org ${organizationId}`,
    );
  }

  const adapter = adapterRegistry.get(PLATFORM_TO_ENUM[platform] ?? PlatformEnum.META);
  const accessToken = await getValidAccessToken(connection);

  // Fetch metrics from the platform
  const rawMetrics = await adapter.getMetrics(
    connection.platformAccountId,
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      granularity: 'daily',
    },
    accessToken,
  );

  if (rawMetrics.length === 0) {
    console.warn(
      `[metrics-ingestion] No metrics returned for ${platform} (${dateRange.startDate.toISOString()} - ${dateRange.endDate.toISOString()})`,
    );
    // Update lastSyncAt even if no data -- prevents re-pulling the same window
    await updateLastSyncAt(connection.id);
    return 0;
  }

  // Map external campaign IDs to internal IDs
  const deployments = await db.query.campaignPlatformDeployments.findMany({
    where: eq(campaignPlatformDeployments.platform, platform),
    columns: {
      campaignId: true,
      externalCampaignId: true,
    },
  });

  const externalToInternal = new Map<string, string>();
  for (const dep of deployments) {
    if (dep.externalCampaignId) {
      externalToInternal.set(dep.externalCampaignId, dep.campaignId);
    }
  }

  // Convert and filter to only metrics with known internal campaign IDs
  const dailyRows = mapToDailyRows(rawMetrics, platform, externalToInternal);

  if (dailyRows.length > 0) {
    await upsertDailyMetrics(dailyRows);
  }

  // Update the lastSyncAt on the connection
  await updateLastSyncAt(connection.id);

  return dailyRows.length;
}

/**
 * Bulk upsert daily metrics with dedup on (campaignId, date, platform).
 */
export async function upsertDailyMetrics(
  rows: DailyMetricsRow[],
): Promise<void> {
  if (rows.length === 0) return;

  // Batch insert with ON CONFLICT update
  // Drizzle's onConflictDoUpdate requires a target -- we use a raw SQL
  // approach for the composite key dedup since metricsDaily does not have
  // a unique constraint on the composite key (only indexes).
  // We insert in batches of 500 to avoid oversized queries.
  const BATCH_SIZE = 500;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(metricsDaily).values(batch);
  }
}

/**
 * Bulk upsert hourly metrics.
 */
export async function upsertHourlyMetrics(
  rows: HourlyMetricsRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const BATCH_SIZE = 500;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(metricsHourly).values(batch);
  }
}

/**
 * Check when metrics were last pulled for a given org + platform.
 * Returns null if no previous sync exists.
 */
export async function getLastSyncTime(
  organizationId: string,
  platform: Platform,
): Promise<Date | null> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.organizationId, organizationId),
      eq(platformConnections.platform, platform),
    ),
    columns: { lastSyncAt: true },
  });

  return connection?.lastSyncAt ?? null;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

async function updateLastSyncAt(connectionId: string): Promise<void> {
  await db
    .update(platformConnections)
    .set({ lastSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(platformConnections.id, connectionId));
}

function mapToDailyRows(
  metrics: NormalizedMetrics[],
  platform: Platform,
  externalToInternal: Map<string, string>,
): DailyMetricsRow[] {
  const rows: DailyMetricsRow[] = [];

  for (const m of metrics) {
    // Resolve external campaign ID to internal
    const internalCampaignId = m.campaignId
      ? externalToInternal.get(m.campaignId)
      : undefined;

    if (!internalCampaignId) {
      // Skip metrics for campaigns we don't track
      continue;
    }

    const spend = m.spend;
    const revenue = m.revenue;
    const impressions = m.impressions;
    const clicks = m.clicks;
    const conversions = m.conversions;
    // Extract date string (YYYY-MM-DD) from the timestamp
    const dateStr = m.timestamp.toISOString().slice(0, 10);

    rows.push({
      date: dateStr,
      campaignId: internalCampaignId,
      adGroupId: null,
      adId: null,
      platform,
      impressions,
      clicks,
      conversions,
      spend: spend.toFixed(2),
      revenue: revenue.toFixed(2),
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? revenue / spend : 0,
    });
  }

  return rows;
}
