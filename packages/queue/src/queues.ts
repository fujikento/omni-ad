import type { QueueOptions } from 'bullmq';

export const QUEUE_NAMES = {
  AD_SYNC: 'ad-sync',
  CREATIVE_GENERATION: 'creative-generation',
  BUDGET_OPTIMIZATION: 'budget-optimization',
  REPORTING: 'reporting',
  AUDIENCE_SYNC: 'audience-sync',
  PLATFORM_WEBHOOKS: 'platform-webhooks',
  METRICS_PULL: 'metrics-pull',
  ANOMALY_DETECTION: 'anomaly-detection',
  RULES_EVALUATION: 'rules-evaluation',
  AI_AUTOPILOT: 'ai-autopilot',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

interface QueueConfig {
  name: QueueName;
  options: Partial<QueueOptions>;
  concurrency: number;
  rateLimit?: { max: number; duration: number };
  defaultJobOptions: {
    attempts: number;
    backoff: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete: { count: number };
    removeOnFail: { count: number };
  };
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  [QUEUE_NAMES.AD_SYNC]: {
    name: QUEUE_NAMES.AD_SYNC,
    options: {},
    concurrency: 5,
    rateLimit: { max: 100, duration: 60_000 },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  },
  [QUEUE_NAMES.CREATIVE_GENERATION]: {
    name: QUEUE_NAMES.CREATIVE_GENERATION,
    options: {},
    concurrency: 3,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  },
  [QUEUE_NAMES.BUDGET_OPTIMIZATION]: {
    name: QUEUE_NAMES.BUDGET_OPTIMIZATION,
    options: {},
    concurrency: 1,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  },
  [QUEUE_NAMES.REPORTING]: {
    name: QUEUE_NAMES.REPORTING,
    options: {},
    concurrency: 3,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  },
  [QUEUE_NAMES.AUDIENCE_SYNC]: {
    name: QUEUE_NAMES.AUDIENCE_SYNC,
    options: {},
    concurrency: 3,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  },
  [QUEUE_NAMES.PLATFORM_WEBHOOKS]: {
    name: QUEUE_NAMES.PLATFORM_WEBHOOKS,
    options: {},
    concurrency: 10,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 1_000 },
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 10_000 },
    },
  },
  [QUEUE_NAMES.METRICS_PULL]: {
    name: QUEUE_NAMES.METRICS_PULL,
    options: {},
    concurrency: 5,
    rateLimit: { max: 50, duration: 60_000 },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 2000 },
    },
  },
  [QUEUE_NAMES.ANOMALY_DETECTION]: {
    name: QUEUE_NAMES.ANOMALY_DETECTION,
    options: {},
    concurrency: 2,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  },
  [QUEUE_NAMES.RULES_EVALUATION]: {
    name: QUEUE_NAMES.RULES_EVALUATION,
    options: {},
    concurrency: 2,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  },
  [QUEUE_NAMES.AI_AUTOPILOT]: {
    name: QUEUE_NAMES.AI_AUTOPILOT,
    options: {},
    concurrency: 1,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  },
};
