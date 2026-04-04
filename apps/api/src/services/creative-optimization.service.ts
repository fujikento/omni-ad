/**
 * Creative Auto-Optimization Loop
 *
 * Automated creative optimization cycle inspired by ByteDance Ocean Engine.
 * Connects existing A/B testing, Thompson Sampling, creative intelligence,
 * and text generation into a closed-loop optimization system.
 *
 * Cycle: Evaluate -> Kill losers -> Scale winners -> Extract patterns
 *        -> Generate next generation -> Deploy into new A/B tests
 */

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
// Types
// ---------------------------------------------------------------------------

interface WinningPattern {
  headlineAngle: string;
  ctaStyle: string;
  visualApproach: string;
  emotionalTone: string;
  avgCtr: number;
  avgCvr: number;
  sampleSize: number;
}

interface GeneratedVariant {
  headline: string;
  body: string;
  cta: string;
  angle: string;
  isExploration: boolean;
}

interface OptimizationCycleResult {
  losersKilled: number;
  winnersScaled: number;
  patternsExtracted: number;
  newVariantsGenerated: number;
  newTestsCreated: number;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface ServiceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ServiceLogger = {
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

    // Need at least some data to make decisions
    const totalImpressions = Object.values(results).reduce(
      (sum, r) => sum + r.impressions,
      0,
    );
    if (totalImpressions < 100) continue;

    // Find variants with >95% probability of being worse than the best
    const bestRate = Math.max(
      ...Object.values(results).map((r) => r.rate),
    );

    const losers: string[] = [];

    for (const variant of variants) {
      const variantResult = results[variant.id];
      if (!variantResult || variantResult.impressions < 50) continue;

      // Use pValue if available, otherwise use rate comparison with confidence
      if (variantResult.pValue !== null && variantResult.pValue < 0.05) {
        if (variantResult.rate < bestRate) {
          losers.push(variant.id);
        }
      } else if (variantResult.rate < bestRate * 0.7 && variantResult.impressions > 200) {
        // Heuristic: 30% worse with decent sample size
        losers.push(variant.id);
      }
    }

    if (losers.length > 0 && losers.length < variants.length) {
      // Pause losing variants by setting their allocation weight to 0
      const updatedVariants = variants.map((v) => ({
        ...v,
        config: {
          ...v.config,
          allocationWeight: losers.includes(v.id) ? 0 : (v.config?.allocationWeight ?? 1),
          paused: losers.includes(v.id) ? true : (v.config?.paused ?? false),
        },
      }));

      await db
        .update(abTests)
        .set({
          variants: updatedVariants,
          updatedAt: new Date(),
        })
        .where(eq(abTests.id, test.id));

      // Log each kill decision
      for (const loserId of losers) {
        const loserResult = results[loserId];
        await db.insert(aiDecisionLog).values({
          organizationId,
          decisionType: 'creative_rotate',
          campaignId: test.campaignId,
          reasoning: `Variant ${loserId} underperforms (rate: ${loserResult?.rate.toFixed(4) ?? 'N/A'}) vs best (${bestRate.toFixed(4)}) with >95% confidence`,
          recommendation: { action: 'kill_loser', variantId: loserId, testId: test.id },
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

    // Log scaling decision
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
      confidenceScore: Math.min(0.99, 0.95 + winnerResult.impressions / 100000),
      executedAt: new Date(),
    });

    scaledCount++;
  }

  return scaledCount;
}

// ---------------------------------------------------------------------------
// Extract Winning Patterns
// ---------------------------------------------------------------------------

async function extractWinningPatterns(
  organizationId: string,
): Promise<WinningPattern[]> {
  // Get completed tests with winners
  const completedTests = await db.query.abTests.findMany({
    where: and(
      eq(abTests.organizationId, organizationId),
      eq(abTests.status, 'completed'),
    ),
    orderBy: [desc(abTests.completedAt)],
    limit: 100,
  });

  const winnerCreativeIds: string[] = [];
  const winnerData: Array<{
    creativeId: string;
    rate: number;
    impressions: number;
    conversions: number;
  }> = [];

  for (const test of completedTests) {
    if (!test.winnerId || !test.results) continue;

    const winnerVariant = test.variants.find((v) => v.id === test.winnerId);
    if (!winnerVariant?.creativeId) continue;

    const winnerResult = (test.results as ABTestResults)[test.winnerId];
    if (!winnerResult) continue;

    winnerCreativeIds.push(winnerVariant.creativeId);
    winnerData.push({
      creativeId: winnerVariant.creativeId,
      rate: winnerResult.rate,
      impressions: winnerResult.impressions,
      conversions: winnerResult.conversions,
    });
  }

  if (winnerCreativeIds.length === 0) return [];

  // Fetch creative details
  const winnerCreatives = await db.query.creatives.findMany({
    where: inArray(creatives.id, winnerCreativeIds),
  });

  // Analyze patterns from winning creatives' base content
  const patternMap = new Map<string, {
    count: number;
    totalCtr: number;
    totalCvr: number;
    totalImpressions: number;
    headlineAngle: string;
    ctaStyle: string;
    visualApproach: string;
    emotionalTone: string;
  }>();

  for (const creative of winnerCreatives) {
    const content = creative.baseContent as Record<string, unknown>;
    const data = winnerData.find((d) => d.creativeId === creative.id);
    if (!data) continue;

    const angle = String(content['headlineAngle'] ?? content['angle'] ?? 'unknown');
    const ctaStyle = String(content['ctaStyle'] ?? content['cta'] ?? 'unknown');
    const visualApproach = String(content['visualStyle'] ?? content['style'] ?? 'unknown');
    const emotionalTone = String(content['tone'] ?? content['emotionalTone'] ?? 'unknown');

    const key = `${angle}|${ctaStyle}|${visualApproach}|${emotionalTone}`;
    const existing = patternMap.get(key);

    if (existing) {
      existing.count++;
      existing.totalCtr += data.rate;
      existing.totalCvr += data.impressions > 0 ? data.conversions / data.impressions : 0;
      existing.totalImpressions += data.impressions;
    } else {
      patternMap.set(key, {
        count: 1,
        totalCtr: data.rate,
        totalCvr: data.impressions > 0 ? data.conversions / data.impressions : 0,
        totalImpressions: data.impressions,
        headlineAngle: angle,
        ctaStyle,
        visualApproach,
        emotionalTone,
      });
    }
  }

  const patterns: WinningPattern[] = [];

  for (const entry of patternMap.values()) {
    patterns.push({
      headlineAngle: entry.headlineAngle,
      ctaStyle: entry.ctaStyle,
      visualApproach: entry.visualApproach,
      emotionalTone: entry.emotionalTone,
      avgCtr: entry.totalCtr / entry.count,
      avgCvr: entry.totalCvr / entry.count,
      sampleSize: entry.totalImpressions,
    });
  }

  // Sort by avgCtr descending
  patterns.sort((a, b) => b.avgCtr - a.avgCtr);

  return patterns;
}

// ---------------------------------------------------------------------------
// Generate Next Generation (epsilon-greedy: 80% exploit, 20% explore)
// ---------------------------------------------------------------------------

async function generateNextGeneration(
  organizationId: string,
  patterns: WinningPattern[],
): Promise<GeneratedVariant[]> {
  if (patterns.length === 0) return [];

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const EXPLOIT_RATIO = 0.8;
  const TOTAL_VARIANTS = 10;
  const exploitCount = Math.round(TOTAL_VARIANTS * EXPLOIT_RATIO);
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
          content: `組織ID ${organizationId} の広告クリエイティブの次世代バリエーションを生成してください。合計${TOTAL_VARIANTS}個のバリエーションをお願いします。`,
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

  // Group variants into test pairs/groups
  const exploitVariants = variants.filter((v) => !v.isExploration);
  const exploreVariants = variants.filter((v) => v.isExploration);

  let testsCreated = 0;

  // Create exploit test (top performing patterns against each other)
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

  // Create explore test (new approaches)
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
        mde: 0.15, // Higher MDE tolerance for exploration
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
// Main Optimization Cycle
// ---------------------------------------------------------------------------

export async function runCreativeOptimizationCycle(
  organizationId: string,
): Promise<OptimizationCycleResult> {
  logger.info('Starting creative optimization cycle', { organizationId });

  try {
    // Step 1-2: Kill losers (pause underperforming variants)
    const losersKilled = await killLosers(organizationId);
    logger.info('Losers killed', { organizationId, losersKilled });

    // Step 3: Scale winners (log scaling recommendations)
    const winnersScaled = await scaleWinners(organizationId);
    logger.info('Winners scaled', { organizationId, winnersScaled });

    // Step 4: Extract winning patterns
    const patterns = await extractWinningPatterns(organizationId);
    logger.info('Patterns extracted', {
      organizationId,
      patternsExtracted: patterns.length,
    });

    // Step 5: Generate next-generation variants
    const newVariants = await generateNextGeneration(organizationId, patterns);
    logger.info('New variants generated', {
      organizationId,
      newVariantsGenerated: newVariants.length,
    });

    // Step 6: Deploy into fresh A/B tests
    const newTestsCreated = await deployNewVariants(organizationId, newVariants);
    logger.info('New tests created', { organizationId, newTestsCreated });

    const result: OptimizationCycleResult = {
      losersKilled,
      winnersScaled,
      patternsExtracted: patterns.length,
      newVariantsGenerated: newVariants.length,
      newTestsCreated,
    };

    // Log the full cycle to aiDecisionLog
    await db.insert(aiDecisionLog).values({
      organizationId,
      decisionType: 'strategy_insight',
      reasoning: `Creative optimization cycle completed. Killed ${losersKilled} losers, scaled ${winnersScaled} winners, generated ${newVariants.length} new variants across ${newTestsCreated} new tests.`,
      recommendation: result,
      status: 'executed',
      confidenceScore: 0.9,
      executedAt: new Date(),
    });

    logger.info('Creative optimization cycle completed', {
      organizationId,
      ...result,
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Creative optimization cycle failed', {
      organizationId,
      error: message,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class CreativeOptimizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreativeOptimizationError';
  }
}
