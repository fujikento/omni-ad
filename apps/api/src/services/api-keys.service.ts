/**
 * API Key Resolution Service
 *
 * Central service that resolves API keys for external providers.
 * Checks DB first (org-specific encrypted keys), falls back to env vars.
 */

import { db } from '@omni-ad/db';
import { aiSettings } from '@omni-ad/db/schema';
import { encryptToken, decryptToken } from '@omni-ad/auth';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiProvider = 'anthropic' | 'openai' | 'runway' | 'elevenlabs';

export interface ApiKeyStatus {
  anthropic: boolean;
  openai: boolean;
  runway: boolean;
  elevenlabs: boolean;
}

export interface TestKeyResult {
  success: boolean;
  error?: string;
}

/** Maps provider name to the corresponding encrypted column in aiSettings */
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

/** Maps provider name to the corresponding environment variable */
const PROVIDER_ENV_MAP: Record<ApiProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  runway: 'RUNWAY_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an API key for a provider. Checks org-specific DB key first,
 * then falls back to the corresponding env var.
 */
export async function getApiKey(
  organizationId: string,
  provider: ApiProvider,
): Promise<string> {
  const column = PROVIDER_COLUMN_MAP[provider];

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

  const envKey = PROVIDER_ENV_MAP[provider];
  const envValue = process.env[envKey];

  if (envValue) {
    return envValue;
  }

  throw new ApiKeyNotConfiguredError(provider);
}

/**
 * Encrypt and persist an API key for a provider in the org's aiSettings row.
 * Creates the aiSettings row if it does not exist.
 */
export async function setApiKey(
  organizationId: string,
  provider: ApiProvider,
  apiKey: string,
): Promise<void> {
  const column = PROVIDER_COLUMN_MAP[provider];
  const encrypted = encryptToken(apiKey);

  // Upsert: insert if missing, update if exists
  await db
    .insert(aiSettings)
    .values({
      organizationId,
      [column]: encrypted,
    })
    .onConflictDoUpdate({
      target: aiSettings.organizationId,
      set: {
        [column]: encrypted,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Remove (clear) an API key for a provider from the org's aiSettings row.
 */
export async function clearApiKey(
  organizationId: string,
  provider: ApiProvider,
): Promise<void> {
  const column = PROVIDER_COLUMN_MAP[provider];

  await db
    .update(aiSettings)
    .set({
      [column]: null,
      updatedAt: sql`now()`,
    })
    .where(eq(aiSettings.organizationId, organizationId));
}

/**
 * Test whether an API key is valid by making a minimal request to the provider.
 */
export async function testApiKey(
  provider: ApiProvider,
  apiKey: string,
): Promise<TestKeyResult> {
  switch (provider) {
    case 'anthropic':
      return testAnthropicKey(apiKey);
    case 'openai':
      return testOpenAIKey(apiKey);
    case 'runway':
      return testRunwayKey(apiKey);
    case 'elevenlabs':
      return testElevenLabsKey(apiKey);
  }
}

/**
 * Return which providers have a key configured (DB or env var) for the org.
 */
export async function getKeyStatus(
  organizationId: string,
): Promise<ApiKeyStatus> {
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.organizationId, organizationId),
    columns: {
      claudeApiKeyEncrypted: true,
      openaiApiKeyEncrypted: true,
      runwayApiKeyEncrypted: true,
      elevenLabsApiKeyEncrypted: true,
    },
  });

  return {
    anthropic: hasKey(settings?.claudeApiKeyEncrypted, 'ANTHROPIC_API_KEY'),
    openai: hasKey(settings?.openaiApiKeyEncrypted, 'OPENAI_API_KEY'),
    runway: hasKey(settings?.runwayApiKeyEncrypted, 'RUNWAY_API_KEY'),
    elevenlabs: hasKey(settings?.elevenLabsApiKeyEncrypted, 'ELEVENLABS_API_KEY'),
  };
}

/**
 * Mask an API key for safe display. Shows first 6 and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length < 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Provider Test Implementations
// ---------------------------------------------------------------------------

async function testAnthropicKey(apiKey: string): Promise<TestKeyResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Anthropic API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: extractErrorMessage(err) };
  }
}

async function testOpenAIKey(apiKey: string): Promise<TestKeyResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `OpenAI API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: extractErrorMessage(err) };
  }
}

async function testRunwayKey(apiKey: string): Promise<TestKeyResult> {
  try {
    const response = await fetch(
      'https://api.dev.runwayml.com/v1/tasks?limit=1',
      {
        headers: {
          authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': '2024-11-06',
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Runway API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: extractErrorMessage(err) };
  }
}

async function testElevenLabsKey(apiKey: string): Promise<TestKeyResult> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `ElevenLabs API error ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: extractErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasKey(
  encryptedValue: string | null | undefined,
  envVarName: string,
): boolean {
  if (encryptedValue) return true;
  return Boolean(process.env[envVarName]);
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiKeyNotConfiguredError extends Error {
  public readonly provider: ApiProvider;

  constructor(provider: ApiProvider) {
    const envVar = PROVIDER_ENV_MAP[provider];
    super(
      `API key for ${provider} is not configured. ` +
        `Set it in organization settings or via ${envVar} environment variable.`,
    );
    this.name = 'ApiKeyNotConfiguredError';
    this.provider = provider;
  }
}
