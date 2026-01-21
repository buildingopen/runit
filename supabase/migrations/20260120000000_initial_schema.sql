-- Execution Layer Database Schema
-- Initial migration with all tables and RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

-- Project Versions
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_hash TEXT NOT NULL,
  code_bundle_ref TEXT NOT NULL,
  openapi JSONB,
  endpoints JSONB,
  deps_hash TEXT,
  base_image_version TEXT,
  entrypoint TEXT,
  installed_packages JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, version_hash)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);

-- Runs
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES project_versions(id),
  endpoint_id TEXT NOT NULL,
  owner_id UUID NOT NULL,
  request_params JSONB,
  request_body JSONB,
  request_headers JSONB,
  request_files JSONB,
  response_status INT,
  response_body JSONB,
  response_content_type TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  duration_ms INT,
  resource_lane TEXT,
  base_image_version TEXT,
  error_class TEXT,
  error_message TEXT,
  suggested_fix TEXT,
  logs TEXT,
  artifacts JSONB,
  warnings JSONB,
  redactions_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_owner_id ON runs(owner_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_expires_at ON runs(expires_at) WHERE expires_at < NOW();

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires_at ON artifacts(expires_at) WHERE expires_at < NOW();

-- Secrets
CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_secrets_project_id ON secrets(project_id);

-- Contexts
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  url TEXT NOT NULL,
  data JSONB NOT NULL,
  size_bytes INT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contexts_project_id ON contexts(project_id);

-- Share Links
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_links_project_id ON share_links(project_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = owner_id);

-- Project Versions: Access through project ownership
CREATE POLICY "Users can view versions of own projects"
  ON project_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create versions for own projects"
  ON project_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.owner_id = auth.uid()
  ));

-- Runs: Users can only access their own runs
CREATE POLICY "Users can view own runs"
  ON runs FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own runs"
  ON runs FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own runs"
  ON runs FOR UPDATE
  USING (auth.uid() = owner_id);

-- Artifacts: Access through run ownership
CREATE POLICY "Users can view artifacts of own runs"
  ON artifacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM runs WHERE runs.id = artifacts.run_id AND runs.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create artifacts for own runs"
  ON artifacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM runs WHERE runs.id = artifacts.run_id AND runs.owner_id = auth.uid()
  ));

-- Secrets: Access through project ownership
CREATE POLICY "Users can view secrets of own projects"
  ON secrets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = secrets.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create secrets for own projects"
  ON secrets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = secrets.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update secrets of own projects"
  ON secrets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = secrets.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete secrets of own projects"
  ON secrets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = secrets.project_id AND projects.owner_id = auth.uid()
  ));

-- Contexts: Access through project ownership
CREATE POLICY "Users can view contexts of own projects"
  ON contexts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contexts.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create contexts for own projects"
  ON contexts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contexts.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update contexts of own projects"
  ON contexts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contexts.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete contexts of own projects"
  ON contexts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = contexts.project_id AND projects.owner_id = auth.uid()
  ));

-- Share Links: Access through project ownership (for management)
CREATE POLICY "Users can view share links of own projects"
  ON share_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = share_links.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can create share links for own projects"
  ON share_links FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = share_links.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update share links of own projects"
  ON share_links FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = share_links.project_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete share links of own projects"
  ON share_links FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = share_links.project_id AND projects.owner_id = auth.uid()
  ));

-- ============================================
-- SERVICE ROLE POLICIES (for backend access)
-- ============================================

-- Allow service role to bypass RLS
CREATE POLICY "Service role has full access to projects"
  ON projects FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to project_versions"
  ON project_versions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to runs"
  ON runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to artifacts"
  ON artifacts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to secrets"
  ON secrets FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to contexts"
  ON contexts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to share_links"
  ON share_links FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- PUBLIC ACCESS FOR SHARE LINKS
-- ============================================

-- Public can view enabled share links (for unauthenticated access)
CREATE POLICY "Public can view enabled share links"
  ON share_links FOR SELECT
  USING (enabled = true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secrets_updated_at
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contexts_updated_at
  BEFORE UPDATE ON contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment share link stats
CREATE OR REPLACE FUNCTION increment_share_link_stats(share_id UUID, was_success BOOLEAN)
RETURNS void AS $$
BEGIN
  UPDATE share_links
  SET
    run_count = run_count + 1,
    success_count = success_count + CASE WHEN was_success THEN 1 ELSE 0 END,
    last_run_at = NOW()
  WHERE id = share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
