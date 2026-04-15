import type {
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
} from '@omni-ad/shared';

// Re-export imported types that consumers of this package will need
export type {
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
};

// ---------------------------------------------------------------------------
// Campaign inputs
// ---------------------------------------------------------------------------

export interface CreateCampaignInput {
  name: string;
  objective: CampaignObjective;
  startDate: Date;
  endDate?: Date;
  totalBudget: number;
  dailyBudget: number;
  platformSpecificConfig?: Record<string, unknown>;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: CampaignStatus;
}

// ---------------------------------------------------------------------------
// Ad group inputs
// ---------------------------------------------------------------------------

export interface CreateAdGroupInput {
  name: string;
  targetingConfig: TargetingConfig;
  platformSpecificConfig?: Record<string, unknown>;
}

export type UpdateAdGroupInput = Partial<CreateAdGroupInput>;

// ---------------------------------------------------------------------------
// Ad inputs
// ---------------------------------------------------------------------------

export interface CreateAdInput {
  name: string;
  creativeId: string;
  platformSpecificConfig?: Record<string, unknown>;
}

export interface UpdateAdInput extends Partial<CreateAdInput> {
  status?: CampaignStatus;
}

// ---------------------------------------------------------------------------
// Audience inputs
// ---------------------------------------------------------------------------

export interface CreateAudienceInput {
  name: string;
  type: 'custom' | 'lookalike' | 'saved';
  definition: unknown;
}

export interface AudienceListData {
  emails?: string[];
  phones?: string[];
  deviceIds?: string[];
}

// ---------------------------------------------------------------------------
// Creative inputs
// ---------------------------------------------------------------------------

export interface CreativeUploadInput {
  type: 'image' | 'video';
  // Buffer for Node.js server-side uploads; string for base64-encoded content
  content: Buffer | string;
  filename: string;
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | 'conversion'
  | 'status_change'
  | 'policy_update'
  | 'budget_alert';

export type ConversionStage = 'cv1' | 'cv2' | 'cv3' | 'other';

export interface WebhookEvent {
  platform: Platform;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  receivedAt: Date;
  /**
   * Optional stage classification. Populated by LINE/Yahoo today; other
   * adapters may fill it later. Downstream conversion ingestion reads
   * this to pick the right event_name when writing to conversion_events.
   */
  stage?: ConversionStage;
  /**
   * Optional canonical event name derived from the stage, e.g.
   * "LINE_CLICK" for cv1. Consumers should prefer
   * LineYahooPlatformMapping.cvXEventName on the endpoint when
   * available, and fall back to this value.
   */
  eventName?: string;
}

// ---------------------------------------------------------------------------
// PlatformAdapter — the unified interface for all 7 ad platform adapters
//
// Design notes:
// - accessToken is passed per-call (not stored) for thread safety and
//   multi-account support without adapter re-instantiation.
// - All mutation methods return the updated entity so callers never need a
//   follow-up GET to observe the new state.
// - parseWebhook / verifyWebhookSignature are intentionally synchronous —
//   webhook handlers must be fast and must not await I/O before verifying.
// ---------------------------------------------------------------------------

export interface PlatformAdapter {
  readonly platform: Platform;

  // --- OAuth ------------------------------------------------------------------

  /** Returns the platform authorization URL to redirect the user to. */
  getAuthUrl(redirectUri: string, state: string): string;

  /** Exchanges a one-time authorization code for a token pair. */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  /** Obtains a fresh access token using the stored refresh token. */
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  /** Validates that the given access token is still active and returns account info. */
  validateConnection(accessToken: string): Promise<ConnectionStatus>;

  // --- Campaigns --------------------------------------------------------------

  getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]>;

  getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign>;

  createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign>;

  updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign>;

  pauseCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void>;

  resumeCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void>;

  deleteCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void>;

  // --- Ad groups --------------------------------------------------------------

  getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]>;

  createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup>;

  updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup>;

  // --- Ads --------------------------------------------------------------------

  getAds(accountId: string, adGroupId: string, accessToken: string): Promise<NormalizedAd[]>;

  createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd>;

  updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd>;

  // --- Metrics ----------------------------------------------------------------

  getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]>;

  getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics>;

  // --- Audiences --------------------------------------------------------------

  getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]>;

  createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment>;

  /**
   * Appends a hashed list (emails / phones / device IDs) to an existing custom
   * audience.  Hashing is the adapter's responsibility per each platform's spec.
   */
  uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void>;

  // --- Creatives --------------------------------------------------------------

  /** Returns the static creative constraints for this platform (dimensions, limits, etc.) */
  getCreativeSpecs(): PlatformCreativeSpecs;

  /**
   * Uploads a creative asset and returns the platform-assigned creative ID
   * that can later be referenced in CreateAdInput.creativeId.
   */
  uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string>;

  // --- Rate limits ------------------------------------------------------------

  /** Returns the static rate-limit configuration declared by this adapter. */
  getRateLimits(): RateLimitConfig;

  // --- Webhooks ---------------------------------------------------------------

  /**
   * Parses an inbound webhook request into a typed WebhookEvent.
   * Must be called AFTER verifyWebhookSignature.
   */
  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent;

  /**
   * Verifies the platform's HMAC / signature on the webhook payload.
   * Returns true when the signature is valid.
   */
  verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean;
}
