-- Atomic increment functions to prevent race conditions in usage tracking.
-- Replaces read-then-write patterns with single SQL statements.

-- ============================================
-- Monthly Usage: atomic increment for cpu/gpu runs
-- ============================================
CREATE OR REPLACE FUNCTION increment_monthly_usage(
    p_user_id TEXT,
    p_month_start DATE,
    p_field TEXT  -- 'cpu_runs' or 'gpu_runs'
) RETURNS void AS $$
BEGIN
    INSERT INTO monthly_usage (user_id, month_start, cpu_runs, gpu_runs, projects_count)
    VALUES (
        p_user_id,
        p_month_start,
        CASE WHEN p_field = 'cpu_runs' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'gpu_runs' THEN 1 ELSE 0 END,
        0
    )
    ON CONFLICT (user_id, month_start)
    DO UPDATE SET
        cpu_runs = CASE WHEN p_field = 'cpu_runs' THEN monthly_usage.cpu_runs + 1 ELSE monthly_usage.cpu_runs END,
        gpu_runs = CASE WHEN p_field = 'gpu_runs' THEN monthly_usage.gpu_runs + 1 ELSE monthly_usage.gpu_runs END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Monthly Usage: atomic increment for projects_count
-- ============================================
CREATE OR REPLACE FUNCTION increment_monthly_projects(
    p_user_id TEXT,
    p_month_start DATE
) RETURNS void AS $$
BEGIN
    INSERT INTO monthly_usage (user_id, month_start, cpu_runs, gpu_runs, projects_count)
    VALUES (p_user_id, p_month_start, 0, 0, 1)
    ON CONFLICT (user_id, month_start)
    DO UPDATE SET
        projects_count = monthly_usage.projects_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Usage Quotas: atomic increment for run counts
-- ============================================
CREATE OR REPLACE FUNCTION increment_quota_run(
    p_user_id UUID,
    p_period TEXT,
    p_period_start TIMESTAMPTZ,
    p_field TEXT  -- 'cpu_run_count' or 'gpu_run_count'
) RETURNS void AS $$
BEGIN
    INSERT INTO usage_quotas (user_id, period, period_start, cpu_run_count, gpu_run_count, active_cpu_runs, active_gpu_runs)
    VALUES (
        p_user_id,
        p_period,
        p_period_start,
        CASE WHEN p_field = 'cpu_run_count' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'gpu_run_count' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'cpu_run_count' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'gpu_run_count' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, period, period_start)
    DO UPDATE SET
        cpu_run_count = CASE WHEN p_field = 'cpu_run_count' THEN usage_quotas.cpu_run_count + 1 ELSE usage_quotas.cpu_run_count END,
        gpu_run_count = CASE WHEN p_field = 'gpu_run_count' THEN usage_quotas.gpu_run_count + 1 ELSE usage_quotas.gpu_run_count END,
        active_cpu_runs = CASE WHEN p_field = 'cpu_run_count' THEN usage_quotas.active_cpu_runs + 1 ELSE usage_quotas.active_cpu_runs END,
        active_gpu_runs = CASE WHEN p_field = 'gpu_run_count' THEN usage_quotas.active_gpu_runs + 1 ELSE usage_quotas.active_gpu_runs END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Usage Quotas: atomic decrement for active runs
-- ============================================
CREATE OR REPLACE FUNCTION decrement_active_runs(
    p_user_id UUID,
    p_period TEXT,
    p_period_start TIMESTAMPTZ,
    p_field TEXT  -- 'active_cpu_runs' or 'active_gpu_runs'
) RETURNS void AS $$
BEGIN
    UPDATE usage_quotas SET
        active_cpu_runs = CASE WHEN p_field = 'active_cpu_runs' THEN GREATEST(active_cpu_runs - 1, 0) ELSE active_cpu_runs END,
        active_gpu_runs = CASE WHEN p_field = 'active_gpu_runs' THEN GREATEST(active_gpu_runs - 1, 0) ELSE active_gpu_runs END,
        updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND period_start = p_period_start;
END;
$$ LANGUAGE plpgsql;
