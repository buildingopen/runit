-- Add deployment status tracking to projects
-- Enables the draft → deploying → live → failed workflow

-- Add status and deploy tracking columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deploy_error TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS runtime_url TEXT;

-- Add detected_env_vars to project_versions for storing env var keys found in code
ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS detected_env_vars JSONB DEFAULT '[]';

-- Add index on status for filtering by project state
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Update existing projects to 'live' status (they were already deployed)
UPDATE projects SET status = 'live' WHERE status IS NULL OR status = 'draft';
