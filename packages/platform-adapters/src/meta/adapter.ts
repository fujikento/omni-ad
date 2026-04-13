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
  WebhookEvent,
} from '../types.js';
import { MetaClient } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  fromCreateCampaignInput,
} from './mapper.js';
import type {
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsights,
  MetaCustomAudience,
  MetaOAuthResponse,
  MetaApiResponse,
} from './types.js';

const AUTH_BASE = 'https://www.facebook.com/v25.0/dialog/oauth';
const TOKEN_ENDPOINT = 'oauth/access_token';

const CAMPAIGN_FIELDS =
  'id,name,objective,status,effective_status,start_time,stop_time,daily_budget,lifetime_budget,created_time,updated_time,account_id';

const AD_SET_FIELDS =
  'id,campaign_id,name,status,effective_status,targeting,daily_budget,lifetime_budget,start_time,end_time,created_time,updated_time';

const AD_FIELDS =
  'id,adset_id,campaign_id,name,status,effective_status,creative{id,name},created_time,updated_time';

const INSIGHTS_FIELDS =
  'campaign_id,adset_id,ad_id,date_start,date_stop,impressions,clicks,conversions,spend,revenue,ctr,cpc,cost_per_conversion,purchase_roas';

export class MetaAdapter extends BaseAdapter {
  private readonly client: MetaClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    super(Platform.META);
    this.client = new MetaClient();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'ads_management,ads_read,business_management',
      response_type: 'code',
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<MetaOAuthResponse>(TOKEN_ENDPOINT, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }, `${this.clientId}|${this.clientSecret}`),
    );
    return this.buildTokens(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    // Meta long-lived tokens don't use a standard refresh flow;
    // exchange the current long-lived token for a fresh one
    const response = await this.withRetry(() =>
      this.client.get<MetaOAuthResponse>(TOKEN_ENDPOINT, {
        grant_type: 'fb_exchange_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        fb_exchange_token: refreshToken,
      }, `${this.clientId}|${this.clientSecret}`),
    );
    return this.buildTokens(response);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<{ id: string; name: string }>('me', { fields: 'id,name' }, accessToken),
    );
    return {
      platform: Platform.META,
      status: 'active',
      accountId: data.id,
      accountName: data.name,
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaCampaign>>(
        `act_${accountId}/campaigns`,
        { fields: CAMPAIGN_FIELDS },
        accessToken,
      ),
    );
    return response.data.map(toNormalizedCampaign);
  }

  async getCampaign(
    _accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const campaign = await this.withRetry(() =>
      this.client.get<MetaCampaign>(campaignId, { fields: CAMPAIGN_FIELDS }, accessToken),
    );
    return toNormalizedCampaign(campaign);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload = fromCreateCampaignInput(input, accountId);
    const created = await this.withRetry(() =>
      this.client.post<{ id: string }>(`act_${accountId}/campaigns`, payload, accessToken),
    );
    return this.getCampaign(accountId, created.id, accessToken);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['name'] = input.name;
    if (input.status) payload['status'] = mapStatusToMeta(input.status);
    if (input.startDate) payload['start_time'] = input.startDate.toISOString();
    if (input.endDate) payload['stop_time'] = input.endDate.toISOString();
    if (input.dailyBudget !== undefined) {
      payload['daily_budget'] = Math.round(input.dailyBudget * 100).toString();
    }

    await this.withRetry(() =>
      this.client.post<unknown>(campaignId, payload, accessToken),
    );
    return this.getCampaign(accountId, campaignId, accessToken);
  }

  async pauseCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    await this.withRetry(() =>
      this.client.post<unknown>(campaignId, { status: 'PAUSED' }, accessToken),
    );
    void accountId;
  }

  async resumeCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    await this.withRetry(() =>
      this.client.post<unknown>(campaignId, { status: 'ACTIVE' }, accessToken),
    );
    void accountId;
  }

  async deleteCampaign(
    _accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    await this.withRetry(() => this.client.delete(campaignId, accessToken));
  }

  // --- Ad Groups (Ad Sets) ----------------------------------------------------

  async getAdGroups(
    _accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaAdSet>>(
        `${campaignId}/adsets`,
        { fields: AD_SET_FIELDS },
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
      name: input.name,
      campaign_id: campaignId,
      status: 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      targeting: buildMetaTargeting(input.targetingConfig),
      ...(input.platformSpecificConfig ?? {}),
    };

    const created = await this.withRetry(() =>
      this.client.post<{ id: string }>(`act_${accountId}/adsets`, payload, accessToken),
    );

    const adSet = await this.withRetry(() =>
      this.client.get<MetaAdSet>(created.id, { fields: AD_SET_FIELDS }, accessToken),
    );
    return toNormalizedAdGroup(adSet);
  }

  async updateAdGroup(
    _accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['name'] = input.name;
    if (input.targetingConfig) payload['targeting'] = buildMetaTargeting(input.targetingConfig);
    if (input.platformSpecificConfig) Object.assign(payload, input.platformSpecificConfig);

    await this.withRetry(() =>
      this.client.post<unknown>(adGroupId, payload, accessToken),
    );

    const adSet = await this.withRetry(() =>
      this.client.get<MetaAdSet>(adGroupId, { fields: AD_SET_FIELDS }, accessToken),
    );
    return toNormalizedAdGroup(adSet);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    _accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaAd>>(
        `${adGroupId}/ads`,
        { fields: AD_FIELDS },
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
    const payload: Record<string, unknown> = {
      name: input.name,
      adset_id: adGroupId,
      creative: { creative_id: input.creativeId },
      status: 'PAUSED',
      ...(input.platformSpecificConfig ?? {}),
    };

    const created = await this.withRetry(() =>
      this.client.post<{ id: string }>(`act_${accountId}/ads`, payload, accessToken),
    );

    const ad = await this.withRetry(() =>
      this.client.get<MetaAd>(created.id, { fields: AD_FIELDS }, accessToken),
    );
    return toNormalizedAd(ad);
  }

  async updateAd(
    _accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {};
    if (input.name) payload['name'] = input.name;
    if (input.status) payload['status'] = mapStatusToMeta(input.status);
    if (input.creativeId) payload['creative'] = { creative_id: input.creativeId };

    await this.withRetry(() =>
      this.client.post<unknown>(adId, payload, accessToken),
    );

    const ad = await this.withRetry(() =>
      this.client.get<MetaAd>(adId, { fields: AD_FIELDS }, accessToken),
    );
    return toNormalizedAd(ad);
  }

  // --- Metrics ----------------------------------------------------------------

  async getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]> {
    this.checkRateLimit();
    const params: Record<string, string> = {
      fields: INSIGHTS_FIELDS,
      time_range: JSON.stringify({
        since: formatDate(query.startDate),
        until: formatDate(query.endDate),
      }),
      time_increment: granularityToIncrement(query.granularity),
      level: query.adGroupId ? 'adset' : query.campaignId ? 'campaign' : 'account',
    };

    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaInsights>>(
        `act_${accountId}/insights`,
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
    this.checkRateLimit();
    const today = new Date();
    const params: Record<string, string> = {
      fields: INSIGHTS_FIELDS,
      time_range: JSON.stringify({
        since: formatDate(today),
        until: formatDate(today),
      }),
      level: 'campaign',
    };

    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaInsights>>(
        `${campaignId}/insights`,
        params,
        accessToken,
      ),
    );

    const insights = response.data[0];
    void accountId;

    return {
      campaignId,
      platform: Platform.META,
      impressionsToday: parseFloat(insights?.impressions ?? '0'),
      clicksToday: parseFloat(insights?.clicks ?? '0'),
      conversionsToday: parseFloat(insights?.conversions ?? '0'),
      spendToday: parseFloat(insights?.spend ?? '0'),
      revenueToday: parseFloat(insights?.revenue ?? '0'),
      lastUpdated: new Date(),
    };
  }

  // --- Audiences --------------------------------------------------------------

  async getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      this.client.get<MetaApiResponse<MetaCustomAudience>>(
        `act_${accountId}/customaudiences`,
        {
          fields:
            'id,account_id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,description',
        },
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
    const payload: Record<string, unknown> = {
      name: input.name,
      subtype: mapAudienceSubtype(input.type),
      ...(typeof input.definition === 'object' && input.definition !== null
        ? (input.definition as Record<string, unknown>)
        : {}),
    };

    const created = await this.withRetry(() =>
      this.client.post<{ id: string }>(`act_${accountId}/customaudiences`, payload, accessToken),
    );

    const audience = await this.withRetry(() =>
      this.client.get<MetaCustomAudience>(
        created.id,
        {
          fields:
            'id,account_id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,description',
        },
        accessToken,
      ),
    );
    return toNormalizedAudience(audience);
  }

  async uploadAudienceList(
    _accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const schema: string[] = [];
    const users: string[][] = [];

    if (data.emails?.length) {
      schema.push('EMAIL');
      data.emails.forEach((email, i) => {
        if (!users[i]) users[i] = [];
        users[i]!.push(hashSha256(email.toLowerCase().trim()));
      });
    }

    if (data.phones?.length) {
      schema.push('PHONE');
      data.phones.forEach((phone, i) => {
        if (!users[i]) users[i] = [];
        users[i]!.push(hashSha256(normalizePhone(phone)));
      });
    }

    await this.withRetry(() =>
      this.client.post<unknown>(
        `${audienceId}/users`,
        { payload: { schema, data: users } },
        accessToken,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.META];
  }

  async uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const base64Content =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const payload: Record<string, unknown> = {
      name: creative.filename,
      bytes: base64Content,
    };

    const endpoint =
      creative.type === 'video'
        ? `act_${accountId}/advideos`
        : `act_${accountId}/adimages`;

    const response = await this.withRetry(() =>
      this.client.post<{ id?: string; images?: Record<string, { hash: string }> }>(
        endpoint,
        payload,
        accessToken,
      ),
    );

    if (response.id) return response.id;
    if (response.images) {
      const firstKey = Object.keys(response.images)[0];
      if (firstKey) return response.images[firstKey]!.hash;
    }

    throw new Error('Meta creative upload returned no ID');
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.META];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(_headers: Record<string, string>, body: unknown): WebhookEvent {
    const payload = body as Record<string, unknown>;

    return {
      platform: Platform.META,
      eventType: detectMetaWebhookType(payload),
      payload: payload,
      receivedAt: new Date(),
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean {
    const signature = headers['x-hub-signature-256'];
    if (!signature) return false;

    const bodyString =
      typeof body === 'string' ? body : JSON.stringify(body);

    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  // --- Private helpers --------------------------------------------------------

  private buildTokens(response: MetaOAuthResponse): OAuthTokens {
    const expiresAt = new Date(Date.now() + (response.expires_in ?? 5184000) * 1000);
    return {
      accessToken: response.access_token,
      refreshToken: response.access_token, // Meta uses same token for refresh
      expiresAt,
      scope: 'ads_management,ads_read,business_management',
    };
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function mapStatusToMeta(status: string): string {
  const map: Record<string, string> = {
    active: 'ACTIVE',
    paused: 'PAUSED',
    completed: 'ARCHIVED',
    draft: 'PAUSED',
    error: 'PAUSED',
  };
  return map[status] ?? 'PAUSED';
}

function mapAudienceSubtype(type: 'custom' | 'lookalike' | 'saved'): string {
  const map: Record<string, string> = {
    custom: 'CUSTOM',
    lookalike: 'LOOKALIKE',
    saved: 'SAVED_AUDIENCE',
  };
  return map[type] ?? 'CUSTOM';
}

function buildMetaTargeting(config: import('@omni-ad/shared').TargetingConfig): Record<string, unknown> {
  return {
    age_min: config.ageMin ?? undefined,
    age_max: config.ageMax ?? undefined,
    genders: mapGendersToMeta(config.genders),
    geo_locations: config.locations.length > 0
      ? { countries: config.locations }
      : undefined,
    interests: config.interests.map((name) => ({ name })),
    custom_audiences: config.customAudiences.map((id) => ({ id })),
    excluded_custom_audiences: config.excludedAudiences.map((id) => ({ id })),
    locales: config.languages.length > 0 ? config.languages : undefined,
    device_platforms: mapDevicesToMeta(config.devices),
    publisher_platforms: config.placements.length > 0 ? config.placements : undefined,
  };
}

function mapGendersToMeta(
  genders: ('male' | 'female' | 'all')[],
): number[] | undefined {
  if (genders.includes('all')) return undefined;
  const result: number[] = [];
  if (genders.includes('male')) result.push(1);
  if (genders.includes('female')) result.push(2);
  return result.length > 0 ? result : undefined;
}

function mapDevicesToMeta(
  devices: ('mobile' | 'desktop' | 'tablet' | 'all')[],
): ('mobile' | 'desktop')[] | undefined {
  if (devices.includes('all')) return undefined;
  const result: ('mobile' | 'desktop')[] = [];
  if (devices.includes('mobile') || devices.includes('tablet')) result.push('mobile');
  if (devices.includes('desktop')) result.push('desktop');
  return result.length > 0 ? result : undefined;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function granularityToIncrement(granularity: MetricsQuery['granularity']): string {
  const map: Record<MetricsQuery['granularity'], string> = {
    hourly: '1',
    daily: '1',
    weekly: '7',
    monthly: 'monthly',
  };
  return map[granularity];
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function detectMetaWebhookType(
  payload: Record<string, unknown>,
): import('../types.js').WebhookEventType {
  if (payload['object'] === 'page' || payload['object'] === 'user') {
    return 'conversion';
  }
  if (
    typeof payload['entry'] === 'object' &&
    Array.isArray(payload['entry'])
  ) {
    return 'status_change';
  }
  return 'conversion';
}
