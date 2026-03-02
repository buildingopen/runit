-- Add unique constraint on project slugs to prevent TOCTOU race on PATCH
-- The application checks uniqueness before update, but concurrent requests
-- can both pass the check. This constraint is the definitive guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_unique ON projects (slug);
