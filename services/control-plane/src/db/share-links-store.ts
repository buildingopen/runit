// ABOUTME: CRUD for share links (create, get, list, enable/disable, delete) with atomic run/success counter increments.
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB } from './sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export type ShareTargetType = 'endpoint_template' | 'run_result';

const DEFAULT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export interface ShareLink {
  id: string;
  project_id: string;
  target_type: ShareTargetType;
  target_ref: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  expires_at: string;
  run_count: number;
  success_count: number;
  last_run_at: string | null;
}

export interface CreateShareLinkInput {
  project_id: string;
  target_type: ShareTargetType;
  target_ref: string;
  created_by: string;
}

export interface ShareLinkStats {
  run_count: number;
  success_count: number;
  last_run_at: string | null;
}

function rowToShareLink(row: Record<string, unknown>): ShareLink {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    target_type: row.target_type as ShareTargetType,
    target_ref: row.target_ref as string,
    enabled: !!(row.enabled),
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    expires_at: row.expires_at as string,
    run_count: (row.run_count as number) || 0,
    success_count: (row.success_count as number) || 0,
    last_run_at: (row.last_run_at as string) || null,
  };
}

function isExpired(shareLink: ShareLink): boolean {
  if (!shareLink.expires_at) return false;
  return new Date(shareLink.expires_at) <= new Date();
}

export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MS).toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare(
      `INSERT INTO share_links (id, project_id, target_type, target_ref, enabled, created_by, created_at, expires_at, run_count, success_count)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0, 0)`
    ).run(id, input.project_id, input.target_type, input.target_ref, input.created_by, now, expiresAt);

    return { id, project_id: input.project_id, target_type: input.target_type, target_ref: input.target_ref, enabled: true, created_by: input.created_by, created_at: now, expires_at: expiresAt, run_count: 0, success_count: 0, last_run_at: null };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').insert({ id, project_id: input.project_id, target_type: input.target_type, target_ref: input.target_ref, enabled: true, created_by: input.created_by, expires_at: expiresAt }).select().single();
  if (error) throw new Error(`Failed to create share link: ${error.message}`);
  return data as ShareLink;
}

export async function getShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM share_links WHERE id = ?').get(shareLinkId) as Record<string, unknown> | undefined;
    return row ? rowToShareLink(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').select('*').eq('id', shareLinkId).single();
  if (error || !data) return null;
  return data as ShareLink;
}

export async function getEnabledShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM share_links WHERE id = ? AND enabled = 1').get(shareLinkId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const link = rowToShareLink(row);
    return isExpired(link) ? null : link;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').select('*').eq('id', shareLinkId).eq('enabled', true).single();
  if (error || !data) return null;
  const shareLink = data as ShareLink;
  return isExpired(shareLink) ? null : shareLink;
}

export async function listProjectShareLinks(projectId: string): Promise<ShareLink[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM share_links WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[];
    return rows.map(rowToShareLink);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list share links: ${error.message}`);
  return (data || []) as ShareLink[];
}

export async function disableShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('UPDATE share_links SET enabled = 0 WHERE id = ?').run(shareLinkId);
    return getShareLink(shareLinkId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').update({ enabled: false }).eq('id', shareLinkId).select().single();
  if (error || !data) return null;
  return data as ShareLink;
}

export async function enableShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('UPDATE share_links SET enabled = 1 WHERE id = ?').run(shareLinkId);
    return getShareLink(shareLinkId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').update({ enabled: true }).eq('id', shareLinkId).select().single();
  if (error || !data) return null;
  return data as ShareLink;
}

export async function deleteShareLink(shareLinkId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM share_links WHERE id = ?').run(shareLinkId);
    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('share_links').delete().eq('id', shareLinkId);
  if (error) throw new Error(`Failed to delete share link: ${error.message}`);
  return true;
}

export async function incrementShareLinkStats(shareLinkId: string, wasSuccess: boolean): Promise<void> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    if (wasSuccess) {
      db.prepare('UPDATE share_links SET run_count = run_count + 1, success_count = success_count + 1, last_run_at = ? WHERE id = ?').run(now, shareLinkId);
    } else {
      db.prepare('UPDATE share_links SET run_count = run_count + 1, last_run_at = ? WHERE id = ?').run(now, shareLinkId);
    }
    return;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.rpc('increment_share_link_stats', { share_id: shareLinkId, was_success: wasSuccess });

  if (error) {
    const shareLink = await getShareLink(shareLinkId);
    if (shareLink) {
      await supabase.from('share_links').update({
        run_count: shareLink.run_count + 1,
        success_count: shareLink.success_count + (wasSuccess ? 1 : 0),
        last_run_at: now,
      }).eq('id', shareLinkId);
    }
  }
}

export async function getShareLinkStats(shareLinkId: string): Promise<ShareLinkStats | null> {
  const shareLink = await getShareLink(shareLinkId);
  if (!shareLink) return null;
  return { run_count: shareLink.run_count, success_count: shareLink.success_count, last_run_at: shareLink.last_run_at };
}

export async function findShareLinkByTarget(projectId: string, targetType: ShareTargetType, targetRef: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM share_links WHERE project_id = ? AND target_type = ? AND target_ref = ?').get(projectId, targetType, targetRef) as Record<string, unknown> | undefined;
    return row ? rowToShareLink(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('share_links').select('*').eq('project_id', projectId).eq('target_type', targetType).eq('target_ref', targetRef).single();
  if (error || !data) return null;
  return data as ShareLink;
}

export async function getProjectShareLinkCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM share_links WHERE project_id = ?').get(projectId) as { cnt: number };
    return row.cnt;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase.from('share_links').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  if (error) throw new Error(`Failed to count share links: ${error.message}`);
  return count || 0;
}
