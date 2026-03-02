-- Atomic project creation with limit check (prevents TOCTOU race)
-- Parameters are TEXT because Supabase PostgREST passes RPC args as text.
-- owner_id is TEXT in the projects table; id is UUID so we cast p_id.
CREATE OR REPLACE FUNCTION create_project_atomic(
  p_id TEXT,
  p_owner_id TEXT,
  p_name TEXT,
  p_slug TEXT,
  p_max_projects INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INT;
BEGIN
  -- Advisory lock on user to serialize concurrent creates
  PERFORM pg_advisory_xact_lock(hashtext(p_owner_id));

  SELECT COUNT(*) INTO current_count FROM projects WHERE owner_id = p_owner_id;

  IF current_count >= p_max_projects THEN
    RETURN FALSE;
  END IF;

  INSERT INTO projects (id, owner_id, name, slug, status, created_at, updated_at)
  VALUES (p_id::uuid, p_owner_id, p_name, p_slug, 'draft', NOW(), NOW());

  RETURN TRUE;
END;
$$;

-- Atomic rate limit check and increment (prevents read-modify-write race)
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_ms INT
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  window_start TIMESTAMPTZ;
BEGIN
  window_start := NOW() - make_interval(secs := p_window_ms / 1000.0);

  -- Lock the row for this key (or create it)
  INSERT INTO rate_limits (key, count, window_start, window_ms)
  VALUES (p_key, 0, NOW(), p_window_ms)
  ON CONFLICT (key) DO NOTHING;

  SELECT * INTO rec FROM rate_limits WHERE key = p_key FOR UPDATE;

  -- Check if window expired
  IF rec.window_start < window_start THEN
    -- Reset window
    UPDATE rate_limits SET count = 1, window_start = NOW() WHERE key = p_key;
    RETURN json_build_object('allowed', true, 'count', 1, 'remaining', p_limit - 1);
  END IF;

  -- Check limit
  IF rec.count >= p_limit THEN
    RETURN json_build_object('allowed', false, 'count', rec.count, 'remaining', 0);
  END IF;

  -- Increment
  UPDATE rate_limits SET count = count + 1 WHERE key = p_key;

  RETURN json_build_object('allowed', true, 'count', rec.count + 1, 'remaining', p_limit - rec.count - 1);
END;
$$;
