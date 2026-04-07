import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import { appRouter } from "./trpc/router.js";
import type { AppRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { registerConversionTrackingRoutes } from "./routes/conversion-tracking.js";
import { registerUploadRoutes } from "./routes/upload.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

const PORT = Number(process.env["PORT"] ?? 3001);
const HOST = process.env["HOST"] ?? "0.0.0.0";

// ---------------------------------------------------------------------------
// Webhook Signature Verification
// ---------------------------------------------------------------------------

const WEBHOOK_SIGNATURE_HEADERS: Record<string, string> = {
  meta: "x-hub-signature-256",
  google: "x-goog-signature",
  tiktok: "x-tt-signature",
  line: "x-line-signature",
  x: "x-twitter-webhooks-signature",
  yahoo_japan: "x-yahoo-signature",
  stripe: "stripe-signature",
};

function verifyWebhookSignature(
  platform: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
): boolean {
  const envKey = `${platform.toUpperCase()}_WEBHOOK_SECRET`;
  const secret = process.env[envKey];
  if (!secret) return false;

  const headerName = WEBHOOK_SIGNATURE_HEADERS[platform];
  if (!headerName) return false;

  const rawSignature = headers[headerName];
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
  if (!signature) return false;

  const expectedSig =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  // Guard against length mismatch before timingSafeEqual
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
}

function buildServer(): ReturnType<typeof Fastify> {
  const server = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      ...(process.env["NODE_ENV"] === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true },
            },
          }
        : {}),
    },
    maxParamLength: 256,
  });

  // --- Plugins ---

  void server.register(cors, {
    origin: process.env["CORS_ORIGIN"]?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });

  void server.register(helmet, {
    contentSecurityPolicy: false,
  });

  // --- Rate Limiting ---

  void server.register(rateLimit, {
    global: true,
    max: (request) => {
      // Health check is exempt
      if (request.url === "/health") {
        return 0; // 0 = unlimited (exempt)
      }
      // Tracking pixel: generous but finite limit to prevent DoS
      if (request.url.startsWith("/track/")) {
        return 1000;
      }
      // Authenticated requests get higher limit
      const hasAuth = Boolean(request.headers.authorization);
      return hasAuth ? 100 : 20;
    },
    timeWindow: 60_000, // 1 minute
    keyGenerator: (request) => request.ip,
  });

  // --- Multipart (file uploads) ---

  void server.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // --- Static file serving (uploads) ---

  void server.register(fastifyStatic, {
    root: resolve(process.cwd(), "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // --- tRPC ---

  void server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path }) {
        server.log.error(
          { err: error, path },
          `tRPC error on ${path ?? "unknown"}`
        );
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // --- Health Check ---

  server.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // --- Conversion Tracking Routes ---

  registerConversionTrackingRoutes(server);

  // --- Upload Routes ---

  registerUploadRoutes(server);

  // --- Webhook Routes ---

  // Capture raw body for webhook signature verification
  server.addHook("onRequest", async (request) => {
    if (request.url.startsWith("/webhooks/") && request.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of request.raw) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      (request as unknown as Record<string, string>)["rawBody"] = rawBody;
      try {
        (request as unknown as Record<string, unknown>)["body"] =
          JSON.parse(rawBody);
      } catch {
        (request as unknown as Record<string, unknown>)["body"] = null;
      }
    }
  });

  server.post<{
    Params: { platform: string };
    Body: unknown;
  }>("/webhooks/:platform", async (request, reply) => {
    const { platform } = request.params;

    const supportedPlatforms = new Set([
      "google",
      "meta",
      "tiktok",
      "line",
      "x",
      "yahoo_japan",
      "stripe",
    ]);

    if (!supportedPlatforms.has(platform)) {
      return reply.status(404).send({
        error: "Unknown webhook platform",
        platform,
      });
    }

    // Verify webhook signature
    const rawBody =
      (request as unknown as Record<string, string>)["rawBody"] ?? "";
    if (!verifyWebhookSignature(platform, request.headers, rawBody)) {
      server.log.warn(
        { platform },
        `Webhook signature verification failed for ${platform}`,
      );
      return reply.status(403).send({
        error: "Invalid webhook signature",
      });
    }

    // TODO: Route to platform-specific webhook handler service
    server.log.info(
      { platform, contentType: request.headers["content-type"] },
      `Received verified webhook from ${platform}`,
    );

    return reply.status(200).send({ received: true });
  });

  return server;
}

function checkWebhookSecrets(logger: ReturnType<typeof Fastify>["log"]): void {
  const expectedSecrets = [
    "META_WEBHOOK_SECRET",
    "GOOGLE_WEBHOOK_SECRET",
    "TIKTOK_WEBHOOK_SECRET",
    "LINE_WEBHOOK_SECRET",
    "X_WEBHOOK_SECRET",
    "YAHOO_JAPAN_WEBHOOK_SECRET",
    "STRIPE_WEBHOOK_SECRET",
  ] as const;

  for (const envKey of expectedSecrets) {
    if (!process.env[envKey]) {
      logger.warn(
        `Missing webhook secret: ${envKey} — webhooks for this platform will always fail signature verification`,
      );
    }
  }
}

async function main(): Promise<void> {
  const server = buildServer();

  // --- Webhook Secret Validation ---
  checkWebhookSecrets(server.log);

  // --- Graceful Shutdown ---

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    process.on(signal, () => {
      server.log.info({ signal }, "Received shutdown signal");
      void server.close().then(() => {
        process.exit(0);
      });
    });
  }

  try {
    const address = await server.listen({ port: PORT, host: HOST });
    server.log.info(`OMNI-AD API server listening at ${address}`);
  } catch (err: unknown) {
    server.log.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

void main();
