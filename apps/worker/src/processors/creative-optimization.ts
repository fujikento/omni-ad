import {
  creativeOptimizationJobSchema,
  type CreativeOptimizationJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  abTests,
  aiDecisionLog,
  creatives,
  type ABTestVariant,
  type ABTestResults,
} from '@omni-ad/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

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
      `[creative-optimization] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[creative-optimization] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Kill Losers
// ---------------------------------------------------------------------------

async function killLosers(organizationId: string): Promise<number> {
  const runningTests = await db.query.abTests.findMany({
    where: and(
      eq(abTests.organizationId, organizationId),
      eq(abTests.status, 'running'),
    ),
  });

  let killedCount = 0;

  for (const test of runningTests) {
    if (!test.results) continue;

    const results = test.results as ABTestResults;
    const variants = test.variants;

    const totalImpressions = Object.values(results).reduce(
      (sum, r) => sum + r.impressions,
      0,
    );
    if (totalImpressions < 100) continue;

    const bestRate = Math.max(
      ...Object.values(results).map((r) => r.rate),
    );

    const losers: string[] = [];

    for (const variant of variants) {
      const variantResult = results[variant.id];
      if (!variantResult || variantResult.impressions < 50) continue;

      if (variantResult.pValue !== null && variantResult.pValue < 0.05) {
        if (variantResult.rate < bestRate) {
          losers.push(variant.id);
        }
      } else if (
        variantResult.rate < bestRate * 0.7 &&
        variantResult.impressions > 200
      ) {
        losers.push(variant.id);
      }
    }

    if (losers.length > 0 && losers.length < variants.length) {
      const updatedVariants = variants.map((v) => ({
        ...v,
        config: {
          ...v.config,
          allocationWeight: losers.includes(v.id)
            ? 0
            : (v.config?.allocationWeight ?? 1),
          paused: losers.includes(v.id) ? true : (v.config?.paused ?? false),
        },
      }));

      await db
        .update(abTests)
        .set({ variants: updatedVariants, updatedAt: new Date() })
        .where(eq(abTests.id, test.id));

      for (const loserId of losers) {
        const loserResult = results[loserId];
        await db.insert(aiDecisionLog).values({
          organizationId,
          decisionType: 'creative_rotate',
          campaignId: test.campaignId,
          reasoning: `Variant ${loserId} underperforms (rate: ${loserResult?.rate.toFixed(4) ?? 'N/A'}) vs best (${bestRate.toFixed(4)}) with >95% confidence`,
          recommendation: {
            action: 'kill_loser',
            variantId: loserId,
            testId: test.id,
          },
          action: { killed: true, variantId: loserId },
          status: 'executed',
          confidenceScore: 0.95,
          executedAt: new Date(),
        });
      }

      killedCount += losers.length;
    }
  }

  return killedCount;
}

// ---------------------------------------------------------------------------
// Scale Winners
// ---------------------------------------------------------------------------

async function scaleWinners(organizationId: string): Promise<number> {
  const completedTests = await db.query.abTests.findMany({
    where: and(
      eq(abTests.organizationId, organizationId),
      eq(abTests.status, 'completed'),
    ),
    orderBy: [desc(abTests.completedAt)],
    limit: 50,
  });

  let scaledCount = 0;

  for (const test of completedTests) {
    if (!test.winnerId || !test.results) continue;

    const winnerResult = (test.results as ABTestResults)[test.winnerId];
    if (!winnerResult) continue;

    await db.insert(aiDecisionLog).values({
      organizationId,
      decisionType: 'budget_adjust',
      campaignId: test.campaignId,
      reasoning: `Winner ${test.winnerId} confirmed (rate: ${winnerResult.rate.toFixed(4)}, impressions: ${winnerResult.impressions}). Recommend increasing budget share.`,
      recommendation: {
        action: 'scale_winner',
        winnerId: test.winnerId,
        testId: test.id,
        winnerRate: winnerResult.rate,
      },
      status: 'executed',
      confidenceScore: Math.min(
        0.99,
        0.95 + winnerResult.impressions / 100000,
      ),
      executedAt: new Date(),
    });

    scaledCount++;
  }

  return scaledCount;
}

// ---------------------------------------------------------------------------
// Extract Winning Patterns
// ---------------------------------------------------------------------------

interface WinningPattern {
  headlineAngle: string;
  ctaStyle: string;
  visualApproach: string;
  emotionalTone: string;
  avgCtr: number;
}

async function extractWinningPatterns(
  organizationId: string,
): Promise<WinningPattern[]> {
  const completedTests = await db.query.abTests.findMany({
    where: and(
      eq(abTests.organizationId, organizationId),
      eq(abTests.status, 'completed'),
    ),
    orderBy: [desc(abTests.completedAt)],
    limit: 100,
  });

  const winnerCreativeIds: string[] = [];
  const winnerRates = new Map<string, number>();

  for (const test of completedTests) {
    if (!test.winnerId || !test.results) continue;

    const winnerVariant = test.variants.find((v) => v.id === test.winnerId);
    if (!winnerVariant?.creativeId) continue;

    const winnerResult = (test.results as ABTestResults)[test.winnerId];
    if (!winnerResult) continue;

    winnerCreativeIds.push(winnerVariant.creativeId);
    winnerRates.set(winnerVariant.creativeId, winnerResult.rate);
  }

  if (winnerCreativeIds.length === 0) return [];

  const winnerCreatives = await db.query.creatives.findMany({
    where: inArray(creatives.id, winnerCreativeIds),
  });

  const patternMap = new Map<
    string,
    { count: number; totalCtr: number; pattern: WinningPattern }
  >();

  for (const creative of winnerCreatives) {
    const content = creative.baseContent as Record<string, unknown>;
    const rate = winnerRates.get(creative.id) ?? 0;

    const angle = String(
      content['headlineAngle'] ?? content['angle'] ?? 'unknown',
    );
    const ctaStyle = String(
      content['ctaStyle'] ?? content['cta'] ?? 'unknown',
    );
    const visualApproach = String(
      content['visualStyle'] ?? content['style'] ?? 'unknown',
    );
    const emotionalTone = String(
      content['tone'] ?? content['emotionalTone'] ?? 'unknown',
    );

    const key = `${angle}|${ctaStyle}|${visualApproach}|${emotionalTone}`;
    const existing = patternMap.get(key);

    if (existing) {
      existing.count++;
      existing.totalCtr += rate;
    } else {
      patternMap.set(key, {
        count: 1,
        totalCtr: rate,
        pattern: { headlineAngle: angle, ctaStyle, visualApproach, emotionalTone, avgCtr: 0 },
      });
    }
  }

  const patterns: WinningPattern[] = [];
  for (const entry of patternMap.values()) {
    entry.pattern.avgCtr = entry.totalCtr / entry.count;
    patterns.push(entry.pattern);
  }

  patterns.sort((a, b) => b.avgCtr - a.avgCtr);
  return patterns;
}

// ---------------------------------------------------------------------------
// Generate Next Generation
// ---------------------------------------------------------------------------

interface GeneratedVariant {
  headline: string;
  body: string;
  cta: string;
  angle: string;
  isExploration: boolean;
}

async function generateNextGeneration(
  _organizationId: string,
  patterns: WinningPattern[],
): Promise<GeneratedVariant[]> {
  if (patterns.length === 0) return [];

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const TOTAL_VARIANTS = 10;
  const exploitCount = Math.round(TOTAL_VARIANTS * 0.8);
  const exploreCount = TOTAL_VARIANTS - exploitCount;

  const topPatterns = patterns.slice(0, 3);
  const patternSummary = topPatterns
    .map(
      (p) =>
        `- Angle: ${p.headlineAngle}, CTA: ${p.ctaStyle}, Visual: ${p.visualApproach}, Tone: ${p.emotionalTone} (CTR: ${p.avgCtr.toFixed(4)})`,
    )
    .join('\n');

  const systemPrompt = [
    'あなたは広告クリエイティブの最適化専門家です。',
    '過去のA/Bテスト結果から勝利パターンを分析し、次世代のバリエーションを生成してください。',
    '',
    '勝利パターン:',
    patternSummary,
    '',
    `${exploitCount}個は勝利パターンを活用した「活用」バリエーション、`,
    `${exploreCount}個は新しいアプローチを試す「探索」バリエーションを生成してください。`,
  ].join('\n');

  const toolSchema = {
    name: 'output_variants',
    description: 'Output ad creative variants',
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
              angle: { type: 'string' },
              isExploration: { type: 'boolean' },
            },
            required: ['headline', 'body', 'cta', 'angle', 'isExploration'],
          },
        },
      },
      required: ['variants'],
    },
  };

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
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `広告クリエイティブの次世代バリエーションを合計${TOTAL_VARIANTS}個生成してください。`,
        },
      ],
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'output_variants' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  const bodyRecord = body as Record<string, unknown>;
  const content = bodyRecord['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (b['type'] === 'tool_use' && b['name'] === 'output_variants') {
      const input = b['input'] as Record<string, unknown>;
      return input['variants'] as GeneratedVariant[];
    }
  }

  throw new Error('Claude response did not include output_variants tool_use');
}

// ---------------------------------------------------------------------------
// Deploy New Variants
// ---------------------------------------------------------------------------

async function deployNewVariants(
  organizationId: string,
  variants: GeneratedVariant[],
): Promise<number> {
  if (variants.length < 2) return 0;

  const exploitVariants = variants.filter((v) => !v.isExploration);
  const exploreVariants = variants.filter((v) => v.isExploration);
  let testsCreated = 0;

  if (exploitVariants.length >= 2) {
    const abTestVariants: ABTestVariant[] = exploitVariants.map((v, idx) => ({
      id: `exploit-${idx}`,
      name: `${v.angle} - Exploit ${idx + 1}`,
      description: v.headline,
      config: {
        headline: v.headline,
        body: v.body,
        cta: v.cta,
        angle: v.angle,
        isExploration: false,
      },
    }));

    await db.insert(abTests).values({
      organizationId,
      name: `Auto-Optimization: Exploit (${new Date().toISOString().slice(0, 10)})`,
      testType: 'creative',
      metricType: 'ctr',
      variants: abTestVariants,
      trafficAllocation: { method: 'thompson_sampling' },
      statisticalConfig: {
        mde: 0.1,
        alpha: 0.05,
        power: 0.8,
        sequentialTesting: true,
      },
      requiredSampleSize: 5000,
      currentSampleSize: 0,
      status: 'draft',
    });

    testsCreated++;
  }

  if (exploreVariants.length >= 2) {
    const abTestVariants: ABTestVariant[] = exploreVariants.map((v, idx) => ({
      id: `explore-${idx}`,
      name: `${v.angle} - Explore ${idx + 1}`,
      description: v.headline,
      config: {
        headline: v.headline,
        body: v.body,
        cta: v.cta,
        angle: v.angle,
        isExploration: true,
      },
    }));

    await db.insert(abTests).values({
      organizationId,
      name: `Auto-Optimization: Explore (${new Date().toISOString().slice(0, 10)})`,
      testType: 'creative',
      metricType: 'ctr',
      variants: abTestVariants,
      trafficAllocation: { method: 'thompson_sampling' },
      statisticalConfig: {
        mde: 0.15,
        alpha: 0.1,
        power: 0.7,
        sequentialTesting: true,
      },
      requiredSampleSize: 3000,
      currentSampleSize: 0,
      status: 'draft',
    });

    testsCreated++;
  }

  return testsCreated;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processCreativeOptimization(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = creativeOptimizationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error('Invalid job data', { errors: parsed.error.issues });
    return;
  }

  const data: CreativeOptimizationJob = parsed.data;
  const organizationId = data.organizationId;

  logger.info('Starting creative optimization cycle', { organizationId });

  try {
    const losersKilled = await killLosers(organizationId);
    logger.info('Losers killed', { organizationId, losersKilled });

    const winnersScaled = await scaleWinners(organizationId);
    logger.info('Winners scaled', { organizationId, winnersScaled });

    const patterns = await extractWinningPatterns(organizationId);
    logger.info('Patterns extracted', {
      organizationId,
      patternsExtracted: patterns.length,
    });

    const newVariants = await generateNextGeneration(organizationId, patterns);
    logger.info('New variants generated', {
      organizationId,
      newVariantsGenerated: newVariants.length,
    });

    const newTestsCreated = await deployNewVariants(
      organizationId,
      newVariants,
    );
    logger.info('New tests created', { organizationId, newTestsCreated });

    // Log full cycle
    await db.insert(aiDecisionLog).values({
      organizationId,
      decisionType: 'strategy_insight',
      reasoning: `Creative optimization cycle completed. Killed ${losersKilled} losers, scaled ${winnersScaled} winners, generated ${newVariants.length} new variants across ${newTestsCreated} new tests.`,
      recommendation: {
        losersKilled,
        winnersScaled,
        patternsExtracted: patterns.length,
        newVariantsGenerated: newVariants.length,
        newTestsCreated,
      },
      status: 'executed',
      confidenceScore: 0.9,
      executedAt: new Date(),
    });

    logger.info('Creative optimization cycle completed', {
      organizationId,
      losersKilled,
      winnersScaled,
      patternsExtracted: patterns.length,
      newVariantsGenerated: newVariants.length,
      newTestsCreated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Creative optimization cycle failed', {
      organizationId,
      error: message,
    });
    throw err;
  }
}
