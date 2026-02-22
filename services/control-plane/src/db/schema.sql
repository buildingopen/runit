-- Runtime Database Schema
-- See CLAUDE.md Section 35.4 for complete schema

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versions
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_hash TEXT NOT NULL,
  code_bundle_ref TEXT NOT NULL,
  deps_hash TEXT,
  base_image_version TEXT,
  entrypoint TEXT,
  installed_packages JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, version_hash)
);

-- Runs
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id),
  endpoint TEXT NOT NULL,
  created_by UUID NOT NULL,
  request_params JSONB,
  request_body JSONB,
  request_headers JSONB,
  response_status INT,
  response_body JSONB,
  response_content_type TEXT,
  status TEXT NOT NULL,
  duration_ms INT,
  resource_lane TEXT,
  base_image_version TEXT,
  error_class TEXT,
  error_message TEXT,
  logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Artifacts
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Share Links
CREATE TABLE share_links (
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

-- Secrets
CREATE TABLE secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

-- Indexes
CREATE INDEX idx_runs_project_id ON runs(project_id);
CREATE INDEX idx_runs_created_by ON runs(created_by);
CREATE INDEX idx_runs_created_at ON runs(created_at);
CREATE INDEX idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX idx_share_links_project_id ON share_links(project_id);
CREATE INDEX idx_runs_expires_at ON runs(expires_at) WHERE expires_at < NOW();
CREATE INDEX idx_artifacts_expires_at ON artifacts(expires_at) WHERE expires_at < NOW();
