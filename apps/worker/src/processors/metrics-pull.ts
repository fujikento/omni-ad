import { db } from '@omni-ad/db';
import {
  campaigns,
  campaignPlatformDeployments,
  metricsDaily,
  platformConnections,
} from '@omni-ad/db/schema';
import { pullMetricsJobSchema, type PullMetricsJob } from '@omni-ad/queue';
import { decryptToken, encryptToken, isTokenExpiringSoon } from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import { Platform as PlatformEnum } from '@omni-ad/shared';

const P2E: Record<string, PlatformEnum> = { meta: PlatformEnum.META, google: PlatformEnum.GOOGLE, x: PlatformEnum.X, tiktok: PlatformEnum.TIKTOK, line_yahoo: PlatformEnum.LINE_YAHOO, amazon: PlatformEnum.AMAZON, microsoft: PlatformEnum.MICROSOFT };
import type { PlatformAdapter, NormalizedMetrics } from '@omni-ad/platform-adapters';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

async function ensureValidToken(
  connection: PlatformConnectionSelect,
  adapter: PlatformAdapter,
): Promise<string> {
  if (isTokenExpiringSoon(connection.tokenExpiresAt)) {
    const refreshToken = decryptToken(connection.refreshTokenEncrypted);
    const newTokens = await adapter.refreshToken(refreshToken);

    await db
      .update(platformConnections)
      .set({
        accessTokenEncrypted: encryptToken(newTokens.accessToken),
        refreshTokenEncrypted: encryptToken(newTokens.refreshToken),
        tokenExpiresAt: newTokens.expiresAt,
        status: 'active',
        updatedAt: sql`now()`,
      })
      .where(eq(platformConnections.id, connection.id));

    return newTokens.accessToken;
  }
  return decryptToken(connection.accessTokenEncrypted);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function processMetricsPull(job: { name: string; data: unknown }): Promise<void> {
  const parsed = pullMetricsJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: PullMetricsJob = parsed.data;

  // 1. Look up the platform connection
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.organizationId, data.organizationId),
      eq(platformConnections.platform, data.platform),
      eq(platformConnections.status, 'active'),
    ),
  });

  if (!connection) {
    console.warn(
      `[metrics-pull] No active connection for ${data.platform} in org ${data.organizationId}`,
    );
    return;
  }

  // 2. Get valid token
  const adapter = adapterRegistry.get(P2E[data.platform] ?? PlatformEnum.META);
  const accessToken = await ensureValidToken(connection, adapter);

  // 3. Fetch metrics from the platform
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  const rawMetrics = await adapter.getMetrics(
    connection.platformAccountId,
    {
      startDate,
      endDate,
      granularity: 'daily',
      campaignId: data.campaignId,
    },
    accessToken,
  );

  if (rawMetrics.length === 0) {
    console.warn(
      `[metrics-pull] No metrics returned for ${data.platform} (${data.startDate} - ${data.endDate})`,
    );
    await updateLastSyncAt(connection.id);
    return;
  }

  // 4. Map external campaign IDs to internal IDs (scoped to organization)
  const deployments = await db
    .select({
      campaignId: campaignPlatformDeployments.campaignId,
      externalCampaignId: campaignPlatformDeployments.externalCampaignId,
    })
    .from(campaignPlatformDeployments)
    .innerJoin(campaigns, eq(campaignPlatformDeployments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, data.organizationId),
        eq(campaignPlatformDeployments.platform, data.platform),
      ),
    );

  const externalToInternal = new Map<string, string>();
  for (const dep of deployments) {
    if (dep.externalCampaignId) {
      externalToInternal.set(dep.externalCampaignId, dep.campaignId);
    }
  }

  // 5. Build and upsert daily rows
  const rows = mapToDailyRows(rawMetrics, data.platform, externalToInternal);

  if (rows.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db
        .insert(metricsDaily)
        .values(batch)
        .onConflictDoUpdate({
          target: [metricsDaily.campaignId, metricsDaily.date, metricsDaily.platform],
          set: {
            impressions: sql`EXCLUDED.impressions`,
            clicks: sql`EXCLUDED.clicks`,
            conversions: sql`EXCLUDED.conversions`,
            spend: sql`EXCLUDED.spend`,
            revenue: sql`EXCLUDED.revenue`,
            ctr: sql`EXCLUDED.ctr`,
            cpc: sql`EXCLUDED.cpc`,
            cpa: sql`EXCLUDED.cpa`,
            roas: sql`EXCLUDED.roas`,
          },
        });
    }
  }

  // 6. Update lastSyncAt
  await updateLastSyncAt(connection.id);

  console.info(
    `[metrics-pull] Ingested ${rows.length} metrics rows from ${data.platform} for org ${data.organizationId}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateLastSyncAt(connectionId: string): Promise<void> {
  await db
    .update(platformConnections)
    .set({ lastSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(platformConnections.id, connectionId));
}

interface DailyRow {
  date: string;
  campaignId: string;
  adGroupId: null;
  adId: null;
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

function mapToDailyRows(
  metrics: NormalizedMetrics[],
  platform: Platform,
  externalToInternal: Map<string, string>,
): DailyRow[] {
  const rows: DailyRow[] = [];

  for (const m of metrics) {
    const internalCampaignId = m.campaignId
      ? externalToInternal.get(m.campaignId)
      : undefined;

    if (!internalCampaignId) continue;

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
