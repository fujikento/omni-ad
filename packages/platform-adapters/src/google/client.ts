import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { GoogleApiError } from './types.js';

const BASE_URL = 'https://googleads.googleapis.com/v18';

function isGoogleApiError(value: unknown): value is GoogleApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as Record<string, unknown>)['error'] === 'object'
  );
}

function buildPlatformError(
  message: string,
  platformCode: string,
  status: number,
): PlatformError {
  let code: PlatformErrorCode;

  if (status === 401 || status === 403) {
    code = PlatformErrorCode.AUTH_EXPIRED;
  } else if (status === 404) {
    code = PlatformErrorCode.NOT_FOUND;
  } else if (status === 429) {
    code = PlatformErrorCode.RATE_LIMITED;
  } else if (status >= 400 && status < 500) {
    code = PlatformErrorCode.INVALID_REQUEST;
  } else {
    code = PlatformErrorCode.INTERNAL_ERROR;
  }

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
    if (isGoogleApiError(body)) {
      const { error } = body;
      const platformCode = error.status ?? String(error.code);
      throw buildPlatformError(error.message, platformCode, response.status);
    }
    throw buildPlatformError('Google Ads API error', 'UNKNOWN', response.status);
  }

  return body as T;
}

/** Normalizes a customer ID by stripping dashes: "123-456-7890" -> "1234567890" */
export function normalizeCustomerId(customerId: string): string {
  return customerId.replace(/-/g, '');
}

export class GoogleAdsClient {
  private readonly developerToken: string;

  constructor(developerToken: string) {
    this.developerToken = developerToken;
  }

  private buildHeaders(accessToken: string, loginCustomerId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };
    if (loginCustomerId) {
      headers['login-customer-id'] = normalizeCustomerId(loginCustomerId);
    }
    return headers;
  }

  async get<T>(
    path: string,
    accessToken: string,
    loginCustomerId?: string,
  ): Promise<T> {
    const url = `${BASE_URL}/${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(accessToken, loginCustomerId),
    });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
    loginCustomerId?: string,
  ): Promise<T> {
    const url = `${BASE_URL}/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(accessToken, loginCustomerId),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  /**
   * Executes a GAQL query via the searchStream endpoint.
   * Returns all results across pages.
   */
  async query<T>(
    customerId: string,
    gaql: string,
    accessToken: string,
    loginCustomerId?: string,
  ): Promise<T[]> {
    const normalized = normalizeCustomerId(customerId);
    const path = `customers/${normalized}/googleAds:search`;
    const body = { query: gaql };

    const response = await this.post<{ results?: T[]; nextPageToken?: string }>(
      path,
      body,
      accessToken,
      loginCustomerId,
    );

    return response.results ?? [];
  }

  /**
   * Mutates resources (create, update, remove) via the mutate endpoint.
   */
  async mutate<T>(
    customerId: string,
    resource: string,
    operations: Record<string, unknown>[],
    accessToken: string,
    loginCustomerId?: string,
  ): Promise<T> {
    const normalized = normalizeCustomerId(customerId);
    const path = `customers/${normalized}/${resource}:mutate`;
    return this.post<T>(path, { operations }, accessToken, loginCustomerId);
  }
}
