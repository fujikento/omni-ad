import { computeAllocationJobSchema, type ComputeAllocationJob } from '@omni-ad/queue';
import {
  executeAllocationCycle,
  initializeArms,
  type AllocationRequest,
  type BanditArm,
  type PlatformMetricsSummary,
} from '@omni-ad/ai-engine';
import { db } from '@omni-ad/db';
import { budgetAllocations } from '@omni-ad/db/schema';

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(`[budget-optimization] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  warn(message, meta) {
    process.stdout.write(`[budget-optimization] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  error(message, meta) {
    process.stderr.write(`[budget-optimization] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
};

export async function processBudgetOptimization(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = computeAllocationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: ComputeAllocationJob = parsed.data;
  const { organizationId, totalBudget, platforms, objective } = data;

  logger.info('Computing budget allocation', {
    organizationId,
    totalBudget,
    platforms,
    objective,
  });

  try {
    // Initialize bandit arms for each platform
    // In production, retrieve persisted arms from the database
    const currentArms: BanditArm[] = initializeArms({
      totalBudget,
      platforms,
      minBudgetPerPlatform: totalBudget * 0.05,
      maxBudgetPerPlatform: totalBudget * 0.6,
      priorAlpha: 1,
      priorBeta: 1,
    });

    // Build metrics summaries (placeholder - in production, fetch from metricsDaily)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const latestMetrics: PlatformMetricsSummary[] = platforms.map((platform) => ({
      platform,
      spend: 0,
      revenue: 0,
      roas: 0,
      period: { start: weekAgo, end: now },
    }));

    const allocationRequest: AllocationRequest = {
      organizationId,
      totalBudget,
      platforms,
      currentArms,
      latestMetrics,
      constraints: {
        minBudgetPerPlatform: totalBudget * 0.05,
        maxBudgetPerPlatform: totalBudget * 0.6,
        lockedAllocations: {},
      },
    };

    const { result } = executeAllocationCycle(allocationRequest);

    logger.info('Budget allocation computed', {
      organizationId,
      allocations: result.allocations,
      expectedRoas: result.expectedRoas,
      explorationRate: result.explorationRate,
    });

    // Store allocation result in database
    const today = new Date().toISOString().slice(0, 10);
    const roasValues = Object.values(result.expectedRoas);
    const predictedRoas =
      roasValues.length > 0
        ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length
        : 0;
    await db.insert(budgetAllocations).values({
      organizationId,
      date: today,
      totalBudget: totalBudget.toString(),
      allocations: result.allocations,
      predictedRoas,
      algorithmVersion: 'thompson-sampling-v1',
    });

    logger.info('Allocation saved to database', {
      organizationId,
      platformCount: Object.keys(result.allocations).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Budget optimization failed', {
      organizationId,
      error: message,
    });
    throw err;
  }
}
