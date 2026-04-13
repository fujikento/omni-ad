import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { MetaApiError, MetaBusinessUsage } from './types.js';

const BASE_URL = 'https://graph.facebook.com/v25.0';

interface RateLimitInfo {
  callCount: number;
  totalCpuTime: number;
  estimatedTimeToRegainAccessSeconds: number;
}

function isMetaApiError(value: unknown): value is MetaApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as Record<string, unknown>)['error'] === 'object'
  );
}

function parseRateLimitHeader(headerValue: string | null): RateLimitInfo | null {
  if (!headerValue) return null;

  try {
    const decoded = decodeURIComponent(headerValue);
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return null;

    // Header is keyed by business use case type; grab the first entry
    const entries = Object.values(parsed as Record<string, unknown>);
    const first = entries[0];
    if (!Array.isArray(first) || first.length === 0) return null;

    const usage = first[0] as MetaBusinessUsage;
    return {
      callCount: usage.call_count,
      totalCpuTime: usage.total_cputime,
      estimatedTimeToRegainAccessSeconds: usage.estimated_time_to_regain_access,
    };
  } catch {
    return null;
  }
}

function buildPlatformError(
  message: string,
  platformCode: string,
  status: number,
  retryAfterSeconds: number | null = null,
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
    retryAfterSeconds,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const rateLimitHeader = response.headers.get('x-business-use-case-usage');
  const rateLimitInfo = parseRateLimitHeader(rateLimitHeader);

  const body: unknown = await response.json();

  if (!response.ok) {
    if (isMetaApiError(body)) {
      const { error } = body;
      const retryAfter =
        rateLimitInfo && rateLimitInfo.estimatedTimeToRegainAccessSeconds > 0
          ? rateLimitInfo.estimatedTimeToRegainAccessSeconds
          : null;
      throw buildPlatformError(
        error.message,
        String(error.code),
        response.status,
        retryAfter,
      );
    }
    throw buildPlatformError('Meta API error', 'UNKNOWN', response.status);
  }

  return body as T;
}

export class MetaClient {
  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = this.buildUrl(path, { ...params, access_token: accessToken });
    const response = await fetch(url, { method: 'GET' });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
  ): Promise<T> {
    const url = this.buildUrl(path, { access_token: accessToken });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async delete(path: string, accessToken: string): Promise<void> {
    const url = this.buildUrl(path, { access_token: accessToken });
    const response = await fetch(url, { method: 'DELETE' });
    await parseResponse<unknown>(response);
  }
}
