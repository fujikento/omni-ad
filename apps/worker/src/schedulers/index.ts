import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '@omni-ad/queue';

/**
 * Registers recurring job schedulers for background processing.
 * Uses BullMQ's `upsertJobScheduler` which is idempotent --
 * safe to call on every worker startup without duplicating schedules.
 */
export async function registerSchedulers(): Promise<void> {
  const connection = getRedisConnection();

  // Metrics pull: every 4 hours
  const metricsPullQueue = new Queue(QUEUE_NAMES.METRICS_PULL, { connection });
  await metricsPullQueue.upsertJobScheduler(
    'metrics-pull-scheduler',
    { every: 4 * 60 * 60 * 1000 },
    { name: 'scheduled-metrics-pull', data: {} },
  );

  // Rules evaluation: every 15 minutes
  const rulesQueue = new Queue(QUEUE_NAMES.RULES_EVALUATION, { connection });
  await rulesQueue.upsertJobScheduler(
    'rules-eval-scheduler',
    { every: 15 * 60 * 1000 },
    { name: 'scheduled-rules-eval', data: {} },
  );

  // Anomaly detection: every hour
  const anomalyQueue = new Queue(QUEUE_NAMES.ANOMALY_DETECTION, { connection });
  await anomalyQueue.upsertJobScheduler(
    'anomaly-scheduler',
    { every: 60 * 60 * 1000 },
    { name: 'scheduled-anomaly', data: {} },
  );

  // Competitor monitor: every hour
  const competitorQueue = new Queue(QUEUE_NAMES.COMPETITOR_MONITOR, { connection });
  await competitorQueue.upsertJobScheduler(
    'competitor-scheduler',
    { every: 60 * 60 * 1000 },
    { name: 'scheduled-competitor', data: {} },
  );

  console.log('Registered 4 job schedulers');
}
