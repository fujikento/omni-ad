import { Platform } from '@omni-ad/shared';
import type { PlatformAdapter } from './types.js';
import { adapterRegistry } from './adapter-registry.js';
import { MetaAdapter } from './meta/index.js';
import { GoogleAdsAdapter } from './google/index.js';
import { TikTokAdapter } from './tiktok/index.js';
import { LineYahooAdapter } from './line-yahoo/index.js';
import { AmazonAdsAdapter } from './amazon/index.js';
import { XAdapter } from './x/index.js';
import { MicrosoftAdsAdapter } from './microsoft/index.js';

interface PlatformEnvKeys {
  clientId: string;
  clientSecret: string;
  developerToken?: string;
}

const PLATFORM_ENV_KEYS: Record<Platform, PlatformEnvKeys> = {
  [Platform.META]: {
    clientId: 'META_CLIENT_ID',
    clientSecret: 'META_CLIENT_SECRET',
  },
  [Platform.GOOGLE]: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    developerToken: 'GOOGLE_DEVELOPER_TOKEN',
  },
  [Platform.TIKTOK]: {
    clientId: 'TIKTOK_APP_ID',
    clientSecret: 'TIKTOK_APP_SECRET',
  },
  [Platform.LINE_YAHOO]: {
    clientId: 'LINE_YAHOO_CLIENT_ID',
    clientSecret: 'LINE_YAHOO_CLIENT_SECRET',
  },
  [Platform.AMAZON]: {
    clientId: 'AMAZON_CLIENT_ID',
    clientSecret: 'AMAZON_CLIENT_SECRET',
  },
  [Platform.X]: {
    clientId: 'X_CLIENT_ID',
    clientSecret: 'X_CLIENT_SECRET',
  },
  [Platform.MICROSOFT]: {
    clientId: 'MICROSOFT_CLIENT_ID',
    clientSecret: 'MICROSOFT_CLIENT_SECRET',
    developerToken: 'MICROSOFT_DEVELOPER_TOKEN',
  },
};

interface AdapterInitResult {
  registered: Platform[];
  skipped: { platform: Platform; reason: string }[];
}

function getCredentials(platform: Platform): PlatformCredentials | null {
  const keys = PLATFORM_ENV_KEYS[platform];
  const clientId = process.env[keys.clientId];
  const clientSecret = process.env[keys.clientSecret];

  if (!clientId || !clientSecret) {
    return null;
  }

  const developerToken = keys.developerToken
    ? process.env[keys.developerToken]
    : undefined;

  // Google and Microsoft require a developer token
  if ((platform === Platform.GOOGLE || platform === Platform.MICROSOFT) && !developerToken) {
    return null;
  }

  return { clientId, clientSecret, developerToken };
}

interface PlatformCredentials {
  clientId: string;
  clientSecret: string;
  developerToken?: string;
}

function createAdapter(platform: Platform, creds: PlatformCredentials): PlatformAdapter {
  switch (platform) {
    case Platform.META:
      return new MetaAdapter(creds.clientId, creds.clientSecret);
    case Platform.GOOGLE:
      return new GoogleAdsAdapter(creds.clientId, creds.clientSecret, creds.developerToken!);
    case Platform.TIKTOK:
      return new TikTokAdapter(creds.clientId, creds.clientSecret);
    case Platform.LINE_YAHOO:
      return new LineYahooAdapter(creds.clientId, creds.clientSecret);
    case Platform.AMAZON:
      return new AmazonAdsAdapter(creds.clientId, creds.clientSecret);
    case Platform.X:
      return new XAdapter(creds.clientId, creds.clientSecret);
    case Platform.MICROSOFT:
      return new MicrosoftAdsAdapter(creds.clientId, creds.clientSecret, creds.developerToken!);
  }
}

/**
 * Reads platform credentials from environment variables, instantiates
 * adapters, and registers them with the global adapterRegistry.
 *
 * Non-fatal for missing credentials — platforms without credentials
 * are skipped with a warning. Call at application startup (API server
 * and worker).
 */
export function initializeAdapters(): AdapterInitResult {
  const registered: Platform[] = [];
  const skipped: AdapterInitResult['skipped'] = [];

  for (const platform of Object.values(Platform)) {
    if (adapterRegistry.has(platform)) {
      registered.push(platform);
      continue;
    }

    const creds = getCredentials(platform);
    if (!creds) {
      const keys = PLATFORM_ENV_KEYS[platform];
      const missing = [keys.clientId, keys.clientSecret, keys.developerToken]
        .filter((k): k is string => k !== undefined && !process.env[k])
        .join(', ');
      skipped.push({ platform, reason: `Missing env vars: ${missing}` });
      continue;
    }

    const adapter = createAdapter(platform, creds);
    adapterRegistry.register(platform, adapter);
    registered.push(platform);
  }

  return { registered, skipped };
}
