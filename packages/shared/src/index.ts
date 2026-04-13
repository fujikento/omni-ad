// Types
export { Platform, PlatformErrorCode, DB_PLATFORM_TO_ENUM, isPlatformError } from './types/index.js';
export type {
  PlatformStatus,
  ConnectionStatus,
  OAuthTokens,
  RateLimitConfig,
  PlatformError,
  CampaignStatus,
  CampaignObjective,
  TargetingConfig,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  CreateCampaignInput,
  UpdateCampaignInput,
  NormalizedMetrics,
  MetricsQuery,
  RealtimeMetrics,
  MetricsSummary,
  CreativeType,
  CreativeContent,
  Creative,
  CreativeVariant,
  PlatformCreativeSpecs,
  AudienceRule,
  AudienceDefinition,
  AudienceSegment,
  AudienceOverlap,
  DistributionEstimate,
  BudgetAllocation,
  BudgetForecast,
  FunnelStage,
  Funnel,
  PlanTier,
  UserRole,
  Organization,
  User,
} from './types/index.js';

// Constants
export {
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_CREATIVE_SPECS,
  PLATFORM_RATE_LIMITS,
  PLAN_LIMITS,
} from './constants/index.js';

// Validators
export {
  createCampaignSchema,
  updateCampaignSchema,
  metricsQuerySchema,
  createAudienceSchema,
  budgetAllocationSchema,
  targetingConfigSchema,
} from './validators/index.js';
export type {
  CreateCampaignSchemaInput,
  UpdateCampaignSchemaInput,
  MetricsQuerySchemaInput,
  CreateAudienceSchemaInput,
  BudgetAllocationSchemaInput,
  TargetingConfigSchemaInput,
} from './validators/index.js';

// Utils
export {
  calculateRoas,
  calculateCtr,
  calculateCpc,
  calculateCpa,
  formatCurrency,
  countCharacterWidth,
} from './utils/index.js';
