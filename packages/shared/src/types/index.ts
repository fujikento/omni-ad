export { Platform, PlatformErrorCode, DB_PLATFORM_TO_ENUM, isPlatformError } from './platform.js';
export type {
  PlatformStatus,
  ConnectionStatus,
  OAuthTokens,
  RateLimitConfig,
  PlatformError,
} from './platform.js';

export type {
  CampaignStatus,
  CampaignObjective,
  TargetingConfig,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  CreateCampaignInput,
  UpdateCampaignInput,
} from './campaign.js';

export type {
  NormalizedMetrics,
  MetricsQuery,
  RealtimeMetrics,
  MetricsSummary,
} from './metrics.js';

export type {
  CreativeType,
  CreativeContent,
  Creative,
  CreativeVariant,
  PlatformCreativeSpecs,
} from './creative.js';

export type {
  AudienceRule,
  AudienceDefinition,
  AudienceSegment,
  AudienceOverlap,
} from './audience.js';

export type {
  DistributionEstimate,
  BudgetAllocation,
  BudgetForecast,
} from './budget.js';

export type { FunnelStage, Funnel } from './funnel.js';

export type { PlanTier, UserRole, Organization, User } from './organization.js';
