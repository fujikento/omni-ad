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
import { resolve } from "node:path";

const PORT = Number(process.env["PORT"] ?? 3001);
const HOST = process.env["HOST"] ?? "0.0.0.0";

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
      // Exempt health and pixel tracking routes
      if (
        request.url === "/health" ||
        request.url.startsWith("/track/")
      ) {
        return 0; // 0 = unlimited (exempt)
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

    // TODO: Route to platform-specific webhook handler service
    // Each handler should verify the webhook signature before processing
    server.log.info(
      { platform, contentType: request.headers["content-type"] },
      `Received webhook from ${platform}`
    );

    return reply.status(200).send({ received: true });
  });

  return server;
}

async function main(): Promise<void> {
  const server = buildServer();

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
