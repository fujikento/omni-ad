import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { AmazonApiError } from './types.js';

const BASE_URL = 'https://advertising-api-fe.amazon.com/v3';

function isAmazonApiError(value: unknown): value is AmazonApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'details' in value
  );
}

function buildPlatformError(message: string, platformCode: string, status: number): PlatformError {
  let code: PlatformErrorCode;
  if (status === 401 || status === 403) code = PlatformErrorCode.AUTH_EXPIRED;
  else if (status === 404) code = PlatformErrorCode.NOT_FOUND;
  else if (status === 429) code = PlatformErrorCode.RATE_LIMITED;
  else if (status >= 400 && status < 500) code = PlatformErrorCode.INVALID_REQUEST;
  else code = PlatformErrorCode.INTERNAL_ERROR;

  return {
    code,
    message,
    platformCode,
    retryable: code === PlatformErrorCode.RATE_LIMITED || status >= 500,
    retryAfterSeconds: status === 429 ? 60 : null,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    if (isAmazonApiError(body)) {
      throw buildPlatformError(body.details, body.code, response.status);
    }
    throw buildPlatformError('Amazon Ads API error', 'UNKNOWN', response.status);
  }
  return body as T;
}

export class AmazonAdsClient {
  private readonly clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  private buildHeaders(
    accessToken: string,
    profileId?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Amazon-Advertising-API-ClientId': this.clientId,
      'Content-Type': 'application/json',
    };
    if (profileId) {
      headers['Amazon-Advertising-API-Scope'] = profileId;
    }
    return headers;
  }

  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
    profileId?: string,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const response = await fetch(url.toString(), {
      headers: this.buildHeaders(accessToken, profileId),
    });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown> | Record<string, unknown>[],
    accessToken: string,
    profileId?: string,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      headers: this.buildHeaders(accessToken, profileId),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async put<T>(
    path: string,
    body: Record<string, unknown> | Record<string, unknown>[],
    accessToken: string,
    profileId?: string,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'PUT',
      headers: this.buildHeaders(accessToken, profileId),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async delete(path: string, accessToken: string, profileId?: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'DELETE',
      headers: this.buildHeaders(accessToken, profileId),
    });
    await parseResponse<unknown>(response);
  }
}
