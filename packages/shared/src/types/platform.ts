export enum Platform {
  META = 'META',
  GOOGLE = 'GOOGLE',
  X = 'X',
  TIKTOK = 'TIKTOK',
  LINE_YAHOO = 'LINE_YAHOO',
  AMAZON = 'AMAZON',
  MICROSOFT = 'MICROSOFT',
}

/**
 * Lowercase DB / URL strings for each platform. Useful as the source of
 * truth for both runtime parsing and strictly-typed lookups.
 */
export type DbPlatformKey =
  | 'meta'
  | 'google'
  | 'x'
  | 'tiktok'
  | 'line_yahoo'
  | 'amazon'
  | 'microsoft';

/**
 * Runtime parser: the key is widened to `string` so untrusted input
 * (URL params, webhook payloads) can be looked up safely — the result
 * is `Platform | undefined`. When the key is already a `DbPlatformKey`,
 * use `dbPlatformToEnum()` instead to keep strict typing.
 */
export const DB_PLATFORM_TO_ENUM: Record<string, Platform> = {
  meta: Platform.META,
  google: Platform.GOOGLE,
  x: Platform.X,
  tiktok: Platform.TIKTOK,
  line_yahoo: Platform.LINE_YAHOO,
  amazon: Platform.AMAZON,
  microsoft: Platform.MICROSOFT,
};

const DB_PLATFORM_TO_ENUM_TYPED: Record<DbPlatformKey, Platform> = {
  meta: Platform.META,
  google: Platform.GOOGLE,
  x: Platform.X,
  tiktok: Platform.TIKTOK,
  line_yahoo: Platform.LINE_YAHOO,
  amazon: Platform.AMAZON,
  microsoft: Platform.MICROSOFT,
};

/** Strictly typed lookup — never returns undefined for a valid DbPlatformKey. */
export function dbPlatformToEnum(key: DbPlatformKey): Platform {
  return DB_PLATFORM_TO_ENUM_TYPED[key];
}

export function isPlatformError(value: unknown): value is PlatformError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'retryable' in value
  );
}

export enum PlatformErrorCode {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export type PlatformStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface ConnectionStatus {
  platform: Platform;
  status: PlatformStatus;
  accountId: string;
  accountName: string;
  lastSyncAt: Date | null;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstLimit: number;
}

export interface PlatformError {
  code: PlatformErrorCode;
  message: string;
  platformCode: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
}
