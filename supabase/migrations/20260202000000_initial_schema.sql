-- Runtime Initial Schema
-- Run this in Supabase SQL Editor or via CLI: supabase db push

-- ============================================
-- Projects Table
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    deployed_at TIMESTAMPTZ,
    deploy_error TEXT,
    runtime_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for owner queries
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================
-- Project Versions Table
-- ============================================
CREATE TABLE IF NOT EXISTS project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL,
    code_bundle_ref TEXT NOT NULL,
    openapi JSONB,
    endpoints JSONB DEFAULT '[]',
    deps_hash TEXT,
    base_image_version TEXT,
    entrypoint TEXT,
    installed_packages JSONB,
    detected_env_vars JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON project_versions(created_at DESC);

-- ============================================
-- Runs Table
-- ============================================
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
    endpoint_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    request_params JSONB,
    request_body JSONB,
    request_headers JSONB,
    request_files JSONB,
    response_status INTEGER,
    response_body JSONB,
    response_content_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    duration_ms INTEGER,
    resource_lane TEXT,
    base_image_version TEXT,
    error_class TEXT,
    error_message TEXT,
    suggested_fix TEXT,
    logs TEXT,
    artifacts JSONB DEFAULT '[]',
    warnings TEXT[],
    redactions_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes for run queries
CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_owner_id ON runs(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);

-- ============================================
-- Secrets Table
-- ============================================
CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, key)
);

-- Index for secret lookups
CREATE INDEX IF NOT EXISTS idx_secrets_project_id ON secrets(project_id);

-- ============================================
-- Contexts Table (for URL data sources)
-- ============================================
CREATE TABLE IF NOT EXISTS contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT,
    url TEXT NOT NULL,
    data JSONB NOT NULL,
    size_bytes INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for context lookups
CREATE INDEX IF NOT EXISTS idx_contexts_project_id ON contexts(project_id);

-- ============================================
-- Share Links Table
-- ============================================
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_ref TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    run_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_run_at TIMESTAMPTZ
);

-- Index for share link lookups
CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON share_links(project_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only see their own projects
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert own projects" ON projects
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (owner_id = auth.uid()::text);

-- Project Versions: Based on project ownership
CREATE POLICY "Users can view own project versions" ON project_versions
    FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

CREATE POLICY "Users can insert own project versions" ON project_versions
    FOR INSERT WITH CHECK (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- Runs: Based on ownership
CREATE POLICY "Users can view own runs" ON runs
    FOR SELECT USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert own runs" ON runs
    FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update own runs" ON runs
    FOR UPDATE USING (owner_id = auth.uid()::text);

-- Secrets: Based on project ownership
CREATE POLICY "Users can view own project secrets" ON secrets
    FOR SELECT USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

CREATE POLICY "Users can manage own project secrets" ON secrets
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- Contexts: Based on project ownership
CREATE POLICY "Users can manage own project contexts" ON contexts
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- Share Links: Based on project ownership
CREATE POLICY "Users can manage own share links" ON share_links
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()::text)
    );

-- ============================================
-- Service Role Bypass (for backend operations)
-- ============================================
-- Note: Service role key automatically bypasses RLS

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER secrets_updated_at
    BEFORE UPDATE ON secrets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contexts_updated_at
    BEFORE UPDATE ON contexts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
