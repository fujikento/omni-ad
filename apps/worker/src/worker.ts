import { Worker } from 'bullmq';
import { QUEUE_NAMES, QUEUE_CONFIGS, getRedisConnection } from '@omni-ad/queue';
import { processAdSync } from './processors/ad-sync.js';
import { processCreativeGeneration } from './processors/creative-generation.js';
import { processBudgetOptimization } from './processors/budget-optimization.js';
import { processReporting } from './processors/reporting.js';
import { processAudienceSync } from './processors/audience-sync.js';
import { processPlatformWebhook } from './processors/platform-webhooks.js';
import { processMetricsPull } from './processors/metrics-pull.js';
import { processAnomalyDetection } from './processors/anomaly-detection.js';
import { processRulesEvaluation } from './processors/rules-evaluation.js';
import { processAiAutopilot } from './processors/ai-autopilot.js';

const workers: Worker[] = [];

function createWorker(
  queueName: string,
  processor: (job: { name: string; data: unknown }) => Promise<void>,
  concurrency: number
): Worker {
  const worker = new Worker(queueName, processor, {
    connection: getRedisConnection(),
    concurrency,
  });

  worker.on('completed', (job) => {
    console.log(`[${queueName}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[${queueName}] Worker error:`, err.message);
  });

  return worker;
}

function startWorkers(): void {
  console.log('Starting OMNI-AD workers...');

  workers.push(
    createWorker(
      QUEUE_NAMES.AD_SYNC,
      processAdSync,
      QUEUE_CONFIGS[QUEUE_NAMES.AD_SYNC].concurrency
    ),
    createWorker(
      QUEUE_NAMES.CREATIVE_GENERATION,
      processCreativeGeneration,
      QUEUE_CONFIGS[QUEUE_NAMES.CREATIVE_GENERATION].concurrency
    ),
    createWorker(
      QUEUE_NAMES.BUDGET_OPTIMIZATION,
      processBudgetOptimization,
      QUEUE_CONFIGS[QUEUE_NAMES.BUDGET_OPTIMIZATION].concurrency
    ),
    createWorker(
      QUEUE_NAMES.REPORTING,
      processReporting,
      QUEUE_CONFIGS[QUEUE_NAMES.REPORTING].concurrency
    ),
    createWorker(
      QUEUE_NAMES.AUDIENCE_SYNC,
      processAudienceSync,
      QUEUE_CONFIGS[QUEUE_NAMES.AUDIENCE_SYNC].concurrency
    ),
    createWorker(
      QUEUE_NAMES.PLATFORM_WEBHOOKS,
      processPlatformWebhook,
      QUEUE_CONFIGS[QUEUE_NAMES.PLATFORM_WEBHOOKS].concurrency
    ),
    createWorker(
      QUEUE_NAMES.METRICS_PULL,
      processMetricsPull,
      QUEUE_CONFIGS[QUEUE_NAMES.METRICS_PULL].concurrency
    ),
    createWorker(
      QUEUE_NAMES.ANOMALY_DETECTION,
      processAnomalyDetection,
      QUEUE_CONFIGS[QUEUE_NAMES.ANOMALY_DETECTION].concurrency
    ),
    createWorker(
      QUEUE_NAMES.RULES_EVALUATION,
      processRulesEvaluation,
      QUEUE_CONFIGS[QUEUE_NAMES.RULES_EVALUATION].concurrency
    ),
    createWorker(
      QUEUE_NAMES.AI_AUTOPILOT,
      processAiAutopilot,
      QUEUE_CONFIGS[QUEUE_NAMES.AI_AUTOPILOT].concurrency
    )
  );

  console.log(`Started ${workers.length} workers`);
}

async function shutdown(): Promise<void> {
  console.log('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  console.log('All workers stopped');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorkers();
