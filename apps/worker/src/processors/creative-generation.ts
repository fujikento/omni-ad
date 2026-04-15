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
import { db } from '@omni-ad/db';
import { creatives, creativeVariants } from '@omni-ad/db/schema';
import { eq, sql } from 'drizzle-orm';
import { resolveApiKey } from '../utils/resolve-api-key.js';

// Platform string type matching the DB platform enum used by creativeVariants.
type DbPlatform =
  | 'meta'
  | 'google'
  | 'x'
  | 'tiktok'
  | 'line_yahoo'
  | 'amazon'
  | 'microsoft';

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

      // Persist each variant: one creative row + one creativeVariants row per generated text.
      await persistTextVariants({
        organizationId: data.organizationId,
        platform: platform as DbPlatform,
        variants,
        productName: data.productInfo.name,
      });
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

    // TODO(storage): persist generated images to object storage (S3/GCS).
    // For now, merge the generated URLs/model into creatives.baseContent and
    // create per-platform creativeVariants rows so the data is queryable.
    await persistImageResults({
      creativeId: data.creativeId,
      platforms: data.platforms as DbPlatform[],
      images,
    });
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

    // TODO(storage): persist generated video to object storage (S3/GCS).
    // For now, merge the generated URL/metadata into creatives.baseContent
    // and create per-platform creativeVariants rows.
    await persistVideoResult({
      creativeId: data.creativeId,
      platforms: data.platforms as DbPlatform[],
      video,
    });
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

    await persistAdaptedVariant({
      creativeId: data.creativeId,
      targetPlatform: data.targetPlatform as DbPlatform,
      adapted,
    });
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

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface GeneratedTextVariant {
  headline: string;
  body: string;
  cta: string;
  variant: number;
  model: string;
}

async function persistTextVariants(args: {
  organizationId: string;
  platform: DbPlatform;
  variants: GeneratedTextVariant[];
  productName: string;
}): Promise<void> {
  // Text jobs do not carry a creativeId (only campaignId), so we create a new
  // creative row per generated variant and a paired creativeVariants row.
  for (const variant of args.variants) {
    const [creative] = await db
      .insert(creatives)
      .values({
        organizationId: args.organizationId,
        type: 'text',
        baseContent: {
          headline: variant.headline,
          body: variant.body,
          cta: variant.cta,
          variantIndex: variant.variant,
        },
        aiGenerated: true,
        promptUsed: `Text generation for ${args.productName} on ${args.platform}`,
        modelUsed: variant.model,
      })
      .returning();

    if (!creative) continue;

    await db.insert(creativeVariants).values({
      creativeId: creative.id,
      platform: args.platform,
      adaptedContent: {
        headline: variant.headline,
        body: variant.body,
        cta: variant.cta,
      },
      width: 1200,
      height: 628,
      format: 'text',
    });
  }
}

async function persistImageResults(args: {
  creativeId: string;
  platforms: DbPlatform[];
  images: { url: string; width: number; height: number; model: string }[];
}): Promise<void> {
  if (args.images.length === 0) return;

  // Merge the first image URL + all image URLs into creatives.baseContent so
  // consumers can render the primary image without a storage hop yet.
  const imageUrls = args.images.map((i) => i.url);
  const primary = args.images[0];
  if (!primary) return;

  const patch: Record<string, unknown> = {
    imageUrl: primary.url,
    imageUrls,
    imageModel: primary.model,
  };

  await db
    .update(creatives)
    .set({
      baseContent: sql`${creatives.baseContent} || ${JSON.stringify(patch)}::jsonb`,
      modelUsed: primary.model,
      updatedAt: sql`now()`,
    })
    .where(eq(creatives.id, args.creativeId));

  // Create one variant row per requested platform, pairing the first image
  // dimensions (storage/multi-size handled later in TODO(storage)).
  for (const platform of args.platforms) {
    await db.insert(creativeVariants).values({
      creativeId: args.creativeId,
      platform,
      adaptedContent: {
        imageUrl: primary.url,
        imageUrls,
      },
      width: primary.width,
      height: primary.height,
      format: 'image',
      fileUrl: primary.url,
    });
  }
}

async function persistVideoResult(args: {
  creativeId: string;
  platforms: DbPlatform[];
  video: {
    url: string;
    durationSeconds: number;
    aspectRatio: string;
    model: string;
  };
}): Promise<void> {
  const patch: Record<string, unknown> = {
    videoUrl: args.video.url,
    videoDurationSeconds: args.video.durationSeconds,
    videoAspectRatio: args.video.aspectRatio,
    videoModel: args.video.model,
  };

  await db
    .update(creatives)
    .set({
      baseContent: sql`${creatives.baseContent} || ${JSON.stringify(patch)}::jsonb`,
      modelUsed: args.video.model,
      updatedAt: sql`now()`,
    })
    .where(eq(creatives.id, args.creativeId));

  // Default to 1200x628 when aspect ratio parsing is non-trivial; refined
  // per-platform sizing is handled once storage upload is implemented.
  for (const platform of args.platforms) {
    await db.insert(creativeVariants).values({
      creativeId: args.creativeId,
      platform,
      adaptedContent: {
        videoUrl: args.video.url,
        durationSeconds: args.video.durationSeconds,
        aspectRatio: args.video.aspectRatio,
      },
      width: 1200,
      height: 628,
      format: 'video',
      fileUrl: args.video.url,
    });
  }
}

async function persistAdaptedVariant(args: {
  creativeId: string;
  targetPlatform: DbPlatform;
  adapted: {
    headline: string;
    body: string;
    cta: string;
    imageUrl: string | null;
    videoUrl: string | null;
    platform: string;
    dimensions: { width: number; height: number };
  };
}): Promise<void> {
  const format = args.adapted.videoUrl
    ? 'video'
    : args.adapted.imageUrl
      ? 'image'
      : 'text';

  await db.insert(creativeVariants).values({
    creativeId: args.creativeId,
    platform: args.targetPlatform,
    adaptedContent: {
      headline: args.adapted.headline,
      body: args.adapted.body,
      cta: args.adapted.cta,
      imageUrl: args.adapted.imageUrl,
      videoUrl: args.adapted.videoUrl,
    },
    width: args.adapted.dimensions.width,
    height: args.adapted.dimensions.height,
    format,
    fileUrl: args.adapted.videoUrl ?? args.adapted.imageUrl ?? null,
  });
}
