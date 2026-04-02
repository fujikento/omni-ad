/**
 * Conversion Tracking REST Routes
 *
 * REST endpoint for client-side JavaScript to submit conversion events.
 * This is a plain Fastify route (not tRPC) because it's called from
 * browser-side tracking pixels across different domains.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '@omni-ad/db';
import { conversionEndpoints } from '@omni-ad/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  recordConversion,
  EndpointNotFoundError,
  InvalidSignatureError,
  InvalidEventError,
} from '../services/conversion.service.js';

// ---------------------------------------------------------------------------
// Input validation schema
// ---------------------------------------------------------------------------

const ConversionEventBody = z.object({
  eventName: z.string().min(1).max(100),
  eventValue: z.string().optional(),
  currency: z.string().max(3).optional(),
  sourceUrl: z.string().url().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  externalClickId: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerConversionTrackingRoutes(
  server: FastifyInstance,
): void {
  // Store raw body for HMAC verification via onRequest hook
  server.addHook('onRequest', async (request) => {
    if (
      request.url.startsWith('/track/') &&
      request.method === 'POST'
    ) {
      const chunks: Buffer[] = [];
      for await (const chunk of request.raw) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      // Attach raw body to request for HMAC verification
      (request as RequestWithRawBody).rawBody = rawBody;
      // Parse body manually since we consumed the stream
      try {
        (request as RequestWithParsedBody).body = JSON.parse(rawBody);
      } catch {
        (request as RequestWithParsedBody).body = null;
      }
    }
  });

  // POST /track/:pixelId -- conversion event ingestion
  server.post<{
    Params: { pixelId: string };
    Body: unknown;
  }>('/track/:pixelId', async (request, reply) => {
    const { pixelId } = request.params;

    // Look up endpoint for CORS domain validation
    const endpoint = await db.query.conversionEndpoints.findFirst({
      where: and(
        eq(conversionEndpoints.pixelId, pixelId),
        eq(conversionEndpoints.active, true),
      ),
    });

    if (!endpoint) {
      return reply.status(404).send({ error: 'Unknown pixel ID' });
    }

    // CORS validation for allowed domains
    const origin = request.headers.origin;
    if (origin && endpoint.allowedDomains.length > 0) {
      if (!isDomainAllowed(origin, endpoint.allowedDomains)) {
        return reply.status(403).send({ error: 'Origin not allowed' });
      }

      setCorsHeaders(reply, origin);
    }

    // Validate body
    const parseResult = ConversionEventBody.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid event data',
        details: parseResult.error.issues,
      });
    }

    // Get raw body for HMAC verification
    const rawBody =
      (request as RequestWithRawBody).rawBody ??
      JSON.stringify(request.body);

    const headers = {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      signature: getSignatureHeader(request),
    };

    try {
      await recordConversion(pixelId, parseResult.data, headers, rawBody);
      return reply.status(204).send();
    } catch (error: unknown) {
      if (error instanceof EndpointNotFoundError) {
        return reply.status(404).send({ error: 'Unknown pixel ID' });
      }
      if (error instanceof InvalidSignatureError) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }
      if (error instanceof InvalidEventError) {
        return reply.status(422).send({ error: error.message });
      }

      server.log.error(
        { err: error, pixelId },
        'Failed to record conversion event',
      );
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // OPTIONS /track/:pixelId -- CORS preflight
  server.options<{
    Params: { pixelId: string };
  }>('/track/:pixelId', async (request, reply) => {
    const origin = request.headers.origin;

    if (origin) {
      setCorsHeaders(reply, origin);
      void reply.header('access-control-max-age', '86400');
    }

    return reply.status(204).send();
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestWithRawBody {
  rawBody?: string;
}

interface RequestWithParsedBody {
  body: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSignatureHeader(
  request: FastifyRequest,
): string | undefined {
  const header = request.headers['x-signature'];
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

function isDomainAllowed(
  origin: string,
  allowedDomains: string[],
): boolean {
  return allowedDomains.some((domain) => {
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1);
      try {
        const originHost = new URL(origin).hostname;
        return (
          originHost.endsWith(suffix) || originHost === domain.slice(2)
        );
      } catch {
        return false;
      }
    }
    try {
      return new URL(origin).hostname === domain;
    } catch {
      return false;
    }
  });
}

function setCorsHeaders(
  reply: { header: (key: string, value: string) => unknown },
  origin: string,
): void {
  void reply.header('access-control-allow-origin', origin);
  void reply.header('access-control-allow-methods', 'POST, OPTIONS');
  void reply.header(
    'access-control-allow-headers',
    'content-type, x-signature',
  );
}
