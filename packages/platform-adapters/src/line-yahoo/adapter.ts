import crypto from 'crypto';
import { Platform, PLATFORM_CREATIVE_SPECS, PLATFORM_RATE_LIMITS } from '@omni-ad/shared';
import type {
  OAuthTokens,
  ConnectionStatus,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  RealtimeMetrics,
  MetricsQuery,
  AudienceSegment,
  PlatformCreativeSpecs,
  RateLimitConfig,
} from '@omni-ad/shared';
import { BaseAdapter } from '../base-adapter.js';
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateAdGroupInput,
  UpdateAdGroupInput,
  CreateAdInput,
  UpdateAdInput,
  CreateAudienceInput,
  AudienceListData,
  CreativeUploadInput,
  ConversionStage,
  WebhookEvent,
} from '../types.js';

const LINE_DEFAULT_EVENT_NAMES: Record<ConversionStage, string> = {
  cv1: 'LINE_CLICK',
  cv2: 'LINE_REGISTER',
  cv3: 'FORM_SUBMIT',
  other: 'LINE_OTHER',
};

/**
 * Classifies a LINE/Yahoo webhook payload into a CV stage. LINE's
 * webhook bodies vary by tag type — payloads observed in the wild
 * include fields like event_type, event_name, action, type, and
 * tag. We look at the union of those keys (lowercased) and match
 * against well-known substrings. Anything we can't identify falls
 * through to 'other' and is recorded for later inspection.
 */
function classifyLineWebhookStage(payload: Record<string, unknown>): ConversionStage {
  const candidateKeys = ['event_type', 'eventType', 'event_name', 'eventName', 'action', 'type', 'tag'] as const;
  const raw = candidateKeys
    .map((k) => payload[k])
    .find((v): v is string => typeof v === 'string');
  if (!raw) return 'other';
  const normalized = raw.toLowerCase();
  if (normalized.includes('click') || normalized.includes('impression_click') || normalized.includes('widget')) {
    return 'cv1';
  }
  if (
    normalized.includes('friend_add') ||
    normalized.includes('friend-add') ||
    normalized.includes('add_friend') ||
    normalized.includes('register') ||
    normalized.includes('follow')
  ) {
    return 'cv2';
  }
  if (
    normalized.includes('form') ||
    normalized.includes('submit') ||
    normalized.includes('purchase') ||
    normalized.includes('checkout') ||
    normalized.includes('conversion')
  ) {
    return 'cv3';
  }
  return 'other';
}
import { LYClient } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_LY,
} from './mapper.js';
import type {
  LYCampaign,
  LYAdGroup,
  LYAd,
  LYInsights,
  LYAudience,
  LYListResponse,
  LYApiResponse,
  LYOAuthResponse,
} from './types.js';

const AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';

export class LineYahooAdapter extends BaseAdapter {
  private readonly client: LYClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    super(Platform.LINE_YAHOO);
    this.client = new LYClient();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'profile openid ads_read ads_write',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchLYToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );
    return buildTokens(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchLYToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );
    return buildTokens(response);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<LYApiResponse<{ accountId: string; name: string }>>(
        'accounts/me',
        {},
        accessToken,
      ),
    );
    return {
      platform: Platform.LINE_YAHOO,
      status: 'active',
      accountId: data.data.accountId,
      accountName: data.data.name,
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<LYListResponse<LYCampaign>>(
        `accounts/${accountId}/campaigns`,
        { limit: '1000' },
        accessToken,
      ),
    );
    return response.data.map(toNormalizedCampaign);
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<LYApiResponse<LYCampaign>>(
        `accounts/${accountId}/campaigns/${campaignId}`,
        {},
        accessToken,
      ),
    );
    return toNormalizedCampaign(response.data);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      campaignName: input.name,
      objective: OBJECTIVE_TO_LY[input.objective] ?? 'CONVERSIONS',
      status: 'PAUSED',
      startDate: formatDate(input.startDate),
      budget: input.totalBudget,
      dailyBudget: input.dailyBudget,
    };
    if (input.endDate) payload['endDate'] = formatDate(input.endDate);

    const response = await this.withRetry(() =>
      this.client.post<LYApiResponse<LYCampaign>>(
        `accounts/${accountId}/campaigns`,
        payload,
        accessToken,
      ),
    );
    return toNormalizedCampaign(response.data);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['campaignName'] = input.name;
    if (input.status) payload['status'] = input.status.toUpperCase();
    if (input.dailyBudget !== undefined) payload['dailyBudget'] = input.dailyBudget;
    if (input.totalBudget !== undefined) payload['budget'] = input.totalBudget;

    const response = await this.withRetry(() =>
      this.client.put<LYApiResponse<LYCampaign>>(
        `accounts/${accountId}/campaigns/${campaignId}`,
        payload,
        accessToken,
      ),
    );
    return toNormalizedCampaign(response.data);
  }

  async pauseCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'paused' }, accessToken);
  }

  async resumeCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'active' }, accessToken);
  }

  async deleteCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    this.checkRateLimit();
    await this.withRetry(() =>
      this.client.delete(`accounts/${accountId}/campaigns/${campaignId}`, accessToken),
    );
  }

  // --- Ad Groups --------------------------------------------------------------

  async getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<LYListResponse<LYAdGroup>>(
        `accounts/${accountId}/campaigns/${campaignId}/adgroups`,
        { limit: '1000' },
        accessToken,
      ),
    );
    return response.data.map(toNormalizedAdGroup);
  }

  async createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      adGroupName: input.name,
      status: 'PAUSED',
      ...(input.platformSpecificConfig ?? {}),
    };

    const response = await this.withRetry(() =>
      this.client.post<LYApiResponse<LYAdGroup>>(
        `accounts/${accountId}/campaigns/${campaignId}/adgroups`,
        payload,
        accessToken,
      ),
    );
    return toNormalizedAdGroup(response.data);
  }

  async updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['adGroupName'] = input.name;

    const response = await this.withRetry(() =>
      this.client.put<LYApiResponse<LYAdGroup>>(
        `accounts/${accountId}/adgroups/${adGroupId}`,
        payload,
        accessToken,
      ),
    );
    return toNormalizedAdGroup(response.data);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<LYListResponse<LYAd>>(
        `accounts/${accountId}/adgroups/${adGroupId}/ads`,
        { limit: '1000' },
        accessToken,
      ),
    );
    return response.data.map(toNormalizedAd);
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.post<LYApiResponse<LYAd>>(
        `accounts/${accountId}/adgroups/${adGroupId}/ads`,
        {
          adName: input.name,
          creativeId: input.creativeId,
          status: 'PAUSED',
          ...(input.platformSpecificConfig ?? {}),
        },
        accessToken,
      ),
    );
    return toNormalizedAd(response.data);
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['adName'] = input.name;
    if (input.status) payload['status'] = input.status.toUpperCase();

    const response = await this.withRetry(() =>
      this.client.put<LYApiResponse<LYAd>>(
        `accounts/${accountId}/ads/${adId}`,
        payload,
        accessToken,
      ),
    );
    return toNormalizedAd(response.data);
  }

  // --- Metrics ----------------------------------------------------------------

  async getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]> {
    this.checkRateLimit();
    const params: Record<string, string> = {
      startDate: formatDate(query.startDate),
      endDate: formatDate(query.endDate),
      granularity: query.granularity.toUpperCase(),
    };
    if (query.campaignId) params['campaignId'] = query.campaignId;
    if (query.adGroupId) params['adGroupId'] = query.adGroupId;

    const response = await this.withRetry(() =>
      this.client.get<LYListResponse<LYInsights>>(
        `accounts/${accountId}/insights`,
        params,
        accessToken,
      ),
    );
    return response.data.map(toNormalizedMetrics);
  }

  async getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics> {
    const today = new Date();
    const metrics = await this.getMetrics(
      accountId,
      { campaignId, startDate: today, endDate: today, granularity: 'daily' },
      accessToken,
    );
    const m = metrics[0];
    return {
      campaignId,
      platform: Platform.LINE_YAHOO,
      impressionsToday: m?.impressions ?? 0,
      clicksToday: m?.clicks ?? 0,
      conversionsToday: m?.conversions ?? 0,
      spendToday: m?.spend ?? 0,
      revenueToday: m?.revenue ?? 0,
      lastUpdated: new Date(),
    };
  }

  // --- Audiences --------------------------------------------------------------

  async getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<LYListResponse<LYAudience>>(
        `accounts/${accountId}/audiences`,
        { limit: '1000' },
        accessToken,
      ),
    );
    return response.data.map(toNormalizedAudience);
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.post<LYApiResponse<LYAudience>>(
        `accounts/${accountId}/audiences`,
        { audienceName: input.name, type: 'CUSTOMER_LIST' },
        accessToken,
      ),
    );
    return toNormalizedAudience(response.data);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const users: { type: string; value: string }[] = [];
    if (data.emails) {
      users.push(
        ...data.emails.map((e) => ({
          type: 'EMAIL',
          value: hashSha256(e.toLowerCase().trim()),
        })),
      );
    }
    if (data.phones) {
      users.push(
        ...data.phones.map((p) => ({
          type: 'PHONE',
          value: hashSha256(p.replace(/\D/g, '')),
        })),
      );
    }

    await this.withRetry(() =>
      this.client.post<unknown>(
        `accounts/${accountId}/audiences/${audienceId}/users`,
        { users },
        accessToken,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.LINE_YAHOO];
  }

  async uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const base64 =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const response = await this.withRetry(() =>
      this.client.post<LYApiResponse<{ creativeId: string }>>(
        `accounts/${accountId}/creatives`,
        {
          type: creative.type.toUpperCase(),
          filename: creative.filename,
          data: base64,
          mimeType: creative.mimeType,
        },
        accessToken,
      ),
    );
    return response.data.creativeId;
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.LINE_YAHOO];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    const payload = (body ?? {}) as Record<string, unknown>;
    const stage = classifyLineWebhookStage(payload);
    const eventName = LINE_DEFAULT_EVENT_NAMES[stage];
    return {
      platform: Platform.LINE_YAHOO,
      eventType: 'conversion',
      payload,
      receivedAt: new Date(),
      stage,
      eventName,
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean {
    const signature = headers['x-line-signature'];
    if (!signature) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

async function fetchLYToken(params: Record<string, string>): Promise<LYOAuthResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    const err = body as Record<string, unknown>;
    throw {
      message: String(err['error_description'] ?? 'OAuth error'),
      code: String(err['error'] ?? 'UNKNOWN'),
      status: response.status,
    };
  }
  return body as LYOAuthResponse;
}

function buildTokens(response: LYOAuthResponse): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: new Date(Date.now() + response.expires_in * 1000),
    scope: response.scope,
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
