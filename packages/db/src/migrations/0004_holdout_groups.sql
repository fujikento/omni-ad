-- Unified Spend Orchestrator: holdout groups for causal lift estimation.
-- Pairs a treatment cohort of campaigns (receive budget shifts) with a
-- control cohort (excluded from shifts). Comparing ROAS across the two
-- cohorts yields a randomised-assignment lift estimate.

CREATE TABLE IF NOT EXISTS holdout_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  test_campaign_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  control_campaign_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holdout_groups_org_idx
  ON holdout_groups (organization_id);

CREATE INDEX IF NOT EXISTS holdout_groups_org_active_idx
  ON holdout_groups (organization_id, active);
