-- Migration 001: Rate Limits and Usage Quotas Tables
-- Run this migration on your Supabase project

-- Rate limits: tracks per-user and per-IP request counts
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,           -- "api:user:<id>" or "api:ip:<ip>"
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_ms INT NOT NULL DEFAULT 60000,
  UNIQUE(key)
);

CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Usage quotas: tracks per-user run usage per period
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period TEXT NOT NULL,                    -- "hourly", "daily", "monthly"
  period_start TIMESTAMPTZ NOT NULL,
  cpu_run_count INT NOT NULL DEFAULT 0,
  gpu_run_count INT NOT NULL DEFAULT 0,
  active_cpu_runs INT NOT NULL DEFAULT 0,
  active_gpu_runs INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period, period_start)
);

CREATE INDEX idx_usage_quotas_user ON usage_quotas(user_id);
CREATE INDEX idx_usage_quotas_period ON usage_quotas(period_start);

-- Function to clean up expired rate limit entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start + (window_ms || ' milliseconds')::interval < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to reset hourly quotas (run via cron)
CREATE OR REPLACE FUNCTION reset_expired_quotas()
RETURNS void AS $$
BEGIN
  DELETE FROM usage_quotas
  WHERE period = 'hourly' AND period_start + INTERVAL '1 hour' < NOW();

  DELETE FROM usage_quotas
  WHERE period = 'daily' AND period_start + INTERVAL '1 day' < NOW();

  DELETE FROM usage_quotas
  WHERE period = 'monthly' AND period_start + INTERVAL '30 days' < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add project status and deploy fields (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='status') THEN
    ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='deployed_at') THEN
    ALTER TABLE projects ADD COLUMN deployed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='deploy_error') THEN
    ALTER TABLE projects ADD COLUMN deploy_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='runtime_url') THEN
    ALTER TABLE projects ADD COLUMN runtime_url TEXT;
  END IF;
END $$;
