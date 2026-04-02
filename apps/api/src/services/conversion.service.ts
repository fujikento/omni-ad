/**
 * Conversion Tracking Service
 *
 * Server-side conversion event ingestion with HMAC verification,
 * PII hashing, click ID parsing, and platform sync dispatch.
 */

import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { db } from '@omni-ad/db';
import {
  conversionEvents,
  conversionEndpoints,
} from '@omni-ad/db/schema';
import type { PlatformMappings } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { ProcessWebhookJob } from '@omni-ad/queue';
import { and, desc, eq, gte, lte, sql, count } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConversionEventInsert = typeof conversionEvents.$inferInsert;
type ConversionEventSelect = typeof conversionEvents.$inferSelect;
type ConversionEndpointSelect = typeof conversionEndpoints.$inferSelect;
type ConversionEndpointInsert = typeof conversionEndpoints.$inferInsert;
type Platform = NonNullable<ConversionEventInsert['platform']>;

interface CreateEndpointInput {
  name: string;
  allowedDomains: string[];
  eventTypes: string[];
  platformMappings?: PlatformMappings;
}

interface UpdateEndpointInput {
  name?: string;
  allowedDomains?: string[];
  eventTypes?: string[];
  platformMappings?: PlatformMappings;
  active?: boolean;
}

interface ConversionEventData {
  eventName: string;
  eventValue?: string;
  currency?: string;
  sourceUrl?: string;
  email?: string;
  phone?: string;
  externalClickId?: string;
  campaignId?: string;
  metadata?: Record<string, unknown>;
}

interface RequestHeaders {
  userAgent?: string;
  ipAddress?: string;
  signature?: string;
}

export interface ConversionStatRow {
  eventName: string;
  platform: string | null;
  count: number;
  totalValue: string | null;
}

export interface ConversionStats {
  rows: ConversionStatRow[];
  total: number;
}

interface PlatformSyncResult {
  success: boolean;
  platform: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Click ID → Platform mapping
// ---------------------------------------------------------------------------

const CLICK_ID_PLATFORM_MAP: Record<string, Platform> = {
  fbclid: 'meta',
  gclid: 'google',
  ttclid: 'tiktok',
  msclkid: 'microsoft',
  yclid: 'line_yahoo',
  twclid: 'x',
};

function detectPlatformFromClickId(clickId: string): Platform | null {
  for (const [prefix, platform] of Object.entries(CLICK_ID_PLATFORM_MAP)) {
    // Click IDs are typically passed as URL params; the value itself
    // doesn't embed the param name. We match on the field name provided
    // or check common patterns. In practice, the frontend sends the
    // param name alongside the value.
    if (clickId.startsWith(prefix)) {
      return platform;
    }
  }
  return null;
}

function detectPlatformFromUrl(sourceUrl: string): Platform | null {
  try {
    const url = new URL(sourceUrl);
    for (const [param, platform] of Object.entries(CLICK_ID_PLATFORM_MAP)) {
      if (url.searchParams.has(param)) {
        return platform;
      }
    }
  } catch {
    // Invalid URL, skip detection
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hashing utilities
// ---------------------------------------------------------------------------

function sha256Hash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function isAlreadyHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function hashPii(value: string | undefined): string | null {
  if (!value) return null;
  if (isAlreadyHashed(value)) return value;
  return sha256Hash(value);
}

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

function generateHmacSignature(
  secretKey: string,
  payload: string,
): string {
  return createHmac('sha256', secretKey).update(payload).digest('hex');
}

function verifyHmacSignature(
  secretKey: string,
  payload: string,
  signature: string,
): boolean {
  const expected = generateHmacSignature(secretKey, payload);
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IP hashing for privacy
// ---------------------------------------------------------------------------

function hashIpAddress(ip: string | undefined): string | null {
  if (!ip) return null;
  return sha256Hash(ip);
}

// ---------------------------------------------------------------------------
// Endpoint CRUD
// ---------------------------------------------------------------------------

export async function createEndpoint(
  organizationId: string,
  input: CreateEndpointInput,
): Promise<ConversionEndpointSelect> {
  const pixelId = `px_${randomBytes(16).toString('hex')}`;
  const secretKey = randomBytes(32).toString('hex');

  const values: ConversionEndpointInsert = {
    organizationId,
    name: input.name,
    pixelId,
    secretKey,
    allowedDomains: input.allowedDomains,
    eventTypes: input.eventTypes,
    platformMappings: input.platformMappings ?? null,
  };

  const [inserted] = await db
    .insert(conversionEndpoints)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to create conversion endpoint');
  }

  return inserted;
}

export async function listEndpoints(
  organizationId: string,
): Promise<ConversionEndpointSelect[]> {
  return db.query.conversionEndpoints.findMany({
    where: and(
      eq(conversionEndpoints.organizationId, organizationId),
      eq(conversionEndpoints.active, true),
    ),
    orderBy: [desc(conversionEndpoints.createdAt)],
  });
}

export async function updateEndpoint(
  endpointId: string,
  organizationId: string,
  updates: UpdateEndpointInput,
): Promise<ConversionEndpointSelect> {
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (updates.name !== undefined) updateSet['name'] = updates.name;
  if (updates.allowedDomains !== undefined)
    updateSet['allowedDomains'] = updates.allowedDomains;
  if (updates.eventTypes !== undefined)
    updateSet['eventTypes'] = updates.eventTypes;
  if (updates.platformMappings !== undefined)
    updateSet['platformMappings'] = updates.platformMappings;
  if (updates.active !== undefined) updateSet['active'] = updates.active;

  const [updated] = await db
    .update(conversionEndpoints)
    .set(updateSet)
    .where(
      and(
        eq(conversionEndpoints.id, endpointId),
        eq(conversionEndpoints.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new EndpointNotFoundError(endpointId);
  }

  return updated;
}

export async function deleteEndpoint(
  endpointId: string,
  organizationId: string,
): Promise<ConversionEndpointSelect> {
  return updateEndpoint(endpointId, organizationId, { active: false });
}

// ---------------------------------------------------------------------------
// Conversion event ingestion
// ---------------------------------------------------------------------------

export async function recordConversion(
  pixelId: string,
  eventData: ConversionEventData,
  headers: RequestHeaders,
  rawBody: string,
): Promise<ConversionEventSelect> {
  // 1. Look up the endpoint
  const endpoint = await db.query.conversionEndpoints.findFirst({
    where: and(
      eq(conversionEndpoints.pixelId, pixelId),
      eq(conversionEndpoints.active, true),
    ),
  });

  if (!endpoint) {
    throw new EndpointNotFoundError(pixelId);
  }

  // 2. Verify HMAC signature
  if (!headers.signature) {
    throw new InvalidSignatureError('Missing X-Signature header');
  }

  if (!verifyHmacSignature(endpoint.secretKey, rawBody, headers.signature)) {
    throw new InvalidSignatureError('HMAC signature verification failed');
  }

  // 3. Validate event type is allowed
  if (
    endpoint.eventTypes.length > 0 &&
    !endpoint.eventTypes.includes(eventData.eventName)
  ) {
    throw new InvalidEventError(
      `Event type "${eventData.eventName}" is not allowed for this endpoint`,
    );
  }

  // 4. Detect platform from click ID or source URL
  let detectedPlatform: Platform | null = null;
  if (eventData.externalClickId) {
    detectedPlatform = detectPlatformFromClickId(eventData.externalClickId);
  }
  if (!detectedPlatform && eventData.sourceUrl) {
    detectedPlatform = detectPlatformFromUrl(eventData.sourceUrl);
  }

  // 5. Hash PII
  const hashedEmail = hashPii(eventData.email);
  const hashedPhone = hashPii(eventData.phone);
  const hashedIp = hashIpAddress(headers.ipAddress);

  // 6. Store event
  const values: ConversionEventInsert = {
    organizationId: endpoint.organizationId,
    eventName: eventData.eventName,
    eventValue: eventData.eventValue ?? null,
    currency: eventData.currency ?? 'JPY',
    sourceUrl: eventData.sourceUrl ?? null,
    userAgent: headers.userAgent ?? null,
    ipAddress: hashedIp,
    hashedEmail,
    hashedPhone,
    externalClickId: eventData.externalClickId ?? null,
    platform: detectedPlatform,
    campaignId: eventData.campaignId ?? null,
    metadata: eventData.metadata ?? null,
  };

  const [inserted] = await db
    .insert(conversionEvents)
    .values(values)
    .returning();

  if (!inserted) {
    throw new Error('Failed to record conversion event');
  }

  // 7. Enqueue platform sync jobs
  await enqueuePlatformSyncs(inserted, endpoint).catch((err: unknown) => {
    // Platform sync failures should not block event ingestion
    const message = err instanceof Error ? err.message : 'Unknown error';
    process.stdout.write(
      `[conversion] Failed to enqueue platform syncs: ${message}\n`,
    );
  });

  return inserted;
}

// ---------------------------------------------------------------------------
// Platform sync dispatch
// ---------------------------------------------------------------------------

async function enqueuePlatformSyncs(
  event: ConversionEventSelect,
  endpoint: ConversionEndpointSelect,
): Promise<void> {
  const mappings = endpoint.platformMappings as PlatformMappings | null;
  if (!mappings) return;

  const webhookQueue = getQueue(QUEUE_NAMES.PLATFORM_WEBHOOKS);
  const syncPromises: Promise<unknown>[] = [];

  if (mappings.meta) {
    const jobData: ProcessWebhookJob = {
      platform: 'meta',
      eventType: 'conversion_sync',
      payload: {
        eventId: event.id,
        endpointId: endpoint.id,
        mapping: mappings.meta,
      },
      receivedAt: new Date().toISOString(),
    };
    syncPromises.push(
      webhookQueue.add(`sync-conversion-meta-${event.id}`, jobData),
    );
  }

  if (mappings.google) {
    const jobData: ProcessWebhookJob = {
      platform: 'google',
      eventType: 'conversion_sync',
      payload: {
        eventId: event.id,
        endpointId: endpoint.id,
        mapping: mappings.google,
      },
      receivedAt: new Date().toISOString(),
    };
    syncPromises.push(
      webhookQueue.add(`sync-conversion-google-${event.id}`, jobData),
    );
  }

  if (mappings.tiktok) {
    const jobData: ProcessWebhookJob = {
      platform: 'tiktok',
      eventType: 'conversion_sync',
      payload: {
        eventId: event.id,
        endpointId: endpoint.id,
        mapping: mappings.tiktok,
      },
      receivedAt: new Date().toISOString(),
    };
    syncPromises.push(
      webhookQueue.add(`sync-conversion-tiktok-${event.id}`, jobData),
    );
  }

  if (mappings.line_yahoo) {
    const jobData: ProcessWebhookJob = {
      platform: 'line_yahoo',
      eventType: 'conversion_sync',
      payload: {
        eventId: event.id,
        endpointId: endpoint.id,
        mapping: mappings.line_yahoo,
      },
      receivedAt: new Date().toISOString(),
    };
    syncPromises.push(
      webhookQueue.add(`sync-conversion-line-${event.id}`, jobData),
    );
  }

  await Promise.all(syncPromises);
}

// ---------------------------------------------------------------------------
// Platform sync implementations
// ---------------------------------------------------------------------------

export async function syncToMeta(
  event: ConversionEventSelect,
  mapping: { pixelId: string; accessToken: string },
): Promise<PlatformSyncResult> {
  const url = `https://graph.facebook.com/v24.0/${mapping.pixelId}/events`;

  const eventData = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(new Date(event.createdAt).getTime() / 1000),
        event_source_url: event.sourceUrl,
        action_source: 'website',
        user_data: {
          em: event.hashedEmail ? [event.hashedEmail] : undefined,
          ph: event.hashedPhone ? [event.hashedPhone] : undefined,
          client_ip_address: event.ipAddress,
          client_user_agent: event.userAgent,
          fbc: event.externalClickId ?? undefined,
        },
        custom_data: {
          value: event.eventValue ? Number(event.eventValue) : undefined,
          currency: event.currency,
          ...(event.metadata as Record<string, unknown> | undefined),
        },
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${mapping.accessToken}`,
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        platform: 'meta',
        error: `Meta Conversions API error (${response.status}): ${text}`,
      };
    }

    await markEventProcessed(event.id);
    return { success: true, platform: 'meta' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, platform: 'meta', error: message };
  }
}

export async function syncToGoogle(
  event: ConversionEventSelect,
  mapping: { conversionId: string; label: string },
): Promise<PlatformSyncResult> {
  // Google Enhanced Conversions API endpoint
  const url = `https://www.googleapis.com/conversions/v1/conversions:upload`;

  const conversionData = {
    conversions: [
      {
        conversionAction: `customers/${mapping.conversionId}/conversionActions/${mapping.label}`,
        conversionDateTime: new Date(event.createdAt).toISOString(),
        conversionValue: event.eventValue ? Number(event.eventValue) : 0,
        currencyCode: event.currency,
        userIdentifiers: [
          ...(event.hashedEmail
            ? [{ hashedEmail: event.hashedEmail }]
            : []),
          ...(event.hashedPhone
            ? [{ hashedPhoneNumber: event.hashedPhone }]
            : []),
        ],
        gclid: event.externalClickId ?? undefined,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(conversionData),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        platform: 'google',
        error: `Google Enhanced Conversions error (${response.status}): ${text}`,
      };
    }

    await markEventProcessed(event.id);
    return { success: true, platform: 'google' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, platform: 'google', error: message };
  }
}

export async function syncToTikTok(
  event: ConversionEventSelect,
  mapping: { pixelCode: string; accessToken: string },
): Promise<PlatformSyncResult> {
  const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

  const eventData = {
    pixel_code: mapping.pixelCode,
    event: event.eventName,
    event_id: event.id,
    timestamp: new Date(event.createdAt).toISOString(),
    context: {
      user_agent: event.userAgent,
      ip: event.ipAddress,
    },
    properties: {
      value: event.eventValue ? Number(event.eventValue) : undefined,
      currency: event.currency,
      contents: event.metadata
        ? [event.metadata]
        : undefined,
    },
    user: {
      email: event.hashedEmail ?? undefined,
      phone_number: event.hashedPhone ?? undefined,
      ttclid: event.externalClickId ?? undefined,
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'access-token': mapping.accessToken,
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        platform: 'tiktok',
        error: `TikTok Events API error (${response.status}): ${text}`,
      };
    }

    await markEventProcessed(event.id);
    return { success: true, platform: 'tiktok' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, platform: 'tiktok', error: message };
  }
}

export async function syncToLineYahoo(
  event: ConversionEventSelect,
  mapping: { tagId: string; accessToken: string },
): Promise<PlatformSyncResult> {
  const conversionData = {
    tag_id: mapping.tagId,
    event_name: event.eventName,
    event_time: Math.floor(new Date(event.createdAt).getTime() / 1000),
    value: event.eventValue ? Number(event.eventValue) : undefined,
    currency: event.currency,
    user_data: {
      em: event.hashedEmail ?? undefined,
      ph: event.hashedPhone ?? undefined,
      yclid: event.externalClickId ?? undefined,
    },
  };

  try {
    const response = await fetch(
      'https://ads-cv.line-apps.com/api/v1.0/events',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${mapping.accessToken}`,
        },
        body: JSON.stringify(conversionData),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        platform: 'line_yahoo',
        error: `LINE/Yahoo Conversion API error (${response.status}): ${text}`,
      };
    }

    await markEventProcessed(event.id);
    return { success: true, platform: 'line_yahoo' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, platform: 'line_yahoo', error: message };
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getConversionStats(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<ConversionStats> {
  const rows = await db
    .select({
      eventName: conversionEvents.eventName,
      platform: conversionEvents.platform,
      count: count(),
      totalValue: sql<string>`coalesce(sum(${conversionEvents.eventValue}), '0')`,
    })
    .from(conversionEvents)
    .where(
      and(
        eq(conversionEvents.organizationId, organizationId),
        gte(conversionEvents.createdAt, new Date(startDate)),
        lte(conversionEvents.createdAt, new Date(endDate)),
      ),
    )
    .groupBy(conversionEvents.eventName, conversionEvents.platform);

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return { rows, total };
}

// ---------------------------------------------------------------------------
// Tracking snippet generator
// ---------------------------------------------------------------------------

export function generateTrackingSnippet(
  pixelId: string,
  apiBaseUrl: string,
): string {
  return `<!-- OMNI-AD Conversion Tracking -->
<script>
!function(o,m,n,i){o.OmniAd=o.OmniAd||function(){(o.OmniAd.q=o.OmniAd.q||[]).push(arguments)};
var s=m.createElement('script');s.async=1;s.src='${apiBaseUrl}/pixel.js';
m.head.appendChild(s)}(window,document);
OmniAd('init', '${pixelId}');
</script>`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function markEventProcessed(eventId: string): Promise<void> {
  await db
    .update(conversionEvents)
    .set({ processedAt: sql`now()` })
    .where(eq(conversionEvents.id, eventId));
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EndpointNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Conversion endpoint not found: ${identifier}`);
    this.name = 'EndpointNotFoundError';
  }
}

export class InvalidSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSignatureError';
  }
}

export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventError';
  }
}
