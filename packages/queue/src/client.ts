import { Queue, type ConnectionOptions } from 'bullmq';
import { QUEUE_CONFIGS, type QueueName } from './queues.js';

let redisConnection: ConnectionOptions | undefined;

export function initRedisConnection(options: ConnectionOptions): void {
  redisConnection = options;
}

export function getRedisConnection(): ConnectionOptions {
  if (!redisConnection) {
    const url = process.env['REDIS_URL'];
    if (url) {
      const parsed = new URL(url);
      redisConnection = {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        username: parsed.username || undefined,
      };
    } else {
      const host = process.env['REDIS_HOST'] ?? 'localhost';
      const port = Number(process.env['REDIS_PORT'] ?? 6379);
      const password = process.env['REDIS_PASSWORD'] ?? undefined;
      redisConnection = { host, port, password };
    }
  }
  return redisConnection;
}

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const config = QUEUE_CONFIGS[name];
  const queue = new Queue(config.name, {
    connection: getRedisConnection(),
    defaultJobOptions: config.defaultJobOptions,
    ...config.options,
  });

  queues.set(name, queue);
  return queue;
}

export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
}
