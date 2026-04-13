import { db } from '@omni-ad/db';
import { platformConnections } from '@omni-ad/db/schema';
import { encryptToken, decryptToken, isTokenExpiringSoon } from '@omni-ad/auth';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import { DB_PLATFORM_TO_ENUM, PlatformErrorCode, isPlatformError } from '@omni-ad/shared';
import { eq, sql } from 'drizzle-orm';

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;

/**
 * Per-platform buffer minutes for proactive token refresh.
 *
 * - TikTok:     24h token → refresh when < 6h remaining
 * - Google:     1h access token → refresh when < 15min remaining
 * - Amazon:     1h access token → refresh when < 15min remaining
 * - Meta:       60-day long-lived token → refresh when < 7 days remaining
 * - LINE/Yahoo: standard OAuth → refresh when < 1h remaining
 * - X:          2h token → refresh when < 30min remaining
 * - Microsoft:  1h token → refresh when < 15min remaining
 */
function getRefreshBufferMinutes(platform: string): number {
  const buffers: Record<string, number> = {
    tiktok: 360,
    google: 15,
    amazon: 15,
    meta: 10080,
    line_yahoo: 60,
    x: 30,
    microsoft: 15,
  };
  return buffers[platform] ?? 30;
}

async function refreshConnection(
  connection: PlatformConnectionSelect,
): Promise<void> {
  const adapterPlatform = DB_PLATFORM_TO_ENUM[connection.platform];
  if (!adapterPlatform || !adapterRegistry.has(adapterPlatform)) {
    return;
  }

  const bufferMinutes = getRefreshBufferMinutes(connection.platform);
  if (!isTokenExpiringSoon(connection.tokenExpiresAt, bufferMinutes)) {
    return;
  }

  const adapter = adapterRegistry.get(adapterPlatform);

  try {
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

    console.log(
      `[token-refresh] Refreshed ${connection.platform} token for connection ${connection.id}`,
    );
  } catch (err: unknown) {
    // If auth is expired/revoked, mark the connection — user must re-authorize
    if (isPlatformError(err) && err.code === PlatformErrorCode.AUTH_EXPIRED) {
      await db
        .update(platformConnections)
        .set({ status: 'expired', updatedAt: sql`now()` })
        .where(eq(platformConnections.id, connection.id));

      console.warn(
        `[token-refresh] ${connection.platform} connection ${connection.id} expired — user must re-authorize`,
      );
      return;
    }

    // Network/server errors are transient — log and skip, next run retries
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[token-refresh] Failed to refresh ${connection.platform} connection ${connection.id}: ${message}`,
    );
  }
}

/**
 * Scans all active platform connections and refreshes tokens that
 * are approaching expiry. Scheduled to run every 30 minutes.
 */
export async function processTokenRefresh(): Promise<void> {
  const activeConnections = await db.query.platformConnections.findMany({
    where: eq(platformConnections.status, 'active'),
  });

  if (activeConnections.length === 0) {
    return;
  }

  console.log(
    `[token-refresh] Checking ${activeConnections.length} active connections`,
  );

  for (const connection of activeConnections) {
    await refreshConnection(connection);
  }
}
