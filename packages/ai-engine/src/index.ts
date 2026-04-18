// Creative Generation
export { generateAdText, type TextGenerationRequest, type GeneratedText, type TextGenerationOptions } from './creative/text-generator.js';
export { generateAdImage, type ImageGenerationRequest, type GeneratedImage, type ImageGenerationOptions } from './creative/image-generator.js';
export { generateAdVideo, type VideoGenerationRequest, type GeneratedVideo, type VideoGenerationOptions } from './creative/video-generator.js';
export { adaptForPlatform, type PlatformAdaptationRequest, type AdaptedCreative } from './creative/platform-adapter.js';

// Script-to-Video Pipeline
export { generateVideoScript, type VideoScript, type VideoScene, type ScriptGenerationInput, ScriptValidationError } from './creative/script-generator.js';
export { composeScenes, type SceneAsset, type CompositionResult, SceneGenerationError } from './creative/scene-compositor.js';
export { generateVoiceover, type VoiceoverRequest, type VoiceoverResult, type VoiceoverOptions, VoiceoverValidationError, VoiceoverGenerationError } from './creative/voiceover-generator.js';

// Budget Optimization
export { initializeArms, updateArm, computeAllocation, resetArm, type BanditArm, type BanditConfig, type AllocationResult } from './optimization/bandit.js';
export { forecastRoas, simulateBudgetChange, type ForecastInput, type ForecastResult, type SimulationInput, type SimulationResult } from './optimization/forecaster.js';
export { executeAllocationCycle, type AllocationRequest, type AllocationConstraints, type PlatformMetricsSummary } from './optimization/allocator.js';

// Attribution
export { computeMarkovAttribution, type TouchpointSequence, type AttributionResult } from './attribution/markov.js';
export { computeShapleyAttribution, type ShapleyInput, type ShapleyResult } from './attribution/shapley.js';

// Insights
export { generateInsights, type InsightInput, type Insight, type InsightType, type InsightSeverity, type InsightOptions } from './insights/index.js';

// Creative Intelligence
export { getCreativeRecommendations, recordPerformanceFeedback, registerCreativeFeatures, type CreativeFeatures, type PerformanceFeedback, type CreativeRecommendation } from './creative-intelligence/index.js';

// Japanese Seasonality Intelligence
export {
  getActiveEvents,
  getUpcomingEvents,
  getSeasonalMultiplier,
  getRecommendedKeywords,
  getRecommendedThemes,
  type SeasonalEvent,
  type IndustryImpact,
  type Industry,
} from './seasonality/japanese-calendar.js';

// Compliance
export {
  checkCreativeCompliance,
  type ComplianceResult,
  type ComplianceViolation,
  type CreativeInput,
} from './compliance/policy-checker.js';

// Unified Spend Orchestrator (pure core)
export {
  ALL_PLATFORMS,
  DEFAULT_REALLOCATION_OPTIONS,
  computePlatformROAS,
  computeReallocationPlan,
  computeWeightedRoas,
  overlapMultiplier,
  safeDivide as orchestratorSafeDivide,
  shouldAutoApply,
  type AutoApplyDecision,
  type AutoApplySettings,
  type MetricRow as OrchestratorMetricRow,
  type OverlapMatrix,
  type Platform as OrchestratorPlatform,
  type PlatformROAS,
  type ReallocationOptions,
  type ReallocationPlan,
  type ShiftEntry,
} from './orchestrator/index.js';
