import { db } from '@omni-ad/db';
import { platformConnections } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { SyncCampaignJob } from '@omni-ad/queue';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import { DB_PLATFORM_TO_ENUM } from '@omni-ad/shared';
import { and, eq, sql } from 'drizzle-orm';

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

export interface ConnectionStatusResult {
  connection: PlatformConnectionSelect;
  isTokenValid: boolean;
}

export async function listConnections(
  organizationId: string,
): Promise<PlatformConnectionSelect[]> {
  return db.query.platformConnections.findMany({
    where: eq(platformConnections.organizationId, organizationId),
  });
}

export async function connectPlatform(
  platform: Platform,
  organizationId: string,
  _redirectUrl: string,
): Promise<{ oauthUrl: string }> {
  const adapterPlatform = DB_PLATFORM_TO_ENUM[platform];
  if (!adapterPlatform || !adapterRegistry.has(adapterPlatform)) {
    throw new PlatformNotConfiguredError(platform);
  }

  const adapter = adapterRegistry.get(adapterPlatform);
  const redirectUri = `${process.env['OAUTH_REDIRECT_BASE_URL'] ?? 'http://localhost:3001'}/auth/callback`;
  const state = `${organizationId}:${platform}`;
  const oauthUrl = adapter.getAuthUrl(redirectUri, state);

  return { oauthUrl };
}

export async function disconnectPlatform(
  connectionId: string,
  organizationId: string,
): Promise<PlatformConnectionSelect> {
  const [updated] = await db
    .update(platformConnections)
    .set({
      status: 'revoked',
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(platformConnections.id, connectionId),
        eq(platformConnections.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  return updated;
}

export async function getConnectionStatus(
  connectionId: string,
  organizationId: string,
): Promise<ConnectionStatusResult> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.organizationId, organizationId),
    ),
  });

  if (!connection) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  const isTokenValid =
    connection.status === 'active' &&
    connection.tokenExpiresAt > new Date();

  return { connection, isTokenValid };
}

export async function syncNow(
  connectionId: string,
  organizationId: string,
): Promise<{ jobId: string }> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.organizationId, organizationId),
    ),
  });

  if (!connection) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  const queue = getQueue(QUEUE_NAMES.AD_SYNC);
  const jobData: SyncCampaignJob = {
    organizationId,
    platformConnectionId: connectionId,
    platform: connection.platform,
    direction: 'pull',
  };

  const job = await queue.add(
    `sync-${connectionId}-${Date.now()}`,
    jobData,
  );

  // Update last sync timestamp
  await db
    .update(platformConnections)
    .set({ lastSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(platformConnections.id, connectionId));

  return { jobId: job.id ?? connectionId };
}

export async function onConnectionActivated(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  // Lazy import to avoid circular dependency
  const { analyzeAccount } = await import('./account-analyzer.service.js');

  try {
    await analyzeAccount(organizationId, connectionId);
  } catch (err: unknown) {
    // Analysis failure should not break the connection flow.
    // Log and continue -- the user can trigger re-analysis from the UI.
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[platform.service] Auto-analysis failed for connection ${connectionId}: ${message}`,
    );
  }
}

export class PlatformConnectionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`Platform connection not found: ${connectionId}`);
    this.name = 'PlatformConnectionNotFoundError';
  }
}

export class PlatformNotConfiguredError extends Error {
  constructor(platform: string) {
    super(`Platform "${platform}" is not configured. Check environment variables.`);
    this.name = 'PlatformNotConfiguredError';
  }
}

