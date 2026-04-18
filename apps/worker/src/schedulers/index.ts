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

  // Creative optimization: every 6 hours
  const creativeOptQueue = new Queue(QUEUE_NAMES.CREATIVE_OPTIMIZATION, { connection });
  await creativeOptQueue.upsertJobScheduler(
    'creative-optimization-scheduler',
    { every: 6 * 60 * 60 * 1000 },
    { name: 'scheduled-creative-optimization', data: {} },
  );

  // Token refresh: every 30 minutes
  const tokenRefreshQueue = new Queue(QUEUE_NAMES.TOKEN_REFRESH, { connection });
  await tokenRefreshQueue.upsertJobScheduler(
    'token-refresh-scheduler',
    { every: 30 * 60 * 1000 },
    { name: 'scheduled-token-refresh', data: {} },
  );

  // Unified Spend Orchestrator: every hour
  const orchestratorQueue = new Queue(
    QUEUE_NAMES.UNIFIED_SPEND_ORCHESTRATOR,
    { connection },
  );
  await orchestratorQueue.upsertJobScheduler(
    'orchestrator-scheduler',
    { every: 60 * 60 * 1000 },
    { name: 'scheduled-orchestrator', data: {} },
  );

  console.log('Registered 7 job schedulers');
}
