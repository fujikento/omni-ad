import { db } from '@omni-ad/db';
import { creatives, creativeVariants } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { GenerateImageJob, AdaptToPlatformJob } from '@omni-ad/queue';
import { and, desc, eq } from 'drizzle-orm';

type CreativeSelect = typeof creatives.$inferSelect;
type CreativeVariantSelect = typeof creativeVariants.$inferSelect;
type Platform = typeof creativeVariants.$inferInsert['platform'];

export interface CreativeWithVariants extends CreativeSelect {
  variants: CreativeVariantSelect[];
}

interface GenerateCreativeInput {
  prompt: string;
  type: CreativeSelect['type'];
  platforms: Platform[];
  baseContent: Record<string, unknown>;
}

export async function listCreatives(
  organizationId: string,
  limit = 100,
): Promise<CreativeWithVariants[]> {
  return db.query.creatives.findMany({
    where: eq(creatives.organizationId, organizationId),
    orderBy: [desc(creatives.createdAt)],
    limit,
    with: {
      variants: true,
    },
  });
}

export async function getCreative(
  id: string,
  organizationId: string,
): Promise<CreativeWithVariants | undefined> {
  return db.query.creatives.findFirst({
    where: and(
      eq(creatives.id, id),
      eq(creatives.organizationId, organizationId),
    ),
    with: {
      variants: true,
    },
  });
}

export async function generateCreative(
  input: GenerateCreativeInput,
  organizationId: string,
): Promise<{ creativeId: string; jobId: string }> {
  // Insert creative record in "pending" state
  const [inserted] = await db
    .insert(creatives)
    .values({
      organizationId,
      type: input.type,
      baseContent: input.baseContent,
      aiGenerated: true,
      promptUsed: input.prompt,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to insert creative');
  }

  // Enqueue generation job
  const queue = getQueue(QUEUE_NAMES.CREATIVE_GENERATION);
  const jobData: GenerateImageJob = {
    organizationId,
    creativeId: inserted.id,
    prompt: input.prompt,
    platforms: input.platforms,
    dimensions: input.platforms.map(() => ({
      width: 1200,
      height: 628,
    })),
  };

  const job = await queue.add(
    `generate-creative-${inserted.id}`,
    jobData,
  );

  return {
    creativeId: inserted.id,
    jobId: job.id ?? inserted.id,
  };
}

export async function adaptCreative(
  creativeId: string,
  targetPlatform: Platform,
  organizationId: string,
): Promise<{ jobId: string }> {
  // Verify creative exists and belongs to org
  const creative = await getCreative(creativeId, organizationId);
  if (!creative) {
    throw new CreativeNotFoundError(creativeId);
  }

  const baseContent = creative.baseContent as Record<string, unknown>;
  const queue = getQueue(QUEUE_NAMES.CREATIVE_GENERATION);
  const jobData: AdaptToPlatformJob = {
    organizationId,
    creativeId,
    targetPlatform,
    sourceContent: {
      headline: String(baseContent['headline'] ?? ''),
      body: String(baseContent['body'] ?? ''),
      cta: String(baseContent['cta'] ?? ''),
      imageUrl: baseContent['imageUrl'] as string | undefined,
    },
  };

  const job = await queue.add(
    `adapt-creative-${creativeId}-${targetPlatform}`,
    jobData,
  );

  return { jobId: job.id ?? creativeId };
}

export class CreativeNotFoundError extends Error {
  constructor(creativeId: string) {
    super(`Creative not found: ${creativeId}`);
    this.name = 'CreativeNotFoundError';
  }
}
