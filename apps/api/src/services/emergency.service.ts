/**
 * Emergency Stop Service
 *
 * Provides one-click emergency stop for all campaigns across all platforms,
 * single campaign stop, resume from emergency, and emergency status checks.
 */

import { db } from '@omni-ad/db';
import {
  auditLog,
  campaigns,
  campaignPlatformDeployments,
} from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { SyncCampaignJob } from '@omni-ad/queue';
import { and, eq, sql } from 'drizzle-orm';
import { createNotification } from './notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CampaignSelect = typeof campaigns.$inferSelect;

export interface EmergencyStopResult {
  pausedCount: number;
  campaignIds: string[];
  timestamp: Date;
}

export interface EmergencyStatus {
  isActive: boolean;
  pausedCampaigns: number;
  lastStopAt: Date | null;
  lastStopReason: string | null;
  lastStopBy: string | null;
}

// ---------------------------------------------------------------------------
// Emergency Stop All
// ---------------------------------------------------------------------------

export async function emergencyStopAll(
  organizationId: string,
  userId: string,
  reason: string,
): Promise<EmergencyStopResult> {
  const now = new Date();

  // 1. Fetch all active campaigns for the org
  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      eq(campaigns.status, 'active'),
    ),
    with: {
      platformDeployments: true,
    },
  });

  if (activeCampaigns.length === 0) {
    return { pausedCount: 0, campaignIds: [], timestamp: now };
  }

  const campaignIds = activeCampaigns.map((c) => c.id);

  // 2-3. Pause all campaigns and their deployments in a transaction
  await db.transaction(async (tx) => {
    // Set all active campaigns to paused
    for (const campaign of activeCampaigns) {
      await tx
        .update(campaigns)
        .set({ status: 'paused', updatedAt: sql`now()` })
        .where(eq(campaigns.id, campaign.id));

      // Pause all platform deployments for this campaign
      await tx
        .update(campaignPlatformDeployments)
        .set({ platformStatus: 'paused', updatedAt: sql`now()` })
        .where(eq(campaignPlatformDeployments.campaignId, campaign.id));
    }
  });

  // 4. Enqueue platform sync jobs for each campaign
  const adSyncQueue = getQueue(QUEUE_NAMES.AD_SYNC);
  const syncPromises: Promise<unknown>[] = [];

  for (const campaign of activeCampaigns) {
    for (const deployment of campaign.platformDeployments) {
      const jobData: SyncCampaignJob = {
        organizationId,
        platformConnectionId: campaign.id,
        platform: deployment.platform,
        direction: 'push',
      };
      syncPromises.push(
        adSyncQueue.add(
          `emergency-stop-${campaign.id}-${deployment.platform}`,
          jobData,
        ),
      );
    }
  }

  await Promise.all(syncPromises);

  // 5. Create audit log entry
  await db.insert(auditLog).values({
    organizationId,
    userId,
    action: 'emergency_stop_all',
    entityType: 'campaign',
    entityId: null,
    oldValue: { campaignIds, status: 'active' },
    newValue: {
      campaignIds,
      status: 'paused',
      reason,
      pausedCount: campaignIds.length,
    },
  });

  // 6. Send critical notification
  await createNotification({
    organizationId,
    userId,
    type: 'alert',
    title: '緊急停止が実行されました',
    message: `${campaignIds.length}件のキャンペーンが緊急停止されました。理由: ${reason}`,
    source: 'emergency_stop',
    metadata: {
      campaignIds,
      reason,
      pausedCount: campaignIds.length,
    },
  });

  // 7. Return count of paused campaigns
  return {
    pausedCount: campaignIds.length,
    campaignIds,
    timestamp: now,
  };
}

// ---------------------------------------------------------------------------
// Emergency Stop Single Campaign
// ---------------------------------------------------------------------------

export async function emergencyStopCampaign(
  campaignId: string,
  organizationId: string,
  userId: string,
  reason: string,
): Promise<CampaignSelect> {
  // Verify campaign exists and belongs to org
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, organizationId),
    ),
    with: {
      platformDeployments: true,
    },
  });

  if (!campaign) {
    throw new EmergencyStopError(`Campaign not found: ${campaignId}`);
  }

  if (campaign.status !== 'active') {
    throw new EmergencyStopError(
      `Campaign ${campaignId} is not active (current status: ${campaign.status})`,
    );
  }

  // Pause campaign and deployments in a transaction
  const [updated] = await db.transaction(async (tx) => {
    const result = await tx
      .update(campaigns)
      .set({ status: 'paused', updatedAt: sql`now()` })
      .where(eq(campaigns.id, campaignId))
      .returning();

    await tx
      .update(campaignPlatformDeployments)
      .set({ platformStatus: 'paused', updatedAt: sql`now()` })
      .where(eq(campaignPlatformDeployments.campaignId, campaignId));

    return result;
  });

  if (!updated) {
    throw new EmergencyStopError(`Failed to pause campaign: ${campaignId}`);
  }

  // Enqueue sync jobs
  const adSyncQueue = getQueue(QUEUE_NAMES.AD_SYNC);
  for (const deployment of campaign.platformDeployments) {
    const jobData: SyncCampaignJob = {
      organizationId,
      platformConnectionId: campaignId,
      platform: deployment.platform,
      direction: 'push',
    };
    await adSyncQueue.add(
      `emergency-stop-${campaignId}-${deployment.platform}`,
      jobData,
    );
  }

  // Audit log
  await db.insert(auditLog).values({
    organizationId,
    userId,
    action: 'emergency_stop_campaign',
    entityType: 'campaign',
    entityId: campaignId,
    oldValue: { status: 'active' },
    newValue: { status: 'paused', reason },
  });

  // Notification
  await createNotification({
    organizationId,
    userId,
    type: 'alert',
    title: 'キャンペーンが緊急停止されました',
    message: `キャンペーン「${campaign.name}」が緊急停止されました。理由: ${reason}`,
    source: 'emergency_stop',
    metadata: { campaignId, campaignName: campaign.name, reason },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Emergency Resume
// ---------------------------------------------------------------------------

export async function emergencyResume(
  organizationId: string,
  userId: string,
): Promise<EmergencyStopResult> {
  const now = new Date();

  // Find campaigns that were paused by emergency stop (check audit log)
  const emergencyStopLogs = await db.query.auditLog.findMany({
    where: and(
      eq(auditLog.organizationId, organizationId),
      eq(auditLog.action, 'emergency_stop_all'),
    ),
    orderBy: (log, { desc }) => [desc(log.timestamp)],
    limit: 1,
  });

  // Get campaign IDs from the latest emergency stop
  let campaignIdsToResume: string[] = [];

  if (emergencyStopLogs.length > 0) {
    const latestStop = emergencyStopLogs[0]!;
    const newValue = latestStop.newValue as Record<string, unknown> | null;
    if (newValue && Array.isArray(newValue['campaignIds'])) {
      campaignIdsToResume = newValue['campaignIds'] as string[];
    }
  }

  // If no emergency stop log found, resume all paused campaigns
  if (campaignIdsToResume.length === 0) {
    const pausedCampaigns = await db.query.campaigns.findMany({
      where: and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.status, 'paused'),
      ),
    });
    campaignIdsToResume = pausedCampaigns.map((c) => c.id);
  }

  if (campaignIdsToResume.length === 0) {
    return { pausedCount: 0, campaignIds: [], timestamp: now };
  }

  // Resume campaigns
  await db.transaction(async (tx) => {
    for (const campaignId of campaignIdsToResume) {
      await tx
        .update(campaigns)
        .set({ status: 'active', updatedAt: sql`now()` })
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.organizationId, organizationId),
            eq(campaigns.status, 'paused'),
          ),
        );

      await tx
        .update(campaignPlatformDeployments)
        .set({ platformStatus: 'active', updatedAt: sql`now()` })
        .where(eq(campaignPlatformDeployments.campaignId, campaignId));
    }
  });

  // Enqueue sync jobs to push resume to platforms
  const adSyncQueue = getQueue(QUEUE_NAMES.AD_SYNC);
  for (const campaignId of campaignIdsToResume) {
    const deployments = await db.query.campaignPlatformDeployments.findMany({
      where: eq(campaignPlatformDeployments.campaignId, campaignId),
    });

    for (const deployment of deployments) {
      const jobData: SyncCampaignJob = {
        organizationId,
        platformConnectionId: campaignId,
        platform: deployment.platform,
        direction: 'push',
      };
      await adSyncQueue.add(
        `emergency-resume-${campaignId}-${deployment.platform}`,
        jobData,
      );
    }
  }

  // Audit log
  await db.insert(auditLog).values({
    organizationId,
    userId,
    action: 'emergency_resume',
    entityType: 'campaign',
    entityId: null,
    oldValue: {
      campaignIds: campaignIdsToResume,
      status: 'paused',
    },
    newValue: {
      campaignIds: campaignIdsToResume,
      status: 'active',
      resumedCount: campaignIdsToResume.length,
    },
  });

  // Notification
  await createNotification({
    organizationId,
    userId,
    type: 'info',
    title: '緊急停止が解除されました',
    message: `${campaignIdsToResume.length}件のキャンペーンが再開されました。`,
    source: 'emergency_resume',
    metadata: {
      campaignIds: campaignIdsToResume,
      resumedCount: campaignIdsToResume.length,
    },
  });

  return {
    pausedCount: campaignIdsToResume.length,
    campaignIds: campaignIdsToResume,
    timestamp: now,
  };
}

// ---------------------------------------------------------------------------
// Emergency Status
// ---------------------------------------------------------------------------

export async function getEmergencyStatus(
  organizationId: string,
): Promise<EmergencyStatus> {
  // Check for the most recent emergency stop log
  const latestStop = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.organizationId, organizationId),
      eq(auditLog.action, 'emergency_stop_all'),
    ),
    orderBy: (log, { desc }) => [desc(log.timestamp)],
  });

  // Check for the most recent resume after the latest stop
  const latestResume = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.organizationId, organizationId),
      eq(auditLog.action, 'emergency_resume'),
    ),
    orderBy: (log, { desc }) => [desc(log.timestamp)],
  });

  // If there was no emergency stop, or the latest resume is after the latest stop
  const isActive =
    latestStop !== undefined &&
    (latestResume === undefined ||
      latestStop.timestamp > latestResume.timestamp);

  // Count currently paused campaigns
  const [countResult] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.status, 'paused'),
      ),
    );

  const newValue = latestStop?.newValue as Record<string, unknown> | null;

  return {
    isActive,
    pausedCampaigns: countResult?.count ?? 0,
    lastStopAt: latestStop?.timestamp ?? null,
    lastStopReason:
      (newValue?.['reason'] as string | undefined) ?? null,
    lastStopBy: latestStop?.userId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class EmergencyStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmergencyStopError';
  }
}
