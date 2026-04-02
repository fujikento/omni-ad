import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { verifyToken } from "@omni-ad/auth";
import type { JwtPayload } from "@omni-ad/auth";

export interface Context {
  organizationId: string | null;
  userId: string | null;
  userRole: string | null;
}

function extractBearerPayload(
  authHeader: string | undefined,
): JwtPayload | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch {
    // Invalid or expired token -- public procedures still work
    return null;
  }
}

export function createContext({
  req,
}: CreateFastifyContextOptions): Context {
  const authHeader = req.headers.authorization;
  const payload = extractBearerPayload(authHeader);

  return {
    organizationId: payload?.organizationId ?? null,
    userId: payload?.userId ?? null,
    userRole: payload?.userRole ?? null,
  };
}
