-- Restore proper RLS policies
-- Drops the overly permissive "Allow all access" policies and restores
-- owner-based access control. The backend uses service role (bypasses RLS).

-- ============================================
-- Drop permissive policies
-- ============================================
DROP POLICY IF EXISTS "Allow all access" ON projects;
DROP POLICY IF EXISTS "Allow all access" ON project_versions;
DROP POLICY IF EXISTS "Allow all access" ON runs;
DROP POLICY IF EXISTS "Allow all access" ON secrets;
DROP POLICY IF EXISTS "Allow all access" ON contexts;
DROP POLICY IF EXISTS "Allow all access" ON share_links;

-- ============================================
-- Projects: owner-based access
-- ============================================
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert own projects" ON projects
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (owner_id = auth.uid()::text);

-- ============================================
-- Project Versions: based on project ownership
-- ============================================
CREATE POLICY "Users can view own project versions" ON project_versions
    FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

CREATE POLICY "Users can insert own project versions" ON project_versions
    FOR INSERT WITH CHECK (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- ============================================
-- Runs: owner-based access
-- ============================================
CREATE POLICY "Users can view own runs" ON runs
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert own runs" ON runs
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update own runs" ON runs
    FOR UPDATE USING (owner_id = auth.uid()::text);

-- ============================================
-- Secrets: based on project ownership
-- ============================================
CREATE POLICY "Users can manage own project secrets" ON secrets
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- ============================================
-- Contexts: based on project ownership
-- ============================================
CREATE POLICY "Users can manage own project contexts" ON contexts
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- ============================================
-- Share Links: based on project ownership
-- ============================================
CREATE POLICY "Users can manage own share links" ON share_links
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- ============================================
-- Usage Quotas: user-based access
-- ============================================
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quotas" ON usage_quotas;
CREATE POLICY "Users can view own quotas" ON usage_quotas
    FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- Rate Limits: user-based access
-- ============================================
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;
CREATE POLICY "Users can view own rate limits" ON rate_limits
    FOR SELECT USING (key LIKE 'api:user:' || auth.uid()::text || '%');
