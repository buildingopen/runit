-- Fix schema gaps referenced by code but missing from migrations

-- Gap 1: share_links.expires_at column (share-links-store.ts:87)
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Gap 2: increment_share_link_stats() RPC (share-links-store.ts:276)
CREATE OR REPLACE FUNCTION increment_share_link_stats(p_share_id UUID, p_was_success BOOLEAN)
RETURNS void AS $$
BEGIN
  UPDATE share_links SET
    run_count = run_count + 1,
    success_count = CASE WHEN p_was_success THEN success_count + 1 ELSE success_count END,
    last_run_at = NOW()
  WHERE id = p_share_id;
END;
$$ LANGUAGE plpgsql;
