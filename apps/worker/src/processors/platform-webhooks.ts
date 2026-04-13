import { db } from '@omni-ad/db';
import {
  campaignPlatformDeployments,
  platformConnections,
} from '@omni-ad/db/schema';
import { processWebhookJobSchema, type ProcessWebhookJob } from '@omni-ad/queue';
import { and, eq, sql } from 'drizzle-orm';

type WebhookHandler = (data: ProcessWebhookJob) => Promise<void>;

async function handleStatusChange(data: ProcessWebhookJob): Promise<void> {
  const payload = data.payload;
  const externalId = (payload['campaign_id'] ?? payload['campaignId'] ?? payload['id']) as string | undefined;
  if (!externalId) return;

  const newStatus = (payload['status'] ?? payload['effective_status'] ?? payload['configured_status']) as string | undefined;
  if (!newStatus) return;

  const statusMap: Record<string, string> = {
    ACTIVE: 'active',
    ENABLED: 'active',
    PAUSED: 'paused',
    REMOVED: 'completed',
    ARCHIVED: 'completed',
    DELETED: 'completed',
    active: 'active',
    paused: 'paused',
    completed: 'completed',
  };

  const mappedStatus = statusMap[newStatus] ?? 'unknown';
  if (mappedStatus === 'unknown') return;

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformStatus: mappedStatus,
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(campaignPlatformDeployments.externalCampaignId, externalId),
        eq(campaignPlatformDeployments.platform, data.platform),
      ),
    );

  console.log(
    `[webhook] ${data.platform} campaign ${externalId} status → ${mappedStatus}`,
  );
}

async function handleBudgetChange(data: ProcessWebhookJob): Promise<void> {
  const payload = data.payload;
  const externalId = (payload['campaign_id'] ?? payload['campaignId']) as string | undefined;
  if (!externalId) return;

  const budget = (payload['daily_budget'] ?? payload['budget'] ?? payload['lifetime_budget']) as string | number | undefined;
  if (budget === undefined) return;

  const budgetNum = typeof budget === 'string' ? parseFloat(budget) : budget;
  if (isNaN(budgetNum)) return;

  await db
    .update(campaignPlatformDeployments)
    .set({
      platformBudget: String(budgetNum),
      lastSyncAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(campaignPlatformDeployments.externalCampaignId, externalId),
        eq(campaignPlatformDeployments.platform, data.platform),
      ),
    );

  console.log(
    `[webhook] ${data.platform} campaign ${externalId} budget → ${budgetNum}`,
  );
}

async function handleTokenRevocation(data: ProcessWebhookJob): Promise<void> {
  const payload = data.payload;
  const accountId = (payload['account_id'] ?? payload['advertiser_id']) as string | undefined;
  if (!accountId) return;

  await db
    .update(platformConnections)
    .set({ status: 'expired', updatedAt: sql`now()` })
    .where(eq(platformConnections.platformAccountId, accountId));

  console.log(
    `[webhook] ${data.platform} account ${accountId} token revoked`,
  );
}

async function handleConversion(data: ProcessWebhookJob): Promise<void> {
  // Log conversion events for analytics — full conversion tracking
  // uses the dedicated /track/:pixelId endpoint
  console.log(
    `[webhook] ${data.platform} conversion event: ${data.eventType}`,
  );
}

const EVENT_HANDLERS: Record<string, WebhookHandler> = {
  status_change: handleStatusChange,
  budget_change: handleBudgetChange,
  token_revocation: handleTokenRevocation,
  account_revoked: handleTokenRevocation,
  conversion: handleConversion,
};

export async function processPlatformWebhook(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = processWebhookJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: ProcessWebhookJob = parsed.data;

  const handler = EVENT_HANDLERS[data.eventType];
  if (handler) {
    await handler(data);
  } else {
    console.log(
      `[webhook] Unhandled event type "${data.eventType}" from ${data.platform}`,
    );
  }
}
