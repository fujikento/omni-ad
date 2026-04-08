/**
 * API Key Resolution for Workers
 *
 * Resolves API keys by checking org-specific DB keys first,
 * then falling back to environment variables.
 *
 * Mirrors the logic in apps/api/src/services/api-keys.service.ts
 * but avoids a cross-app import dependency.
 */

import { db } from '@omni-ad/db';
import { aiSettings } from '@omni-ad/db/schema';
import { decryptToken } from '@omni-ad/auth';
import { eq } from 'drizzle-orm';

type ApiProvider = 'anthropic' | 'openai' | 'runway' | 'elevenlabs';

const PROVIDER_COLUMN_MAP: Record<
  ApiProvider,
  | 'claudeApiKeyEncrypted'
  | 'openaiApiKeyEncrypted'
  | 'runwayApiKeyEncrypted'
  | 'elevenLabsApiKeyEncrypted'
> = {
  anthropic: 'claudeApiKeyEncrypted',
  openai: 'openaiApiKeyEncrypted',
  runway: 'runwayApiKeyEncrypted',
  elevenlabs: 'elevenLabsApiKeyEncrypted',
};

const PROVIDER_ENV_MAP: Record<ApiProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  runway: 'RUNWAY_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

/**
 * Resolve an API key for a provider. Checks org-specific DB key first,
 * then falls back to the corresponding env var.
 *
 * Returns undefined (instead of throwing) when no key is found,
 * letting the AI engine functions apply their own env-var fallback.
 */
export async function resolveApiKey(
  organizationId: string,
  provider: ApiProvider,
): Promise<string | undefined> {
  const column = PROVIDER_COLUMN_MAP[provider];

  try {
    const settings = await db.query.aiSettings.findFirst({
      where: eq(aiSettings.organizationId, organizationId),
      columns: {
        claudeApiKeyEncrypted: true,
        openaiApiKeyEncrypted: true,
        runwayApiKeyEncrypted: true,
        elevenLabsApiKeyEncrypted: true,
      },
    });

    const encryptedValue = settings?.[column] ?? null;

    if (encryptedValue) {
      return decryptToken(encryptedValue);
    }
  } catch {
    // DB lookup failed -- fall through to env var
  }

  return process.env[PROVIDER_ENV_MAP[provider]];
}
