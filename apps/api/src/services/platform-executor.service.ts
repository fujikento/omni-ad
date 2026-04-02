/**
 * Platform Executor Service
 *
 * Bridges internal campaign operations and the platform adapters.
 * Handles token decryption, adapter dispatch, token refresh, and
 * deployment record updates.
 */

import { db } from '@omni-ad/db';
import {
  campaigns,
  campaignPlatformDeployments,
  platformConnections,
} from '@omni-ad/db/schema';
import {
  decryptToken,
  encryptToken,
  isTokenExpiringSoon,
} from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import type { PlatformAdapter, NormalizedCampaign } from '@omni-ad/platform-adapters';
import { Platform as PlatformEnum } from '@omni-ad/shared';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type DeploymentSelect = typeof campaignPlatformDeployments.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

interface DecryptedTokens {
  accessToken: string;
  refreshToken: string;
  connection: PlatformConnectionSelect;
}

interface PlatformActionBase {
  organizationId: string;
  deploymentId: string;
}

interface DeployAction {
  type: 'deploy';
  organizationId: string;
  campaignId: string;
  platform: Platform;
  deploymentId: string;
}

interface PauseAction extends PlatformActionBase {
  type: 'pause';
}

interface ResumeAction extends PlatformActionBase {
  type: 'resume';
}

interface UpdateBudgetAction extends PlatformActionBase {
  type: 'update_budget';
  newBudget: number;
}

interface SyncAction extends PlatformActionBase {
  type: 'sync';
}

type PlatformAction =
  | DeployAction
  | PauseAction
  | ResumeAction
  | UpdateBudgetAction
  | SyncAction;

// ---------------------------------------------------------------------------
// Platform string → enum mapper
// ---------------------------------------------------------------------------

const PLATFORM_STRING_TO_ENUM: Record<string, PlatformEnum> = {
  meta: PlatformEnum.META,
  google: PlatformEnum.GOOGLE,
  x: PlatformEnum.X,
  tiktok: PlatformEnum.TIKTOK,
  line_yahoo: PlatformEnum.LINE_YAHOO,
  amazon: PlatformEnum.AMAZON,
  microsoft: PlatformEnum.MICROSOFT,
};

function toPlatformEnum(platform: Platform): PlatformEnum {
  const mapped = PLATFORM_STRING_TO_ENUM[platform];
  if (!mapped) throw new Error(`Unknown platform: ${platform}`);
  return mapped;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PlatformExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformExecutorError';
  }
}

export class ConnectionNotFoundError extends PlatformExecutorError {
  constructor(detail: string) {
    super(`Platform connection not found: ${detail}`);
  }
}

export class DeploymentNotFoundError extends PlatformExecutorError {
  constructor(deploymentId: string) {
    super(`Deployment not found: ${deploymentId}`);
  }
}

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

export async function getDecryptedTokens(
  connectionId: string,
): Promise<DecryptedTokens> {
  const connection = await db.query.platformConnections.findFirst({
    where: eq(platformConnections.id, connectionId),
  });

  if (!connection) {
    throw new ConnectionNotFoundError(connectionId);
  }

  return {
    accessToken: decryptToken(connection.accessTokenEncrypted),
    refreshToken: decryptToken(connection.refreshTokenEncrypted),
    connection,
  };
}

export async function handleTokenRefresh(
  connectionId: string,
  adapter: PlatformAdapter,
): Promise<string> {
  const { refreshToken: currentRefresh, connection } =
    await getDecryptedTokens(connectionId);

  const newTokens = await adapter.refreshToken(currentRefresh);

  await db
    .update(platformConnections)
    .set({
      accessTokenEncrypted: encryptToken(newTokens.accessToken),
      refreshTokenEncrypted: encryptToken(newTokens.refreshToken),
      tokenExpiresAt: newTokens.expiresAt,
      status: 'active',
      updatedAt: sql`now()`,
    })
    .where(eq(platformConnections.id, connectionId));

  void connection;
  return newTokens.accessToken;
}

/**
 * Returns a valid access token, refreshing first if expiring soon.
 */
async function ensureValidToken(
  connectionId: string,
  adapter: PlatformAdapter,
): Promise<string> {
  const { accessToken, connection } = await getDecryptedTokens(connectionId);

  if (isTokenExpiringSoon(connection.tokenExpiresAt)) {
    return handleTokenRefresh(connectionId, adapter);
  }

  return accessToken;
}

// ---------------------------------------------------------------------------
// Connection Lookup
// ---------------------------------------------------------------------------

async function findConnection(
  organizationId: string,
  platform: Platform,
): Promise<PlatformConnectionSelect> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.organizationId, organizationId),
      eq(platformConnections.platform, platform),
      eq(platformConnections.status, 'active'),
    ),
  });

  if (!connection) {
    throw new ConnectionNotFoundError(
      `org=${organizationId}, platform=${platform}`,
    );
  }

  return connection;
}

async function findDeploymentWithConnection(
  organizationId: string,
  deploymentId: string,
): Promise<{
  deployment: DeploymentSelect;
  connection: PlatformConnectionSelect;
}> {
  const deployment = await db.query.campaignPlatformDeployments.findFirst({
    where: eq(campaignPlatformDeployments.id, deploymentId),
  });

  if (!deployment) {
    throw new DeploymentNotFoundError(deploymentId);
  }

  const connection = await findConnection(
    organizationId,
    deployment.platform,
  );

  return { deployment, connection };
}

// ---------------------------------------------------------------------------
// Core Executor
// ---------------------------------------------------------------------------

export async function executePlatformAction(
  action: PlatformAction,
): Promise<void> {
  switch (action.type) {
    case 'deploy':
      await deployToPlatform(
        action.organizationId,
        action.campaignId,
        action.platform,
        action.deploymentId,
      );
      break;
    case 'pause':
      await pauseOnPlatform(action.organizationId, action.deploymentId);
      break;
    case 'resume':
      await resumeOnPlatform(action.organizationId, action.deploymentId);
      break;
    case 'update_budget':
      await updateBudgetOnPlatform(
        action.organizationId,
        action.deploymentId,
        action.newBudget,
      );
      break;
    case 'sync':
      await syncCampaignFromPlatform(
        action.organizationId,
        action.deploymentId,
      );
      break;
  }
}

export async function deployToPlatform(
  organizationId: string,
  campaignId: string,
  platform: Platform,
  deploymentId: string,
): Promise<NormalizedCampaign> {
  const connection = await findConnection(organizationId, platform);
  const adapter = adapterRegistry.get(toPlatformEnum(platform));
  const accessToken = await ensureValidToken(connection.id, adapter);

  // Fetch our internal campaign data to build the adapter input
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.id, campaignId),
      eq(campaigns.organizationId, organizationId),
    ),
  });

  if (!campaign) {
    throw new PlatformExecutorError(`Campaign not found: ${campaignId}`);
  }

  const deployment = await db.query.campaignPlatformDeployments.findFirst({
    where: eq(campaignPlatformDeployments.id, deploymentId),
  });

  if (!deployment) {
    throw new DeploymentNotFoundError(deploymentId);
  }

  try {
    const result = await adapter.createCampaign(
      connection.platformAccountId,
      {
        name: campaign.name,
        objective: campaign.objective,
        startDate: new Date(campaign.startDate),
        endDate: campaign.endDate ? new Date(campaign.endDate) : undefined,
        totalBudget: Number(campaign.totalBudget),
        dailyBudget: Number(deployment.platformBudget),
      },
      accessToken,
    );

    // Update deployment with external ID and status
    await db
      .update(campaignPlatformDeployments)
      .set({
        externalCampaignId: result.id,
        platformStatus: 'active',
        lastSyncAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(campaignPlatformDeployments.id, deploymentId));

    return result;
  } catch (err: unknown) {
    // Mark deployment as errored
    await db
      .update(campaignPlatformDeployments)
      .set({
        platformStatus: 'error',
        updatedAt: sql`now()`,
      })
      .where(eq(campaignPlatformDeployments.id, deploymentId));

    const message = err instanceof Error ? err.message : String(err);
    throw new PlatformExecutorError(
      `Deploy failed for ${platform}: ${message}`,
    );
  }
}

export async function pauseOnPlatform(
  organizationId: string,
  deploymentId: string,
): Promise<void> {
  const { deployment, connection } = await findDeploymentWithConnection(
    organizationId,
    deploymentId,
  );

  if (!deployment.externalCampaignId) {
    throw new PlatformExecutorError(
      `Deployment ${deploymentId} has no external campaign ID -- cannot pause`,
    );
  }

  const adapter = adapterRegistry.get(toPlatformEnum(deployment.platform));
  const accessToken = await ensureValidToken(connection.id, adapter);

  await adapter.pauseCampaign(
    connection.platformAccountId,
    deployment.externalCampaignId,
    accessToken,
  );

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformStatus: 'paused',
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(campaignPlatformDeployments.id, deploymentId));
}

export async function resumeOnPlatform(
  organizationId: string,
  deploymentId: string,
): Promise<void> {
  const { deployment, connection } = await findDeploymentWithConnection(
    organizationId,
    deploymentId,
  );

  if (!deployment.externalCampaignId) {
    throw new PlatformExecutorError(
      `Deployment ${deploymentId} has no external campaign ID -- cannot resume`,
    );
  }

  const adapter = adapterRegistry.get(toPlatformEnum(deployment.platform));
  const accessToken = await ensureValidToken(connection.id, adapter);

  await adapter.resumeCampaign(
    connection.platformAccountId,
    deployment.externalCampaignId,
    accessToken,
  );

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformStatus: 'active',
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(campaignPlatformDeployments.id, deploymentId));
}

export async function updateBudgetOnPlatform(
  organizationId: string,
  deploymentId: string,
  newBudget: number,
): Promise<void> {
  const { deployment, connection } = await findDeploymentWithConnection(
    organizationId,
    deploymentId,
  );

  if (!deployment.externalCampaignId) {
    throw new PlatformExecutorError(
      `Deployment ${deploymentId} has no external campaign ID -- cannot update budget`,
    );
  }

  const adapter = adapterRegistry.get(toPlatformEnum(deployment.platform));
  const accessToken = await ensureValidToken(connection.id, adapter);

  await adapter.updateCampaign(
    connection.platformAccountId,
    deployment.externalCampaignId,
    { dailyBudget: newBudget },
    accessToken,
  );

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformBudget: newBudget.toFixed(2),
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(campaignPlatformDeployments.id, deploymentId));
}

export async function syncCampaignFromPlatform(
  organizationId: string,
  deploymentId: string,
): Promise<NormalizedCampaign | null> {
  const { deployment, connection } = await findDeploymentWithConnection(
    organizationId,
    deploymentId,
  );

  if (!deployment.externalCampaignId) {
    // Nothing to sync -- campaign not yet deployed
    return null;
  }

  const adapter = adapterRegistry.get(toPlatformEnum(deployment.platform));
  const accessToken = await ensureValidToken(connection.id, adapter);

  const remote = await adapter.getCampaign(
    connection.platformAccountId,
    deployment.externalCampaignId,
    accessToken,
  );

  // Map platform status back to our internal status
  const mappedStatus = mapNormalizedStatus(remote.status);

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformStatus: mappedStatus,
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(campaignPlatformDeployments.id, deploymentId));

  return remote;
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
