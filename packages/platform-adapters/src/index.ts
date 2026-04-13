export type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateAdGroupInput,
  UpdateAdGroupInput,
  CreateAdInput,
  UpdateAdInput,
  CreateAudienceInput,
  AudienceListData,
  CreativeUploadInput,
  WebhookEventType,
  WebhookEvent,
  PlatformAdapter,
  // Re-exported shared types for convenience
  Platform,
  OAuthTokens,
  ConnectionStatus,
  RateLimitConfig,
  PlatformCreativeSpecs,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  RealtimeMetrics,
  MetricsQuery,
  AudienceSegment,
  TargetingConfig,
  CreativeContent,
  PlatformError,
  CampaignObjective,
  CampaignStatus,
} from './types.js';

export { BaseAdapter } from './base-adapter.js';
export { AdapterRegistry, adapterRegistry } from './adapter-registry.js';
export { initializeAdapters } from './init.js';

// Platform adapters
export { MetaAdapter } from './meta/index.js';
export { GoogleAdsAdapter } from './google/index.js';
export { XAdapter } from './x/index.js';
export { TikTokAdapter } from './tiktok/index.js';
export { LineYahooAdapter } from './line-yahoo/index.js';
export { AmazonAdsAdapter } from './amazon/index.js';
export { MicrosoftAdsAdapter } from './microsoft/index.js';
