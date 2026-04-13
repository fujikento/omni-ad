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
import { AmazonAdsClient } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_AMAZON_TYPE,
  formatAmazonDate,
} from './mapper.js';
import type {
  AmazonCampaign,
  AmazonAdGroup,
  AmazonAd,
  AmazonMetrics,
  AmazonAudience,
  AmazonOAuthResponse,
  AmazonProfile,
} from './types.js';

const AUTH_URL = 'https://apac.account.amazon.com/ap/oa';
const TOKEN_URL = 'https://api.amazon.co.jp/auth/o2/token';

export class AmazonAdsAdapter extends BaseAdapter {
  private readonly client: AmazonAdsClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    super(Platform.AMAZON);
    this.client = new AmazonAdsClient(clientId);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'advertising::campaign_management',
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchAmazonToken({
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
      fetchAmazonToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );
    return buildTokens(response, refreshToken);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const profiles = await this.withRetry(() =>
      this.client.get<AmazonProfile[]>('profiles', {}, accessToken),
    );
    const profile = profiles[0];
    return {
      platform: Platform.AMAZON,
      status: 'active',
      accountId: profile?.profileId ?? 'unknown',
      accountName: profile?.accountInfo.name ?? 'Amazon Advertising Account',
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const campaigns = await this.withRetry(() =>
      this.client.get<AmazonCampaign[]>(
        'sp/campaigns',
        { count: '1000' },
        accessToken,
        accountId,
      ),
    );
    return campaigns.map(toNormalizedCampaign);
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const campaign = await this.withRetry(() =>
      this.client.get<AmazonCampaign>(
        `sp/campaigns/${campaignId}`,
        {},
        accessToken,
        accountId,
      ),
    );
    return toNormalizedCampaign(campaign);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const campaignType = OBJECTIVE_TO_AMAZON_TYPE[input.objective] ?? 'sponsoredProducts';
    const endpoint = `${campaignType}/campaigns`;

    const payload: Record<string, unknown> = {
      name: input.name,
      targetingType: 'auto',
      state: 'paused',
      dailyBudget: input.dailyBudget,
      startDate: formatAmazonDate(input.startDate),
    };
    if (input.endDate) payload['endDate'] = formatAmazonDate(input.endDate);

    const results = await this.withRetry(() =>
      this.client.post<{ campaignId?: string }[]>(endpoint, [payload], accessToken, accountId),
    );

    const newId = results[0]?.campaignId;
    if (!newId) throwNotFound('Campaign', 'new');
    return this.getCampaign(accountId, newId, accessToken);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = { campaignId };
    if (input.name) payload['name'] = input.name;
    if (input.status) payload['state'] = input.status === 'active' ? 'enabled' : input.status;
    if (input.dailyBudget !== undefined) payload['dailyBudget'] = input.dailyBudget;

    await this.withRetry(() =>
      this.client.put<unknown>('sp/campaigns', [payload], accessToken, accountId),
    );
    return this.getCampaign(accountId, campaignId, accessToken);
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
      this.client.delete(`sp/campaigns/${campaignId}`, accessToken, accountId),
    );
  }

  // --- Ad Groups --------------------------------------------------------------

  async getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]> {
    this.checkRateLimit();
    const adGroups = await this.withRetry(() =>
      this.client.get<AmazonAdGroup[]>(
        'sp/adGroups',
        { campaignIdFilter: campaignId, count: '1000' },
        accessToken,
        accountId,
      ),
    );
    return adGroups.map(toNormalizedAdGroup);
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
      campaignId,
      defaultBid: 1.0,
      state: 'paused',
      ...(input.platformSpecificConfig ?? {}),
    };

    const results = await this.withRetry(() =>
      this.client.post<{ adGroupId?: string }[]>('sp/adGroups', [payload], accessToken, accountId),
    );

    const newId = results[0]?.adGroupId;
    if (!newId) throwNotFound('AdGroup', 'new');

    const adGroup = await this.withRetry(() =>
      this.client.get<AmazonAdGroup>(`sp/adGroups/${newId}`, {}, accessToken, accountId),
    );
    return toNormalizedAdGroup(adGroup);
  }

  async updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = { adGroupId };
    if (input.name) payload['name'] = input.name;

    await this.withRetry(() =>
      this.client.put<unknown>('sp/adGroups', [payload], accessToken, accountId),
    );

    const adGroup = await this.withRetry(() =>
      this.client.get<AmazonAdGroup>(`sp/adGroups/${adGroupId}`, {}, accessToken, accountId),
    );
    return toNormalizedAdGroup(adGroup);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const ads = await this.withRetry(() =>
      this.client.get<AmazonAd[]>(
        'sp/productAds',
        { adGroupIdFilter: adGroupId, count: '1000' },
        accessToken,
        accountId,
      ),
    );
    return ads.map(toNormalizedAd);
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      adGroupId,
      asin: input.creativeId,
      state: 'paused',
      ...(input.platformSpecificConfig ?? {}),
    };

    const results = await this.withRetry(() =>
      this.client.post<{ adId?: string }[]>('sp/productAds', [payload], accessToken, accountId),
    );

    const newId = results[0]?.adId;
    if (!newId) throwNotFound('Ad', 'new');

    const ad = await this.withRetry(() =>
      this.client.get<AmazonAd>(`sp/productAds/${newId}`, {}, accessToken, accountId),
    );
    return toNormalizedAd(ad);
    void input;
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = { adId };
    if (input.status) payload['state'] = input.status === 'active' ? 'enabled' : input.status;

    await this.withRetry(() =>
      this.client.put<unknown>('sp/productAds', [payload], accessToken, accountId),
    );

    const ad = await this.withRetry(() =>
      this.client.get<AmazonAd>(`sp/productAds/${adId}`, {}, accessToken, accountId),
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
    const payload: Record<string, unknown> = {
      reportDate: formatAmazonDate(query.startDate),
      metrics: [
        'impressions', 'clicks', 'purchases1d', 'spend', 'sales1d',
        'clickThroughRate', 'costPerClick', 'returnOnAdSpend', 'costPerPurchase',
      ],
    };
    if (query.campaignId) payload['campaignIdFilter'] = query.campaignId;
    if (query.adGroupId) payload['adGroupIdFilter'] = query.adGroupId;

    const report = await this.withRetry(() =>
      this.client.post<AmazonMetrics[]>(
        'sp/campaigns/report',
        payload,
        accessToken,
        accountId,
      ),
    );
    return report.map(toNormalizedMetrics);
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
      platform: Platform.AMAZON,
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
    const audiences = await this.withRetry(() =>
      this.client.get<AmazonAudience[]>(
        'audiences',
        { profileIdFilter: accountId },
        accessToken,
        accountId,
      ),
    );
    return audiences.map(toNormalizedAudience);
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const created = await this.withRetry(() =>
      this.client.post<{ audienceId: string }>(
        'audiences',
        { name: input.name, type: 'remarketing', profileId: accountId },
        accessToken,
        accountId,
      ),
    );

    const audience = await this.withRetry(() =>
      this.client.get<AmazonAudience>(
        `audiences/${created.audienceId}`,
        {},
        accessToken,
        accountId,
      ),
    );
    return toNormalizedAudience(audience);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const records: string[] = [
      ...(data.emails?.map((e) => hashSha256(e.toLowerCase().trim())) ?? []),
      ...(data.phones?.map((p) => hashSha256(p.replace(/\D/g, ''))) ?? []),
    ];

    await this.withRetry(() =>
      this.client.post<unknown>(
        `audiences/${audienceId}/records`,
        { records, action: 'ADD' },
        accessToken,
        accountId,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.AMAZON];
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
      this.client.post<{ assetId: string }>(
        'assets',
        {
          name: creative.filename,
          assetType: creative.type === 'video' ? 'VIDEO' : 'IMAGE',
          data: base64,
          mimeType: creative.mimeType,
        },
        accessToken,
        accountId,
      ),
    );
    return response.assetId;
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.AMAZON];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    return {
      platform: Platform.AMAZON,
      eventType: 'conversion',
      payload: body as Record<string, unknown>,
      receivedAt: new Date(),
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean {
    const signature = headers['x-amz-signature'];
    if (!signature) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

async function fetchAmazonToken(params: Record<string, string>): Promise<AmazonOAuthResponse> {
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
  return body as AmazonOAuthResponse;
}

function buildTokens(response: AmazonOAuthResponse, existingRefresh?: string): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? existingRefresh ?? '',
    expiresAt: new Date(Date.now() + response.expires_in * 1000),
    scope: 'advertising::campaign_management',
  };
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function throwNotFound(entity: string, id: string): never {
  throw { message: `${entity} not found: ${id}`, code: 'NOT_FOUND', status: 404 };
}
