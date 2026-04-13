import { db } from '@omni-ad/db';
import {
  campaigns,
  campaignPlatformDeployments,
  platformConnections,
} from '@omni-ad/db/schema';
import { syncCampaignJobSchema, type SyncCampaignJob } from '@omni-ad/queue';
import { decryptToken, encryptToken, isTokenExpiringSoon } from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import { Platform as PlatformEnum } from '@omni-ad/shared';

const P2E: Record<string, PlatformEnum> = { meta: PlatformEnum.META, google: PlatformEnum.GOOGLE, x: PlatformEnum.X, tiktok: PlatformEnum.TIKTOK, line_yahoo: PlatformEnum.LINE_YAHOO, amazon: PlatformEnum.AMAZON, microsoft: PlatformEnum.MICROSOFT };
import type { PlatformAdapter } from '@omni-ad/platform-adapters';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;

// ---------------------------------------------------------------------------
// Token helpers
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

export async function processAdSync(job: { name: string; data: unknown }): Promise<void> {
  const parsed = syncCampaignJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: SyncCampaignJob = parsed.data;

  if (data.direction === 'push') {
    await handlePush(data);
  } else {
    await handlePull(data);
  }
}

// ---------------------------------------------------------------------------
// Push: deploy or update campaigns to platforms
// ---------------------------------------------------------------------------

async function handlePush(data: SyncCampaignJob): Promise<void> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, data.platformConnectionId),
      eq(platformConnections.organizationId, data.organizationId),
    ),
  });

  if (!connection) {
    throw new Error(`Connection not found: ${data.platformConnectionId}`);
  }

  const adapter = adapterRegistry.get(P2E[data.platform] ?? PlatformEnum.META);
  const accessToken = await ensureValidToken(connection, adapter);

  // Find pending deployments for this platform, scoped to this org
  const pendingDeployments = await db
    .select({
      id: campaignPlatformDeployments.id,
      externalCampaignId: campaignPlatformDeployments.externalCampaignId,
      platformBudget: campaignPlatformDeployments.platformBudget,
      campaignName: campaigns.name,
      campaignObjective: campaigns.objective,
      campaignStartDate: campaigns.startDate,
      campaignEndDate: campaigns.endDate,
      campaignTotalBudget: campaigns.totalBudget,
    })
    .from(campaignPlatformDeployments)
    .innerJoin(
      campaigns,
      eq(campaignPlatformDeployments.campaignId, campaigns.id),
    )
    .where(
      and(
        eq(campaigns.organizationId, data.organizationId),
        eq(campaignPlatformDeployments.platform, data.platform),
        eq(campaignPlatformDeployments.platformStatus, 'pending'),
      ),
    );

  for (const deployment of pendingDeployments) {
    try {
      if (!deployment.externalCampaignId) {
        const result = await adapter.createCampaign(
          connection.platformAccountId,
          {
            name: deployment.campaignName,
            objective: deployment.campaignObjective,
            startDate: new Date(deployment.campaignStartDate),
            endDate: deployment.campaignEndDate
              ? new Date(deployment.campaignEndDate)
              : undefined,
            totalBudget: Number(deployment.campaignTotalBudget),
            dailyBudget: Number(deployment.platformBudget),
          },
          accessToken,
        );

        await db
          .update(campaignPlatformDeployments)
          .set({
            externalCampaignId: result.id,
            platformStatus: 'active',
            lastSyncAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(campaignPlatformDeployments.id, deployment.id));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[ad-sync] Push failed for deployment ${deployment.id}: ${message}`,
      );
      await db
        .update(campaignPlatformDeployments)
        .set({ platformStatus: 'error', updatedAt: sql`now()` })
        .where(eq(campaignPlatformDeployments.id, deployment.id));
    }
  }

  // Handle pausing, scoped to this org
  const pausingDeployments = await db
    .select({
      id: campaignPlatformDeployments.id,
      externalCampaignId: campaignPlatformDeployments.externalCampaignId,
    })
    .from(campaignPlatformDeployments)
    .innerJoin(
      campaigns,
      eq(campaignPlatformDeployments.campaignId, campaigns.id),
    )
    .where(
      and(
        eq(campaigns.organizationId, data.organizationId),
        eq(campaignPlatformDeployments.platform, data.platform),
        eq(campaignPlatformDeployments.platformStatus, 'paused'),
      ),
    );

  for (const deployment of pausingDeployments) {
    if (!deployment.externalCampaignId) continue;
    try {
      await adapter.pauseCampaign(
        connection.platformAccountId,
        deployment.externalCampaignId,
        accessToken,
      );
      await db
        .update(campaignPlatformDeployments)
        .set({ lastSyncAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(campaignPlatformDeployments.id, deployment.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[ad-sync] Pause failed for deployment ${deployment.id}: ${message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pull: sync status back from platforms
// ---------------------------------------------------------------------------

async function handlePull(data: SyncCampaignJob): Promise<void> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, data.platformConnectionId),
      eq(platformConnections.organizationId, data.organizationId),
    ),
  });

  if (!connection) {
    throw new Error(`Connection not found: ${data.platformConnectionId}`);
  }

  const adapter = adapterRegistry.get(P2E[data.platform] ?? PlatformEnum.META);
  const accessToken = await ensureValidToken(connection, adapter);

  // Find all deployments with external IDs for this platform, scoped to this org
  const deployments = await db
    .select({
      id: campaignPlatformDeployments.id,
      campaignId: campaignPlatformDeployments.campaignId,
      platform: campaignPlatformDeployments.platform,
      externalCampaignId: campaignPlatformDeployments.externalCampaignId,
      platformStatus: campaignPlatformDeployments.platformStatus,
      platformBudget: campaignPlatformDeployments.platformBudget,
      lastSyncAt: campaignPlatformDeployments.lastSyncAt,
      platformSpecificConfig: campaignPlatformDeployments.platformSpecificConfig,
      createdAt: campaignPlatformDeployments.createdAt,
      updatedAt: campaignPlatformDeployments.updatedAt,
    })
    .from(campaignPlatformDeployments)
    .innerJoin(campaigns, eq(campaignPlatformDeployments.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, data.organizationId),
        eq(campaignPlatformDeployments.platform, data.platform),
      ),
    );

  const deployed = deployments.filter((d) => d.externalCampaignId !== null);

  for (const deployment of deployed) {
    try {
      const remote = await adapter.getCampaign(
        connection.platformAccountId,
        deployment.externalCampaignId!,
        accessToken,
      );

      const mappedStatus = mapNormalizedStatus(remote.status);

      await db
        .update(campaignPlatformDeployments)
        .set({
          platformStatus: mappedStatus,
          lastSyncAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(campaignPlatformDeployments.id, deployment.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[ad-sync] Pull sync failed for deployment ${deployment.id}: ${message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapNormalizedStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'active',
    paused: 'paused',
    completed: 'completed',
    draft: 'pending',
    error: 'error',
    removed: 'completed',
    archived: 'completed',
  };
  return map[status.toLowerCase()] ?? 'unknown';
}
