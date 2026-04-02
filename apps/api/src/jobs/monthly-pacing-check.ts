/**
 * Monthly Pacing Check Job
 *
 * Runs daily at 9:00 AM JST to check and auto-adjust monthly budget pacing
 * for all organizations with active campaigns.
 *
 * Usage:
 *   - Register as a BullMQ repeatable job on BUDGET_OPTIMIZATION queue
 *   - Or call startMonthlyPacingSchedule() from server startup
 */

import { db } from '@omni-ad/db';
import { campaigns } from '@omni-ad/db/schema';
import { eq } from 'drizzle-orm';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import { autoAdjustMonthlyPacing } from '../services/pacing.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthlyPacingJobResult {
  organizationId: string;
  adjustmentCount: number;
  error: string | null;
}

interface MonthlyPacingCheckResult {
  timestamp: Date;
  organizationsProcessed: number;
  totalAdjustments: number;
  results: MonthlyPacingJobResult[];
}

// ---------------------------------------------------------------------------
// Job Handler
// ---------------------------------------------------------------------------

/**
 * Process monthly pacing check for all organizations with active campaigns.
 */
export async function runMonthlyPacingCheck(): Promise<MonthlyPacingCheckResult> {
  const timestamp = new Date();

  // Find all organizations with at least one active campaign
  const orgsWithActiveCampaigns = await db
    .select({
      organizationId: campaigns.organizationId,
    })
    .from(campaigns)
    .where(eq(campaigns.status, 'active'))
    .groupBy(campaigns.organizationId);

  const results: MonthlyPacingJobResult[] = [];
  let totalAdjustments = 0;

  for (const { organizationId } of orgsWithActiveCampaigns) {
    try {
      const report = await autoAdjustMonthlyPacing(organizationId);
      results.push({
        organizationId,
        adjustmentCount: report.adjustments.length,
        error: null,
      });
      totalAdjustments += report.adjustments.length;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      results.push({
        organizationId,
        adjustmentCount: 0,
        error: message,
      });
    }
  }

  return {
    timestamp,
    organizationsProcessed: orgsWithActiveCampaigns.length,
    totalAdjustments,
    results,
  };
}

// ---------------------------------------------------------------------------
// Schedule Registration
// ---------------------------------------------------------------------------

/**
 * Register the monthly pacing check as a repeatable job on the
 * BUDGET_OPTIMIZATION queue. Runs daily at 9:00 AM JST (00:00 UTC).
 *
 * Call this from server startup to ensure the schedule is active.
 */
export async function startMonthlyPacingSchedule(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.BUDGET_OPTIMIZATION);

  await queue.add(
    'monthly-pacing-check',
    { type: 'monthly_pacing_check' },
    {
      repeat: {
        // 9:00 AM JST = 00:00 UTC
        pattern: '0 0 * * *',
        tz: 'Asia/Tokyo',
      },
      jobId: 'monthly-pacing-check-repeatable',
    },
  );
}
