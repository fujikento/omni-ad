-- Indexes supporting the monthly-funnel analytics service.
--
-- 1. idx_conv_events_org_month_event
--    Powers the main monthly pivot aggregation: it groups conversion_events
--    by (organization_id, calendar month, event_name). Using a functional
--    index on date_trunc('month', created_at) lets the planner honour the
--    month bucket without scanning the full partition.
--
-- 2. reports_monthly_funnel_note_uniq
--    Partial unique index guaranteeing at most one monthly_funnel_note row
--    per (funnelId, month) pair. Enables upsert via ON CONFLICT targeting
--    the (data->>'funnelId', data->>'month') expression.
--
-- Use CREATE INDEX CONCURRENTLY so the migration does not block writes on
-- large tables. IF NOT EXISTS makes re-runs idempotent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_events_org_month_event
  ON conversion_events (organization_id, (date_trunc('month', created_at)), event_name);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS reports_monthly_funnel_note_uniq
  ON reports ((data->>'funnelId'), (data->>'month'))
  WHERE type = 'monthly_funnel_note';
