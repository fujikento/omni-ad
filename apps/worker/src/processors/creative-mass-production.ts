import {
  massProductionChunkJobSchema,
  type MassProductionChunkJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import { creatives, creativeVariants } from '@omni-ad/db/schema';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[creative-mass-production] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[creative-mass-production] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Claude API integration for batch text generation
// ---------------------------------------------------------------------------

interface MassTextVariant {
  headline: string;
  body: string;
  cta: string;
  headlineAngle: string;
  bodyApproach: string;
}

const MASS_PRODUCTION_TOOL_SCHEMA = {
  name: 'output_mass_variants',
  description: 'Output multiple ad copy variants as structured JSON',
  input_schema: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            body: { type: 'string' },
            cta: { type: 'string' },
            headlineAngle: { type: 'string' },
            bodyApproach: { type: 'string' },
          },
          required: [
            'headline',
            'body',
            'cta',
            'headlineAngle',
            'bodyApproach',
          ],
        },
      },
    },
    required: ['variants'],
  },
};

const KEIGO_INSTRUCTIONS: Record<string, string> = {
  casual: 'Use casual, friendly tone (tameguchi)',
  polite: 'Use polite desu/masu form',
  formal: 'Use formal keigo expressions',
};

const PLATFORM_CONTEXT: Record<string, string> = {
  meta: 'Facebook/Instagram — visual-first, emotional appeal',
  google: 'Google Search/Display — clear value proposition, keywords',
  x: 'X (Twitter) — concise, punchy, hashtag-friendly',
  tiktok: 'TikTok — casual, trendy, action-oriented',
  line_yahoo: 'LINE/Yahoo Japan — trusted, practical benefits',
  amazon: 'Amazon — product-focused, feature highlights',
  microsoft: 'Microsoft/Bing — professional, B2B friendly',
};

function buildMassProductionPrompt(data: MassProductionChunkJob): {
  system: string;
  user: string;
} {
  const platformCtx =
    PLATFORM_CONTEXT[data.platform] ?? data.platform;
  const keigoHint =
    data.language === 'ja'
      ? KEIGO_INSTRUCTIONS[data.keigoLevel] ?? ''
      : '';

  const combinationsList = data.combinations
    .map(
      (c, i) =>
        `${i + 1}. Headline angle: "${c.headlineAngle}", Body approach: "${c.bodyApproach}", CTA: "${c.ctaVariation}"`,
    )
    .join('\n');

  const system = [
    data.language === 'ja'
      ? 'You are an expert Japanese advertising copywriter.'
      : 'You are an expert advertising copywriter.',
    `Platform: ${platformCtx}`,
    keigoHint,
    `Generate one unique ad variant for EACH combination below.`,
    `Each variant must have a distinct headline, body, and CTA matching the specified angle/approach.`,
    `Keep headlines under 60 characters and body text under 200 characters.`,
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    `Product: ${data.productInfo.name}`,
    `Description: ${data.productInfo.description}`,
    `USP: ${data.productInfo.usp}`,
    `Target audience: ${data.productInfo.targetAudience}`,
    data.productInfo.price ? `Price: ${data.productInfo.price}` : '',
    '',
    'Generate variants for these combinations:',
    combinationsList,
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

function parseMassVariants(responseBody: unknown): MassTextVariant[] {
  const body = responseBody as Record<string, unknown>;
  const content = body['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_mass_variants'
    ) {
      const input = b['input'] as Record<string, unknown>;
      return input['variants'] as MassTextVariant[];
    }
  }

  throw new Error('Claude response did not include tool_use block');
}

async function generateChunkVariants(
  data: MassProductionChunkJob,
): Promise<MassTextVariant[]> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const { system, user } = buildMassProductionPrompt(data);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [MASS_PRODUCTION_TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'output_mass_variants' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  return parseMassVariants(body);
}

// ---------------------------------------------------------------------------
// Database storage
// ---------------------------------------------------------------------------

async function storeGeneratedCreatives(
  organizationId: string,
  platform: string,
  variants: MassTextVariant[],
): Promise<string[]> {
  const creativeIds: string[] = [];

  for (const variant of variants) {
    const [creative] = await db
      .insert(creatives)
      .values({
        organizationId,
        type: 'text',
        baseContent: {
          headline: variant.headline,
          body: variant.body,
          cta: variant.cta,
          headlineAngle: variant.headlineAngle,
          bodyApproach: variant.bodyApproach,
        },
        aiGenerated: true,
        promptUsed: `Mass production: ${variant.headlineAngle} / ${variant.bodyApproach}`,
        modelUsed: 'claude-sonnet-4-20250514',
      })
      .returning();

    if (!creative) continue;

    creativeIds.push(creative.id);

    // Create a platform variant
    await db.insert(creativeVariants).values({
      creativeId: creative.id,
      platform: platform as 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft',
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

  return creativeIds;
}

// ---------------------------------------------------------------------------
// Batch progress update (imports the service function)
// ---------------------------------------------------------------------------

// We call the DB directly here to avoid circular dependency with the API service
async function updateBatchProgress(
  batchId: string,
  completedCount: number,
  failedCount: number,
  newCreativeIds: string[],
): Promise<void> {
  const { creativeBatches } = await import('@omni-ad/db/schema');
  const { sql: sqlFn, eq: eqFn } = await import('drizzle-orm');

  await db
    .update(creativeBatches)
    .set({
      totalCompleted: sqlFn`${creativeBatches.totalCompleted} + ${completedCount}`,
      totalFailed: sqlFn`${creativeBatches.totalFailed} + ${failedCount}`,
      creativeIds: sqlFn`array_cat(${creativeBatches.creativeIds}, ${newCreativeIds}::text[])`,
      updatedAt: new Date(),
    })
    .where(eqFn(creativeBatches.id, batchId));

  // Check if batch is done
  const batch = await db.query.creativeBatches.findFirst({
    where: eqFn(creativeBatches.id, batchId),
  });

  if (!batch) return;

  const totalProcessed = batch.totalCompleted + batch.totalFailed;
  if (totalProcessed >= batch.totalRequested) {
    const finalStatus =
      batch.totalFailed > 0 && batch.totalCompleted === 0
        ? 'failed'
        : 'completed';

    await db
      .update(creativeBatches)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eqFn(creativeBatches.id, batchId));
  }
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processCreativeMassProduction(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = massProductionChunkJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error('Invalid job data', { errors: parsed.error.issues });
    return;
  }

  const data: MassProductionChunkJob = parsed.data;

  logger.info('Processing mass production chunk', {
    batchId: data.batchId,
    chunkIndex: data.chunkIndex,
    combinationCount: data.combinations.length,
    platform: data.platform,
  });

  try {
    // Check if batch was cancelled
    const { creativeBatches: batchTable } = await import(
      '@omni-ad/db/schema'
    );
    const { eq: eqCheck } = await import('drizzle-orm');
    const batch = await db.query.creativeBatches.findFirst({
      where: eqCheck(batchTable.id, data.batchId),
    });

    if (batch?.status === 'failed') {
      logger.info('Batch was cancelled, skipping chunk', {
        batchId: data.batchId,
      });
      return;
    }

    // Generate text variants via Claude
    const variants = await generateChunkVariants(data);

    // Store in DB
    const creativeIds = await storeGeneratedCreatives(
      data.organizationId,
      data.platform,
      variants,
    );

    const completedCount = creativeIds.length;
    const failedCount = data.combinations.length - completedCount;

    // Update batch progress
    await updateBatchProgress(
      data.batchId,
      completedCount,
      failedCount,
      creativeIds,
    );

    logger.info('Chunk completed', {
      batchId: data.batchId,
      chunkIndex: data.chunkIndex,
      generated: completedCount,
      failed: failedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Mass production chunk failed', {
      batchId: data.batchId,
      chunkIndex: data.chunkIndex,
      error: message,
    });

    // Update batch with failure count
    await updateBatchProgress(
      data.batchId,
      0,
      data.combinations.length,
      [],
    );

    throw err;
  }
}
