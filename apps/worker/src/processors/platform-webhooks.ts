import { processWebhookJobSchema, type ProcessWebhookJob } from '@omni-ad/queue';

export async function processPlatformWebhook(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = processWebhookJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: ProcessWebhookJob = parsed.data;
  process.stdout.write(
    `[platform-webhooks] Processing ${data.eventType} from ${data.platform}\n`
  );

  // Route to platform-specific handler based on event type
  // Currently logs only — full routing implemented when platform webhook signatures are configured
}
