import { db } from '@omni-ad/db';
import { audiences, audienceOverlaps } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { SyncAudienceJob, ComputeOverlapJob } from '@omni-ad/queue';
import { and, desc, eq, inArray } from 'drizzle-orm';

type AudienceSelect = typeof audiences.$inferSelect;
type AudienceOverlapSelect = typeof audienceOverlaps.$inferSelect;
type Platform = AudienceSelect['platform'];

export async function listAudiences(
  organizationId: string,
  platform?: Platform,
  limit = 100,
): Promise<AudienceSelect[]> {
  const conditions = [eq(audiences.organizationId, organizationId)];
  if (platform) {
    conditions.push(eq(audiences.platform, platform));
  }

  return db.query.audiences.findMany({
    where: and(...conditions),
    orderBy: [desc(audiences.createdAt)],
    limit,
  });
}

export async function getAudience(
  id: string,
  organizationId: string,
): Promise<AudienceSelect | undefined> {
  return db.query.audiences.findFirst({
    where: and(
      eq(audiences.id, id),
      eq(audiences.organizationId, organizationId),
    ),
  });
}

export async function getOverlaps(
  audienceIds: string[],
  organizationId: string,
): Promise<AudienceOverlapSelect[]> {
  // Verify all audience IDs belong to the org
  const orgAudiences = await db
    .select({ id: audiences.id })
    .from(audiences)
    .where(
      and(
        eq(audiences.organizationId, organizationId),
        inArray(audiences.id, audienceIds),
      ),
    );

  if (orgAudiences.length !== audienceIds.length) {
    throw new AudienceAccessError(
      'One or more audience IDs do not belong to the organization',
    );
  }

  return db
    .select()
    .from(audienceOverlaps)
    .where(
      and(
        inArray(audienceOverlaps.audienceAId, audienceIds),
        inArray(audienceOverlaps.audienceBId, audienceIds),
      ),
    );
}

export async function syncAudience(
  audienceId: string,
  targetPlatform: Platform,
  organizationId: string,
): Promise<{ jobId: string }> {
  const audience = await getAudience(audienceId, organizationId);
  if (!audience) {
    throw new AudienceNotFoundError(audienceId);
  }

  const queue = getQueue(QUEUE_NAMES.AUDIENCE_SYNC);
  const jobData: SyncAudienceJob = {
    organizationId,
    audienceId,
    platform: targetPlatform,
    direction: 'push',
  };

  const job = await queue.add(
    `sync-audience-${audienceId}-${targetPlatform}`,
    jobData,
  );

  return { jobId: job.id ?? audienceId };
}

export async function computeOverlap(
  audienceAId: string,
  audienceBId: string,
  organizationId: string,
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.AUDIENCE_SYNC);
  const jobData: ComputeOverlapJob = {
    organizationId,
    audienceAId,
    audienceBId,
  };

  const job = await queue.add(
    `overlap-${audienceAId}-${audienceBId}`,
    jobData,
  );

  return { jobId: job.id ?? audienceAId };
}

export class AudienceNotFoundError extends Error {
  constructor(audienceId: string) {
    super(`Audience not found: ${audienceId}`);
    this.name = 'AudienceNotFoundError';
  }
}

export class AudienceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudienceAccessError';
  }
}
