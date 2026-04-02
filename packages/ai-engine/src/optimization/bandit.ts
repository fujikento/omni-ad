/**
 * Thompson Sampling Combinatorial Bandit for Budget Optimization
 *
 * This is the core differentiating algorithm for OMNI-AD.
 * It determines optimal budget allocation across ad platforms
 * using Bayesian exploration/exploitation.
 */

export interface BanditArm {
  platform: string;
  alpha: number; // Beta distribution success parameter
  beta: number; // Beta distribution failure parameter
  totalSpend: number;
  totalRevenue: number;
  observations: number;
  roasHistory: number[]; // rolling ROAS observations for change-point detection
}

export interface AllocationResult {
  allocations: Record<string, number>;
  expectedRoas: Record<string, number>;
  confidence: Record<string, number>;
  explorationRate: number;
}

export interface BanditConfig {
  totalBudget: number;
  platforms: string[];
  minBudgetPerPlatform: number;
  maxBudgetPerPlatform: number;
  priorAlpha: number;
  priorBeta: number;
}

/**
 * Box-Muller transform: produces a standard normal sample from two uniform samples.
 */
function sampleStandardNormal(): number {
  let u: number, v: number, s: number;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
}

/**
 * Sample from Beta(alpha, beta) via the Gamma-ratio method.
 * Uses Wilson-Hilferty normal approximation for Gamma sampling,
 * which is accurate when alpha, beta > 1.
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    // Boost and correct: Gamma(shape) = Gamma(shape+1) * U^(1/shape)
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  // Marsaglia-Tsang method
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = sampleStandardNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    const x2 = x * x;
    if (u < 1 - 0.0331 * x2 * x2) return d * v;
    if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  const total = x + y;
  return total === 0 ? 0.5 : x / total;
}

/**
 * Detect structural break in ROAS history using rolling z-score.
 * Returns true when latest observation deviates > 2 std from rolling mean.
 */
function detectChangePoint(roasHistory: number[]): boolean {
  const windowSize = 10;
  if (roasHistory.length < windowSize + 1) return false;

  const window = roasHistory.slice(-windowSize - 1, -1);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
  const std = Math.sqrt(variance);
  if (std === 0) return false;

  const latest = roasHistory[roasHistory.length - 1] ?? 0;
  return Math.abs(latest - mean) > 2 * std;
}

export function resetArm(arm: BanditArm): BanditArm {
  return {
    ...arm,
    alpha: 1,
    beta: 1,
    roasHistory: [],
  };
}

export function initializeArms(config: BanditConfig): BanditArm[] {
  return config.platforms.map((platform) => ({
    platform,
    alpha: config.priorAlpha,
    beta: config.priorBeta,
    totalSpend: 0,
    totalRevenue: 0,
    observations: 0,
    roasHistory: [],
  }));
}

export function updateArm(
  arm: BanditArm,
  spend: number,
  revenue: number,
): BanditArm {
  const roas = spend > 0 ? revenue / spend : 0;
  const success = roas >= 1 ? 1 : 0;
  const updatedHistory = [...arm.roasHistory, roas];

  const updated: BanditArm = {
    ...arm,
    alpha: arm.alpha + success,
    beta: arm.beta + (1 - success),
    totalSpend: arm.totalSpend + spend,
    totalRevenue: arm.totalRevenue + revenue,
    observations: arm.observations + 1,
    roasHistory: updatedHistory,
  };

  // Auto-reset on structural break so the bandit adapts to new regime
  if (detectChangePoint(updatedHistory)) {
    return resetArm(updated);
  }

  return updated;
}

export function computeAllocation(
  arms: BanditArm[],
  config: BanditConfig,
  numSamples = 1000,
): AllocationResult {
  const { totalBudget, minBudgetPerPlatform, maxBudgetPerPlatform } = config;
  const allocations: Record<string, number> = {};
  const expectedRoas: Record<string, number> = {};
  const confidence: Record<string, number> = {};

  const samples = arms.map((arm) => {
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < numSamples; i++) {
      const s = sampleBeta(arm.alpha, arm.beta);
      sum += s;
      sumSq += s * s;
    }
    const mean = sum / numSamples;
    const variance = sumSq / numSamples - mean * mean;
    return { platform: arm.platform, mean, std: Math.sqrt(Math.max(0, variance)) };
  });

  const n = arms.length;
  const minTotal = n * minBudgetPerPlatform;
  if (minTotal > totalBudget) {
    throw new Error(
      `minBudgetPerPlatform * platforms (${minTotal}) exceeds totalBudget (${totalBudget})`,
    );
  }

  const remainingAfterMin = totalBudget - minTotal;
  const totalScore = samples.reduce((sum, s) => sum + s.mean, 0);

  // Proportional allocation of the discretionary budget, capped at max
  const proportional: Record<string, number> = {};
  let assignedDiscretionary = 0;

  for (const sample of samples) {
    const share =
      totalScore > 0 ? (sample.mean / totalScore) * remainingAfterMin : remainingAfterMin / n;
    const capped = Math.min(share, maxBudgetPerPlatform - minBudgetPerPlatform);
    proportional[sample.platform] = capped;
    assignedDiscretionary += capped;
  }

  // Redistribute any budget left after capping (due to max constraints)
  let leftover = remainingAfterMin - assignedDiscretionary;
  if (leftover > 1e-9) {
    const uncapped = samples.filter(
      (s) => (proportional[s.platform] ?? 0) < maxBudgetPerPlatform - minBudgetPerPlatform,
    );
    const uncappedCount = uncapped.length;
    if (uncappedCount > 0) {
      const extra = leftover / uncappedCount;
      for (const s of uncapped) {
        const current = proportional[s.platform] ?? 0;
        const available = maxBudgetPerPlatform - minBudgetPerPlatform - current;
        const add = Math.min(extra, available);
        proportional[s.platform] = current + add;
        leftover -= add;
      }
    }
  }

  // Build final allocations and round to exact total
  let runningTotal = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample) continue;
    if (i === samples.length - 1) {
      // Last platform absorbs any rounding residual to ensure exact total
      allocations[sample.platform] = totalBudget - runningTotal;
    } else {
      const val = Math.round((minBudgetPerPlatform + (proportional[sample.platform] ?? 0)) * 100) / 100;
      allocations[sample.platform] = val;
      runningTotal += val;
    }
  }

  for (const sample of samples) {
    expectedRoas[sample.platform] = sample.mean;
    // Confidence based on 95% credible interval width relative to the mean.
    // Narrower interval = higher confidence. When mean is 0, fall back to
    // raw std penalty so we don't divide by zero.
    const intervalWidth = 2 * 1.96 * sample.std;
    confidence[sample.platform] =
      sample.mean > 0
        ? Math.max(0, Math.min(1, 1 - intervalWidth / sample.mean))
        : Math.max(0, 1 - intervalWidth);
  }

  const explorationRate =
    arms.reduce((sum, arm) => sum + (arm.observations < 10 ? 1 : 0), 0) / arms.length;

  return { allocations, expectedRoas, confidence, explorationRate };
}
