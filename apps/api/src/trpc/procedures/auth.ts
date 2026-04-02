import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@omni-ad/db";
import { organizations, users } from "@omni-ad/db/schema";
import { eq } from "drizzle-orm";
import {
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  InvalidTokenError,
  TokenExpiredError,
} from "@omni-ad/auth";
import type { UserRole } from "@omni-ad/auth";
import { publicProcedure, protectedProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Password hashing (scrypt via node:crypto)
// ---------------------------------------------------------------------------

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(':');
  if (!saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(keyHex, 'hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  if (derived.length !== storedKey.length) return false;
  return timingSafeEqual(derived, storedKey);
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const RegisterInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
  organizationName: z.string().min(1).max(200),
});

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshInput = z.object({
  refreshToken: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTokenResponse(
  userId: string,
  organizationId: string,
  userRole: UserRole,
): { accessToken: string; refreshToken: string } {
  const accessToken = signToken({ userId, organizationId, userRole });
  const refreshToken = signRefreshToken(userId);
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const authRouter = router({
  register: publicProcedure
    .input(RegisterInput)
    .mutation(async ({ input }) => {
      // Check for existing user with same email
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      const passwordHash = await hashPassword(input.password);

      // Create organization and user in a transaction
      const result = await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({
            name: input.organizationName,
            plan: "starter",
            billingEmail: input.email,
          })
          .returning();

        if (!org) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create organization",
          });
        }

        const [user] = await tx
          .insert(users)
          .values({
            organizationId: org.id,
            email: input.email,
            name: input.name,
            role: "owner",
            passwordHash,
          })
          .returning();

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user",
          });
        }

        return { org, user };
      });

      const tokens = buildTokenResponse(
        result.user.id,
        result.org.id,
        "owner",
      );

      return {
        ...tokens,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          organizationId: result.org.id,
          organizationName: result.org.name,
        },
      };
    }),

  login: publicProcedure
    .input(LoginInput)
    .mutation(async ({ input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email),
        with: { organization: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Update last login timestamp
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const tokens = buildTokenResponse(
        user.id,
        user.organizationId,
        user.role as UserRole,
      );

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        },
      };
    }),

  refresh: publicProcedure
    .input(RefreshInput)
    .mutation(async ({ input }) => {
      let refreshPayload: { sub: string; exp: number };

      try {
        refreshPayload = verifyRefreshToken(input.refreshToken);
      } catch (err: unknown) {
        if (err instanceof TokenExpiredError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Refresh token has expired, please log in again",
          });
        }
        if (err instanceof InvalidTokenError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid refresh token",
          });
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Token verification failed",
        });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, refreshPayload.sub),
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      const accessToken = signToken({
        userId: user.id,
        organizationId: user.organizationId,
        userRole: user.role,
      });

      const refreshToken = signRefreshToken(user.id);

      return { accessToken, refreshToken };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      with: { organization: true },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }),
});
