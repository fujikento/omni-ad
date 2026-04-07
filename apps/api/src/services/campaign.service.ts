import { db } from '@omni-ad/db';
import {
  campaigns,
  campaignPlatformDeployments,
  platformConnections,
} from '@omni-ad/db/schema';
import type {
  CampaignTargetingConfig,
  CampaignKpiAlerts,
  BidStrategy,
} from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { SyncCampaignJob } from '@omni-ad/queue';
import { and, desc, eq, sql } from 'drizzle-orm';

// Types derived from Drizzle schema
type CampaignInsert = typeof campaigns.$inferInsert;
type CampaignSelect = typeof campaigns.$inferSelect;
type DeploymentSelect = typeof campaignPlatformDeployments.$inferSelect;

export interface CampaignWithDeployments extends CampaignSelect {
  platformDeployments: DeploymentSelect[];
}

interface CreateCampaignInput {
  name: string;
  objective: CampaignInsert['objective'];
  startDate: string;
  endDate?: string;
  totalBudget: string;
  dailyBudget: string;
  funnelId?: string;
  targetRoas?: number;
  targetCpa?: string;
  bidStrategy?: BidStrategy;
  landingPageUrl?: string;
  conversionEndpointId?: string;
  targetingConfig?: CampaignTargetingConfig;
  kpiAlerts?: CampaignKpiAlerts;
}

interface UpdateCampaignInput {
  name?: string;
  objective?: CampaignInsert['objective'];
  startDate?: string;
  endDate?: string | null;
  totalBudget?: string;
  dailyBudget?: string;
  status?: CampaignInsert['status'];
  funnelId?: string | null;
  targetRoas?: number | null;
  targetCpa?: string | null;
  bidStrategy?: BidStrategy | null;
  landingPageUrl?: string | null;
  conversionEndpointId?: string | null;
  targetingConfig?: CampaignTargetingConfig | null;
  kpiAlerts?: CampaignKpiAlerts | null;
}

type Platform = typeof campaignPlatformDeployments.$inferInsert['platform'];

export async function listCampaigns(
  organizationId: string,
): Promise<CampaignWithDeployments[]> {
  const result = await db.query.campaigns.findMany({
    where: eq(campaigns.organizationId, organizationId),
    orderBy: [desc(campaigns.createdAt)],
    with: {
      platformDeployments: true,
    },
  });

  return result;
}

export async function getCampaign(
  id: string,
  organizationId: string,
): Promise<CampaignWithDeployments | undefined> {
  const result = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, id),
      eq(campaigns.organizationId, organizationId),
    ),
    with: {
      platformDeployments: true,
    },
  });

  return result;
}

export async function createCampaign(
  input: CreateCampaignInput,
  organizationId: string,
  userId: string,
): Promise<CampaignWithDeployments> {
  const [inserted] = await db
    .insert(campaigns)
    .values({
      organizationId,
      name: input.name,
      objective: input.objective,
      status: 'draft',
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      totalBudget: input.totalBudget,
      dailyBudget: input.dailyBudget,
      funnelId: input.funnelId ?? null,
      targetRoas: input.targetRoas ?? null,
      targetCpa: input.targetCpa ?? null,
      bidStrategy: input.bidStrategy ?? null,
      landingPageUrl: input.landingPageUrl ?? null,
      conversionEndpointId: input.conversionEndpointId ?? null,
      targetingConfig: input.targetingConfig ?? null,
      kpiAlerts: input.kpiAlerts ?? null,
      createdBy: userId,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to insert campaign');
  }

  return { ...inserted, platformDeployments: [] };
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  organizationId: string,
): Promise<CampaignSelect> {
  // Build the update set dynamically to only include provided fields
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updateSet['name'] = input.name;
  if (input.objective !== undefined) updateSet['objective'] = input.objective;
  if (input.startDate !== undefined) updateSet['startDate'] = input.startDate;
  if (input.endDate !== undefined) updateSet['endDate'] = input.endDate;
  if (input.totalBudget !== undefined)
    updateSet['totalBudget'] = input.totalBudget;
  if (input.dailyBudget !== undefined)
    updateSet['dailyBudget'] = input.dailyBudget;
  if (input.status !== undefined) updateSet['status'] = input.status;
  if (input.funnelId !== undefined) updateSet['funnelId'] = input.funnelId;
  if (input.targetRoas !== undefined) updateSet['targetRoas'] = input.targetRoas;
  if (input.targetCpa !== undefined) updateSet['targetCpa'] = input.targetCpa;
  if (input.bidStrategy !== undefined) updateSet['bidStrategy'] = input.bidStrategy;
  if (input.landingPageUrl !== undefined)
    updateSet['landingPageUrl'] = input.landingPageUrl;
  if (input.conversionEndpointId !== undefined)
    updateSet['conversionEndpointId'] = input.conversionEndpointId;
  if (input.targetingConfig !== undefined)
    updateSet['targetingConfig'] = input.targetingConfig;
  if (input.kpiAlerts !== undefined)
    updateSet['kpiAlerts'] = input.kpiAlerts;

  const [updated] = await db
    .update(campaigns)
    .set(updateSet)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new CampaignNotFoundError(id);
  }

  return updated;
}

export async function deployCampaign(
  id: string,
  platforms: Platform[],
  organizationId: string,
): Promise<DeploymentSelect[]> {
  // Verify campaign exists and belongs to org
  const campaign = await getCampaign(id, organizationId);
  if (!campaign) {
    throw new CampaignNotFoundError(id);
  }

  // Calculate per-platform budget (equal split for now)
  const totalBudget = Number(campaign.totalBudget);
  const perPlatformBudget = (totalBudget / platforms.length).toFixed(2);

  // Insert deployment records in a transaction
  const deployments = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(campaignPlatformDeployments)
      .values(
        platforms.map((platform) => ({
          campaignId: id,
          platform,
          platformStatus: 'pending',
          platformBudget: perPlatformBudget,
        })),
      )
      .returning();

    // Update campaign status to active
    await tx
      .update(campaigns)
      .set({ status: 'active', updatedAt: sql`now()` })
      .where(eq(campaigns.id, id));

    return inserted;
  });

  // Enqueue ad-sync jobs for each platform (look up actual platformConnection)
  const adSyncQueue = getQueue(QUEUE_NAMES.AD_SYNC);
  await Promise.all(
    platforms.map(async (platform) => {
      const connection = await db.query.platformConnections.findFirst({
        where: and(
          eq(platformConnections.organizationId, organizationId),
          eq(platformConnections.platform, platform),
        ),
      });

      if (!connection) {
        console.warn(
          `[campaign.service] No platform connection for org=${organizationId} platform=${platform}, skipping sync`,
        );
        return;
      }

      const jobData: SyncCampaignJob = {
        organizationId,
        platformConnectionId: connection.id,
        platform,
        direction: 'push',
      };
      return adSyncQueue.add(
        `sync-campaign-${id}-${platform}`,
        jobData,
      );
    }),
  );

  return deployments;
}

export async function pauseCampaign(
  id: string,
  organizationId: string,
): Promise<CampaignSelect> {
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(campaigns)
      .set({ status: 'paused', updatedAt: sql`now()` })
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.organizationId, organizationId),
        ),
      )
      .returning();

    if (!updated) {
      throw new CampaignNotFoundError(id);
    }

    // Pause all platform deployments
    await tx
      .update(campaignPlatformDeployments)
      .set({ platformStatus: 'paused', updatedAt: sql`now()` })
      .where(eq(campaignPlatformDeployments.campaignId, id));

    return updated;
  });

  return result;
}

export async function resumeCampaign(
  id: string,
  organizationId: string,
): Promise<CampaignSelect> {
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(campaigns)
      .set({ status: 'active', updatedAt: sql`now()` })
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.organizationId, organizationId),
        ),
      )
      .returning();

    if (!updated) {
      throw new CampaignNotFoundError(id);
    }

    // Resume all platform deployments
    await tx
      .update(campaignPlatformDeployments)
      .set({ platformStatus: 'active', updatedAt: sql`now()` })
      .where(eq(campaignPlatformDeployments.campaignId, id));

    return updated;
  });

  return result;
}

export async function deleteCampaign(
  id: string,
  organizationId: string,
): Promise<CampaignSelect> {
  // Soft delete by setting status to 'completed'
  const [updated] = await db
    .update(campaigns)
    .set({ status: 'completed', updatedAt: sql`now()` })
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new CampaignNotFoundError(id);
  }

  return updated;
}

// Custom error class for campaign not found
export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`);
    this.name = 'CampaignNotFoundError';
  }
}
