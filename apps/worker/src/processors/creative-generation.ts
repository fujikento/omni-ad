import {
  generateTextJobSchema,
  generateImageJobSchema,
  generateVideoJobSchema,
  adaptToPlatformJobSchema,
  type GenerateTextJob,
  type GenerateImageJob,
  type GenerateVideoJob,
  type AdaptToPlatformJob,
} from '@omni-ad/queue';
import {
  generateAdText,
  generateAdImage,
  generateAdVideo,
  adaptForPlatform,
} from '@omni-ad/ai-engine';
import { resolveApiKey } from '../utils/resolve-api-key.js';

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(`[creative-generation] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
  error(message, meta) {
    process.stderr.write(`[creative-generation] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
  },
};

export async function processCreativeGeneration(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  // Try each job type in order of specificity
  if (await tryProcessTextGeneration(job)) return;
  if (await tryProcessImageGeneration(job)) return;
  if (await tryProcessVideoGeneration(job)) return;
  if (await tryProcessPlatformAdaptation(job)) return;

  logger.error('Unrecognized creative generation job type', { jobName: job.name });
}

async function tryProcessTextGeneration(job: { name: string; data: unknown }): Promise<boolean> {
  const parsed = generateTextJobSchema.safeParse(job.data);
  if (!parsed.success) return false;

  const data: GenerateTextJob = parsed.data;
  logger.info('Generating ad text variants', {
    campaignId: data.campaignId,
    platforms: data.platforms,
    variantCount: data.variantCount,
    language: data.language,
  });

  try {
    // Resolve org-specific API keys (falls back to env vars)
    const [anthropicKey, openaiKey] = await Promise.all([
      resolveApiKey(data.organizationId, 'anthropic'),
      resolveApiKey(data.organizationId, 'openai'),
    ]);

    // Generate for each platform
    for (const platform of data.platforms) {
      const variants = await generateAdText(
        {
          productName: data.productInfo.name,
          productDescription: data.productInfo.description,
          targetAudience: data.productInfo.targetAudience,
          usp: data.productInfo.usp,
          platform: platform.toUpperCase(),
          language: data.language,
          keigoLevel: data.keigoLevel,
          maxHeadlineLength: 60,
          maxBodyLength: 200,
          variantCount: data.variantCount,
        },
        { anthropicApiKey: anthropicKey, openaiApiKey: openaiKey },
      );

      logger.info('Text variants generated', {
        campaignId: data.campaignId,
        platform,
        variantCount: variants.length,
        model: variants[0]?.model ?? 'unknown',
      });

      // TODO: Store variants in creativeVariants table
    }

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Text generation failed', {
      campaignId: data.campaignId,
      error: message,
    });
    throw err;
  }
}

async function tryProcessImageGeneration(job: { name: string; data: unknown }): Promise<boolean> {
  const parsed = generateImageJobSchema.safeParse(job.data);
  if (!parsed.success) return false;

  const data: GenerateImageJob = parsed.data;
  logger.info('Generating ad images', {
    creativeId: data.creativeId,
    dimensions: data.dimensions,
  });

  try {
    const openaiKey = await resolveApiKey(data.organizationId, 'openai');

    const images = await generateAdImage(
      {
        prompt: data.prompt,
        style: data.style ?? 'professional',
        dimensions: data.dimensions,
        brandColors: [],
      },
      { openaiApiKey: openaiKey },
    );

    logger.info('Images generated', {
      creativeId: data.creativeId,
      imageCount: images.length,
      model: images[0]?.model ?? 'unknown',
    });

    // TODO: Upload images to storage and update creative record
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Image generation failed', {
      creativeId: data.creativeId,
      error: message,
    });
    throw err;
  }
}

async function tryProcessVideoGeneration(job: { name: string; data: unknown }): Promise<boolean> {
  const parsed = generateVideoJobSchema.safeParse(job.data);
  if (!parsed.success) return false;

  const data: GenerateVideoJob = parsed.data;
  logger.info('Generating ad video', {
    creativeId: data.creativeId,
    duration: data.durationSeconds,
  });

  try {
    const runwayKey = await resolveApiKey(data.organizationId, 'runway');

    const durationMap: Record<string, 6 | 15 | 30> = {
      '6': 6,
      '15': 15,
      '30': 30,
    };
    const duration = durationMap[data.durationSeconds] ?? 15;

    const video = await generateAdVideo(
      {
        prompt: data.prompt,
        durationSeconds: duration,
        imageFrameUrls: data.imageFrameUrls ?? [],
        aspectRatio: '16:9',
      },
      { runwayApiKey: runwayKey },
    );

    logger.info('Video generated', {
      creativeId: data.creativeId,
      model: video.model,
      duration: video.durationSeconds,
    });

    // TODO: Upload video to storage and update creative record
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Video generation failed', {
      creativeId: data.creativeId,
      error: message,
    });
    throw err;
  }
}

async function tryProcessPlatformAdaptation(job: { name: string; data: unknown }): Promise<boolean> {
  const parsed = adaptToPlatformJobSchema.safeParse(job.data);
  if (!parsed.success) return false;

  const data: AdaptToPlatformJob = parsed.data;
  logger.info('Adapting creative for platform', {
    creativeId: data.creativeId,
    targetPlatform: data.targetPlatform,
  });

  try {
    const adapted = await adaptForPlatform({
      sourceContent: {
        headline: data.sourceContent.headline,
        body: data.sourceContent.body,
        cta: data.sourceContent.cta,
        imageUrl: data.sourceContent.imageUrl ?? null,
        videoUrl: data.sourceContent.videoUrl ?? null,
      },
      targetPlatform: data.targetPlatform,
      targetDimensions: { width: 1200, height: 628 },
      maxHeadlineLength: 60,
      maxBodyLength: 200,
    });

    logger.info('Creative adapted', {
      creativeId: data.creativeId,
      targetPlatform: adapted.platform,
    });

    // TODO: Store adapted variant in creativeVariants table
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Platform adaptation failed', {
      creativeId: data.creativeId,
      error: message,
    });
    throw err;
  }
}
