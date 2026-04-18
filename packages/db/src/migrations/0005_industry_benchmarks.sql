-- Industry benchmarks: cross-org aggregated performance metrics.
-- The agency network-effect moat — as more orgs use OMNI-AD, the
-- benchmarks get tighter, and no competitor can replicate them
-- without the same data distribution.

DO $$ BEGIN
  CREATE TYPE industry AS ENUM (
    'ecommerce_retail',
    'd2c_consumer',
    'saas_b2b',
    'saas_b2c',
    'finance_insurance',
    'health_wellness',
    'education',
    'travel_hospitality',
    'real_estate',
    'auto',
    'entertainment_media',
    'food_beverage',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS organization_industry (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  industry industry NOT NULL,
  is_agency text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry industry NOT NULL,
  platform platform NOT NULL,
  date date NOT NULL,
  sample_size integer NOT NULL,
  roas_p25 real,
  roas_p50 real,
  roas_p75 real,
  ctr_p50 real,
  cpa_p50 real,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS industry_benchmarks_industry_platform_date_idx
  ON industry_benchmarks (industry, platform, date);

CREATE UNIQUE INDEX IF NOT EXISTS industry_benchmarks_uniq
  ON industry_benchmarks (industry, platform, date);
