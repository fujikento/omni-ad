import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JwtPayload {
  userId: string;
  organizationId: string;
  userRole: string;
  exp: number;
  iat: number;
}

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class JwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

export class TokenExpiredError extends JwtError {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends JwtError {
  constructor(detail: string) {
    super(`Invalid token: ${detail}`);
    this.name = 'InvalidTokenError';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'HS256';
const DEFAULT_ACCESS_EXPIRY_SECONDS = 60 * 60; // 1 hour
const REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

const JWT_HEADER = JSON.stringify({ alg: ALGORITHM, typ: 'JWT' });
const ENCODED_HEADER = base64urlEncode(JWT_HEADER);

// ---------------------------------------------------------------------------
// Secret
// ---------------------------------------------------------------------------

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlEncodeBuffer(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signing
// ---------------------------------------------------------------------------

function sign(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function signToken(
  payload: Omit<JwtPayload, 'exp' | 'iat'>,
  expiresInSeconds: number = DEFAULT_ACCESS_EXPIRY_SECONDS,
): string {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${ENCODED_HEADER}.${encodedPayload}`;
  const signature = base64urlEncodeBuffer(sign(signingInput, secret));

  return `${signingInput}.${signature}`;
}

export function verifyToken(token: string): JwtPayload {
  const secret = getJwtSecret();

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidTokenError('malformed token structure');
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  // Validate header matches expected algorithm before checking signature
  if (headerPart !== ENCODED_HEADER) {
    throw new InvalidTokenError('unexpected token header');
  }

  // Verify signature using timing-safe comparison
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = sign(signingInput, secret);
  const actualSigPadded = signaturePart + '='.repeat((4 - (signaturePart.length % 4)) % 4);
  const actualSig = Buffer.from(
    actualSigPadded.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new InvalidTokenError('signature verification failed');
  }

  // Decode and validate payload
  let decoded: unknown;
  try {
    decoded = JSON.parse(base64urlDecode(payloadPart));
  } catch {
    throw new InvalidTokenError('payload is not valid JSON');
  }

  if (typeof decoded !== 'object' || decoded === null) {
    throw new InvalidTokenError('payload is not an object');
  }

  const payload = decoded as Record<string, unknown>;

  // Validate required fields
  if (
    typeof payload['userId'] !== 'string' ||
    typeof payload['organizationId'] !== 'string' ||
    typeof payload['userRole'] !== 'string' ||
    typeof payload['exp'] !== 'number' ||
    typeof payload['iat'] !== 'number'
  ) {
    throw new InvalidTokenError('missing required payload fields');
  }

  const jwtPayload: JwtPayload = {
    userId: payload['userId'] as string,
    organizationId: payload['organizationId'] as string,
    userRole: payload['userRole'] as string,
    exp: payload['exp'] as number,
    iat: payload['iat'] as number,
  };

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (jwtPayload.exp <= now) {
    throw new TokenExpiredError();
  }

  return jwtPayload;
}

export function signRefreshToken(userId: string): string {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: userId,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_EXPIRY_SECONDS,
  };

  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${ENCODED_HEADER}.${encodedPayload}`;
  const signature = base64urlEncodeBuffer(sign(signingInput, secret));

  return `${signingInput}.${signature}`;
}

export function verifyRefreshToken(token: string): { sub: string; exp: number } {
  const secret = getJwtSecret();

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidTokenError('malformed refresh token');
  }

  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  // Validate header matches expected algorithm before checking signature
  if (headerPart !== ENCODED_HEADER) {
    throw new InvalidTokenError('unexpected token header');
  }

  // Verify signature
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = sign(signingInput, secret);
  const actualSigPadded = signaturePart + '='.repeat((4 - (signaturePart.length % 4)) % 4);
  const actualSig = Buffer.from(
    actualSigPadded.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    throw new InvalidTokenError('refresh token signature failed');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(base64urlDecode(payloadPart));
  } catch {
    throw new InvalidTokenError('refresh token payload not valid JSON');
  }

  if (typeof decoded !== 'object' || decoded === null) {
    throw new InvalidTokenError('refresh token payload not an object');
  }

  const payload = decoded as Record<string, unknown>;

  if (payload['type'] !== 'refresh') {
    throw new InvalidTokenError('not a refresh token');
  }

  if (typeof payload['sub'] !== 'string' || typeof payload['exp'] !== 'number') {
    throw new InvalidTokenError('missing refresh token fields');
  }

  const now = Math.floor(Date.now() / 1000);
  if ((payload['exp'] as number) <= now) {
    throw new TokenExpiredError();
  }

  return {
    sub: payload['sub'] as string,
    exp: payload['exp'] as number,
  };
}
