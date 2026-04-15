-- Indexes supporting the monthly-funnel analytics service.
--
-- 1. idx_conv_events_org_created_event
--    Powers the main monthly pivot aggregation. Originally a functional
--    index on date_trunc('month', created_at) was desired but Postgres
--    requires IMMUTABLE functions in expression indexes and date_trunc
--    is only STABLE on timestamptz. A plain btree on (organization_id,
--    created_at, event_name) is nearly as selective for the ranged
--    BETWEEN scans the service emits.
--
-- 2. reports_monthly_funnel_note_uniq
--    Partial unique index guaranteeing at most one monthly_funnel_note
--    row per (funnelId, month) pair. Enables upsert via ON CONFLICT
--    targeting the (data->>'funnelId', data->>'month') expression.
--
-- Use CREATE INDEX CONCURRENTLY so the migration does not block writes
-- on large tables. IF NOT EXISTS makes re-runs idempotent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_events_org_created_event
  ON conversion_events (organization_id, created_at, event_name);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS reports_monthly_funnel_note_uniq
  ON reports ((data->>'funnelId'), (data->>'month'))
  WHERE type = 'monthly_funnel_note';
