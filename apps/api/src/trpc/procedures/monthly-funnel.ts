import { TRPCError } from "@trpc/server";
import { db } from "@omni-ad/db";
import { reports } from "@omni-ad/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  FunnelConfigurationError,
  FunnelNotFoundError,
  computeAnomalies,
  computeForecast,
  getAttribution,
  getCohortMatrix,
  getDrilldown,
  getPivot,
  type AttributionModel,
} from "../../services/monthly-funnel.service.js";
import { organizationProcedure, router } from "../trpc.js";

// ---------------------------------------------------------------------------
// Shared input fragments
// ---------------------------------------------------------------------------

const MonthString = z.string().regex(/^\d{4}-\d{2}$/, {
  message: "month must be in YYYY-MM format",
});

const FunnelId = z.string().uuid();

const AttributionModelInput = z.enum([
  "first_touch",
  "last_touch",
  "linear",
  "time_decay",
  "position_based",
]);

const MonthlyFunnelNoteType = "monthly_funnel_note" as const;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof FunnelNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
    });
  }
  if (error instanceof FunnelConfigurationError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Note payload type — lives inside reports.data JSONB
// ---------------------------------------------------------------------------

export interface MonthlyFunnelNote {
  funnelId: string;
  month: string;
  text: string;
  updatedBy: string;
}

function isNotePayload(value: unknown): value is MonthlyFunnelNote {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["funnelId"] === "string" &&
    typeof v["month"] === "string" &&
    typeof v["text"] === "string"
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const monthlyFunnelRouter = router({
  getPivot: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        endMonth: MonthString,
        monthCount: z.number().int().min(1).max(36).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getPivot(
          ctx.organizationId,
          input.funnelId,
          input.endMonth,
          input.monthCount,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getForecast: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        endMonth: MonthString,
        monthCount: z.number().int().min(6).max(36).default(12),
        horizon: z.number().int().min(1).max(12).default(3),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const pivot = await getPivot(
          ctx.organizationId,
          input.funnelId,
          input.endMonth,
          input.monthCount,
        );
        return {
          anomalies: computeAnomalies(pivot.months),
          forecast: computeForecast(pivot.months, input.horizon),
          meta: pivot.meta,
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getCohortMatrix: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        monthCount: z.number().int().min(1).max(24).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getCohortMatrix(
          ctx.organizationId,
          input.funnelId,
          input.monthCount,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getAttribution: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        month: MonthString,
        model: AttributionModelInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const model: AttributionModel = input.model;
        return await getAttribution(
          ctx.organizationId,
          input.funnelId,
          input.month,
          model,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  getDrilldown: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        month: MonthString,
        stageIndex: z.number().int().min(0).max(9),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await getDrilldown(
          ctx.organizationId,
          input.funnelId,
          input.month,
          input.stageIndex,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  upsertNote: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        month: MonthString,
        text: z.string().max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payload: MonthlyFunnelNote = {
        funnelId: input.funnelId,
        month: input.month,
        text: input.text,
        updatedBy: ctx.userId,
      };
      try {
        // ON CONFLICT targets the partial unique index introduced in
        // migration 0003: reports_monthly_funnel_note_uniq on
        //   ((data->>'funnelId'), (data->>'month')) WHERE type='monthly_funnel_note'.
        await db.execute(sql`
          INSERT INTO reports (organization_id, type, format, data, created_by)
          VALUES (
            ${ctx.organizationId}::uuid,
            ${MonthlyFunnelNoteType},
            'json',
            ${JSON.stringify(payload)}::jsonb,
            ${ctx.userId}::uuid
          )
          ON CONFLICT ((data->>'funnelId'), (data->>'month'))
            WHERE type = 'monthly_funnel_note'
          DO UPDATE SET
            data = EXCLUDED.data,
            generated_at = now(),
            created_by = EXCLUDED.created_by;
        `);
        return payload;
      } catch (error) {
        handleServiceError(error);
      }
    }),

  listNotes: organizationProcedure
    .input(
      z.object({
        funnelId: FunnelId,
        months: z.array(MonthString).min(1).max(60),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const rows = await db
          .select({ data: reports.data })
          .from(reports)
          .where(
            and(
              eq(reports.organizationId, ctx.organizationId),
              eq(reports.type, MonthlyFunnelNoteType),
              sql`${reports.data}->>'funnelId' = ${input.funnelId}`,
              sql`${reports.data}->>'month' = ANY(${input.months}::text[])`,
            ),
          );

        const out: Record<string, string> = {};
        for (const r of rows) {
          if (isNotePayload(r.data)) {
            out[r.data.month] = r.data.text;
          }
        }
        return out;
      } catch (error) {
        handleServiceError(error);
      }
    }),
});
