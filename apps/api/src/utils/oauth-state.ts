import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-signed OAuth state parameter.
 *
 * Format: `payload.signature` where:
 * - payload = base64url(`organizationId|platform|userId|timestamp`)
 * - signature = HMAC-SHA256(payload, secret) truncated to 16 hex chars
 *
 * The userId ties the OAuth flow to the initiating user, preventing
 * an attacker from injecting tokens into another user's organization.
 * The timestamp provides replay protection (10-minute window).
 */

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getStateSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required for OAuth state signing');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex')
    .substring(0, 32);
}

export function createOAuthState(
  organizationId: string,
  platform: string,
  userId: string,
): string {
  const timestamp = Date.now().toString(36);
  const raw = `${organizationId}|${platform}|${userId}|${timestamp}`;
  const payload = Buffer.from(raw).toString('base64url');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export interface ParsedOAuthState {
  organizationId: string;
  platform: string;
  userId: string;
}

export function verifyOAuthState(state: string): ParsedOAuthState | null {
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payload = state.substring(0, dotIdx);
  const signature = state.substring(dotIdx + 1);

  // Verify HMAC signature (timing-safe)
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  // Decode and parse payload
  let decoded: string;
  try {
    decoded = Buffer.from(payload, 'base64url').toString('utf-8');
  } catch {
    return null;
  }

  const parts = decoded.split('|');
  if (parts.length !== 4) return null;

  const [organizationId, platform, userId, timestampStr] = parts as [string, string, string, string];

  // Check timestamp for replay protection
  const timestamp = parseInt(timestampStr, 36);
  if (isNaN(timestamp) || Date.now() - timestamp > STATE_MAX_AGE_MS) {
    return null;
  }

  return { organizationId, platform, userId };
}

export function getRedirectUri(): string {
  const base = process.env['OAUTH_REDIRECT_BASE_URL'] ?? 'http://localhost:3001';
  return `${base}/auth/callback`;
}

export function getFrontendUrl(): string {
  return process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
}
