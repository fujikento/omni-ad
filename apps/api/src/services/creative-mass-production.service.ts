import { db } from '@omni-ad/db';
import { creativeBatches } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { MassProductionChunkJob } from '@omni-ad/queue';
import { and, desc, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchSelect = typeof creativeBatches.$inferSelect;

export interface MassProductionInput {
  name: string;
  productInfo: {
    name: string;
    description: string;
    usp: string;
    targetAudience: string;
    price?: string;
  };
  platforms: string[];
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  headlineAngles: string[];
  bodyApproaches: string[];
  ctaVariations: string[];
  imageStyles: string[];
  targetCount: number;
}

interface CreativeCombination {
  headlineAngle: string;
  bodyApproach: string;
  ctaVariation: string;
  imageStyle?: string;
}

export interface BatchStatusResult {
  id: string;
  name: string;
  status: BatchSelect['status'];
  totalRequested: number;
  totalCompleted: number;
  totalFailed: number;
  progressPercent: number;
  creativeIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

const CHUNK_SIZE = 10;

// ---------------------------------------------------------------------------
// Generate all combinations up to targetCount
// ---------------------------------------------------------------------------

function generateCombinations(
  input: MassProductionInput,
): CreativeCombination[] {
  const combinations: CreativeCombination[] = [];

  for (const angle of input.headlineAngles) {
    for (const approach of input.bodyApproaches) {
      for (const cta of input.ctaVariations) {
        if (input.imageStyles.length > 0) {
          for (const style of input.imageStyles) {
            combinations.push({
              headlineAngle: angle,
              bodyApproach: approach,
              ctaVariation: cta,
              imageStyle: style,
            });
          }
        } else {
          combinations.push({
            headlineAngle: angle,
            bodyApproach: approach,
            ctaVariation: cta,
          });
        }
      }
    }
  }

  // Cap at targetCount
  return combinations.slice(0, input.targetCount);
}

// ---------------------------------------------------------------------------
// Split combinations into chunks for parallel processing
// ---------------------------------------------------------------------------

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function generateMassCreatives(
  organizationId: string,
  userId: string,
  input: MassProductionInput,
): Promise<{ batchId: string; totalJobs: number; totalVariants: number }> {
  const allCombinations = generateCombinations(input);
  const totalVariants = allCombinations.length * input.platforms.length;

  // Create batch record
  const [batch] = await db
    .insert(creativeBatches)
    .values({
      organizationId,
      name: input.name,
      status: 'pending',
      totalRequested: totalVariants,
      totalCompleted: 0,
      totalFailed: 0,
      config: {
        productInfo: input.productInfo,
        platforms: input.platforms,
        language: input.language,
        keigoLevel: input.keigoLevel,
        themes: [],
        angles: input.headlineAngles,
        ctaVariations: input.ctaVariations,
        imageStyles: input.imageStyles,
      },
      creativeIds: [],
      createdBy: userId,
    })
    .returning();

  if (!batch) {
    throw new BatchCreationError('Failed to create creative batch record');
  }

  // Split into chunks of CHUNK_SIZE per platform
  const queue = getQueue(QUEUE_NAMES.CREATIVE_MASS_PRODUCTION);
  let totalJobs = 0;

  for (const platform of input.platforms) {
    const chunks = chunkArray(allCombinations, CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const jobData: MassProductionChunkJob = {
        organizationId,
        batchId: batch.id,
        chunkIndex: totalJobs,
        productInfo: input.productInfo,
        platform,
        language: input.language,
        keigoLevel: input.keigoLevel,
        combinations: chunk,
      };

      await queue.add(
        `mass-production-${batch.id}-chunk-${totalJobs}`,
        jobData,
      );
      totalJobs++;
    }
  }

  // Update batch to processing
  await db
    .update(creativeBatches)
    .set({
      status: 'processing',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creativeBatches.id, batch.id));

  return {
    batchId: batch.id,
    totalJobs,
    totalVariants,
  };
}

export async function getBatchStatus(
  batchId: string,
  organizationId: string,
): Promise<BatchStatusResult> {
  const batch = await db.query.creativeBatches.findFirst({
    where: and(
      eq(creativeBatches.id, batchId),
      eq(creativeBatches.organizationId, organizationId),
    ),
  });

  if (!batch) {
    throw new BatchNotFoundError(batchId);
  }

  const progressPercent =
    batch.totalRequested > 0
      ? Math.round((batch.totalCompleted / batch.totalRequested) * 100)
      : 0;

  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    totalRequested: batch.totalRequested,
    totalCompleted: batch.totalCompleted,
    totalFailed: batch.totalFailed,
    progressPercent,
    creativeIds: batch.creativeIds ?? [],
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    createdAt: batch.createdAt,
  };
}

export async function listBatches(
  organizationId: string,
  limit = 50,
  offset = 0,
): Promise<{ batches: BatchStatusResult[]; total: number }> {
  const [batches, countResult] = await Promise.all([
    db.query.creativeBatches.findMany({
      where: eq(creativeBatches.organizationId, organizationId),
      orderBy: [desc(creativeBatches.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(creativeBatches)
      .where(eq(creativeBatches.organizationId, organizationId)),
  ]);

  return {
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      totalRequested: b.totalRequested,
      totalCompleted: b.totalCompleted,
      totalFailed: b.totalFailed,
      progressPercent:
        b.totalRequested > 0
          ? Math.round((b.totalCompleted / b.totalRequested) * 100)
          : 0,
      creativeIds: b.creativeIds ?? [],
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      createdAt: b.createdAt,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

export async function cancelBatch(
  batchId: string,
  organizationId: string,
): Promise<{ cancelled: boolean }> {
  const batch = await db.query.creativeBatches.findFirst({
    where: and(
      eq(creativeBatches.id, batchId),
      eq(creativeBatches.organizationId, organizationId),
    ),
  });

  if (!batch) {
    throw new BatchNotFoundError(batchId);
  }

  if (batch.status === 'completed' || batch.status === 'failed') {
    return { cancelled: false };
  }

  await db
    .update(creativeBatches)
    .set({
      status: 'failed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creativeBatches.id, batchId));

  // Drain pending jobs from the queue for this batch
  const queue = getQueue(QUEUE_NAMES.CREATIVE_MASS_PRODUCTION);
  const waiting = await queue.getJobs(['waiting', 'delayed']);
  for (const job of waiting) {
    const data = job.data as Record<string, unknown>;
    if (data['batchId'] === batchId) {
      await job.remove();
    }
  }

  return { cancelled: true };
}

/**
 * Update batch progress atomically. Called by the worker after each chunk.
 */
export async function updateBatchProgress(
  batchId: string,
  completedCount: number,
  failedCount: number,
  newCreativeIds: string[],
): Promise<void> {
  await db
    .update(creativeBatches)
    .set({
      totalCompleted: sql`${creativeBatches.totalCompleted} + ${completedCount}`,
      totalFailed: sql`${creativeBatches.totalFailed} + ${failedCount}`,
      creativeIds: sql`array_cat(${creativeBatches.creativeIds}, ${newCreativeIds}::text[])`,
      updatedAt: new Date(),
    })
    .where(eq(creativeBatches.id, batchId));

  // Check if batch is done
  const batch = await db.query.creativeBatches.findFirst({
    where: eq(creativeBatches.id, batchId),
  });

  if (!batch) return;

  const totalProcessed = batch.totalCompleted + batch.totalFailed;
  if (totalProcessed >= batch.totalRequested) {
    const finalStatus =
      batch.totalFailed > 0 && batch.totalCompleted === 0
        ? 'failed'
        : 'completed';

    await db
      .update(creativeBatches)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creativeBatches.id, batchId));
  }
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class BatchNotFoundError extends Error {
  constructor(batchId: string) {
    super(`Batch not found: ${batchId}`);
    this.name = 'BatchNotFoundError';
  }
}

export class BatchCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchCreationError';
  }
}
