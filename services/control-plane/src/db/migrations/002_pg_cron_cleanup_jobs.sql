-- Migration 002: Schedule pg_cron cleanup jobs
-- PREREQUISITE: Enable pg_cron from Supabase Dashboard > Database > Extensions
--
-- This migration schedules automatic cleanup of expired rate limits and quotas.
-- pg_cron must be enabled BEFORE running this migration.

-- Clean up expired rate limits every 5 minutes
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$SELECT cleanup_expired_rate_limits()$$
);

-- Reset expired quotas every 15 minutes
SELECT cron.schedule(
  'reset-expired-quotas',
  '*/15 * * * *',
  $$SELECT reset_expired_quotas()$$
);
