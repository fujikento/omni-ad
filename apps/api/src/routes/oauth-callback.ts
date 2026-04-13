import type { FastifyInstance } from 'fastify';
import { adapterRegistry } from '@omni-ad/platform-adapters';
import { DB_PLATFORM_TO_ENUM } from '@omni-ad/shared';
import { encryptTokenPair } from '@omni-ad/auth';
import { db } from '@omni-ad/db';
import { platformConnections } from '@omni-ad/db/schema';
import { onConnectionActivated } from '../services/platform.service.js';
import { sql } from 'drizzle-orm';

type DbPlatform = typeof platformConnections.$inferInsert.platform;

function getFrontendUrl(): string {
  return process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
}

function getRedirectUri(): string {
  const base = process.env['OAUTH_REDIRECT_BASE_URL'] ?? 'http://localhost:3001';
  return `${base}/auth/callback`;
}

/**
 * Registers the GET /auth/callback route that handles OAuth redirects
 * from all advertising platforms.
 *
 * Flow: platform redirects here with ?code=...&state=orgId:platform
 * → exchange code for tokens → encrypt → store → redirect to frontend
 */
export function registerOAuthCallbackRoutes(server: FastifyInstance): void {
  server.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
      auth_code?: string;  // TikTok uses auth_code instead of code
    };
  }>('/auth/callback', async (request, reply) => {
    const { state, error, error_description } = request.query;
    // TikTok sends auth_code, others send code
    const code = request.query.code ?? request.query.auth_code;
    const frontendUrl = getFrontendUrl();

    // 1. Handle OAuth errors (user denied access or platform error)
    if (error) {
      server.log.warn(
        { error, error_description },
        'OAuth callback received error from platform',
      );
      const errorParam = encodeURIComponent(error_description ?? error);
      return reply.redirect(`${frontendUrl}/settings?tab=platforms&error=${errorParam}`);
    }

    if (!code || !state) {
      return reply.redirect(`${frontendUrl}/settings?tab=platforms&error=missing_params`);
    }

    // 2. Parse state: "organizationId:platform"
    // Use lastIndexOf because UUIDs contain hyphens, not colons
    const colonIdx = state.lastIndexOf(':');
    if (colonIdx === -1) {
      server.log.error({ state }, 'OAuth callback: invalid state format');
      return reply.redirect(`${frontendUrl}/settings?tab=platforms&error=invalid_state`);
    }

    const organizationId = state.substring(0, colonIdx);
    const platformStr = state.substring(colonIdx + 1);

    // 3. Resolve adapter
    const adapterPlatform = DB_PLATFORM_TO_ENUM[platformStr];
    if (!adapterPlatform || !adapterRegistry.has(adapterPlatform)) {
      server.log.error({ platform: platformStr }, 'OAuth callback: unknown or unconfigured platform');
      return reply.redirect(`${frontendUrl}/settings?tab=platforms&error=unknown_platform`);
    }

    const adapter = adapterRegistry.get(adapterPlatform);

    try {
      // 4. Exchange authorization code for tokens
      const redirectUri = getRedirectUri();
      const tokens = await adapter.exchangeCode(code, redirectUri);

      // 5. Validate connection to get account info
      let accountId = 'unknown';
      let accountName = platformStr;
      try {
        const connectionStatus = await adapter.validateConnection(tokens.accessToken);
        accountId = connectionStatus.accountId;
        accountName = connectionStatus.accountName;
      } catch (validationErr: unknown) {
        // Validation failure is non-fatal — store connection anyway
        // This handles LINE/Yahoo where Ads API requires partner status
        const msg = validationErr instanceof Error ? validationErr.message : String(validationErr);
        server.log.warn(
          { platform: platformStr, error: msg },
          'OAuth callback: connection validation failed, storing tokens anyway',
        );
      }

      // 6. Encrypt tokens
      const encrypted = encryptTokenPair(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
      );

      // 7. Upsert into platformConnections
      const dbPlatform = platformStr as DbPlatform;
      const [connection] = await db
        .insert(platformConnections)
        .values({
          organizationId,
          platform: dbPlatform,
          accessTokenEncrypted: encrypted.accessTokenEncrypted,
          refreshTokenEncrypted: encrypted.refreshTokenEncrypted,
          tokenExpiresAt: encrypted.tokenExpiresAt,
          platformAccountId: accountId,
          platformAccountName: accountName,
          status: 'active',
        })
        .onConflictDoUpdate({
          target: [
            platformConnections.organizationId,
            platformConnections.platform,
            platformConnections.platformAccountId,
          ],
          set: {
            accessTokenEncrypted: encrypted.accessTokenEncrypted,
            refreshTokenEncrypted: encrypted.refreshTokenEncrypted,
            tokenExpiresAt: encrypted.tokenExpiresAt,
            platformAccountName: accountName,
            status: 'active',
            updatedAt: sql`now()`,
          },
        })
        .returning();

      server.log.info(
        { platform: platformStr, accountId, connectionId: connection?.id },
        'OAuth callback: platform connected successfully',
      );

      // 8. Trigger auto-analysis (non-blocking)
      if (connection) {
        void onConnectionActivated(organizationId, connection.id);
      }

      // 9. Redirect back to settings with success
      return reply.redirect(
        `${frontendUrl}/settings?tab=platforms&connected=${platformStr}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      server.log.error(
        { err, platform: platformStr, organizationId },
        `OAuth callback failed: ${message}`,
      );
      return reply.redirect(
        `${frontendUrl}/settings?tab=platforms&error=connection_failed`,
      );
    }
  });
}
