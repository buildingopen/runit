/**
 * Share Links Store
 *
 * Database operations for share links
 * Falls back to in-memory store if Supabase is not configured
 */

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

export type ShareTargetType = 'endpoint_template' | 'run_result';

export interface ShareLink {
  id: string;
  project_id: string;
  target_type: ShareTargetType;
  target_ref: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
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

// In-memory store for v0 / dev mode
const inMemoryShareLinks = new Map<string, ShareLink>();

/**
 * Create a new share link
 */
export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const shareLink: ShareLink = {
    id,
    project_id: input.project_id,
    target_type: input.target_type,
    target_ref: input.target_ref,
    enabled: true,
    created_by: input.created_by,
    created_at: now,
    run_count: 0,
    success_count: 0,
    last_run_at: null,
  };

  if (!isSupabaseConfigured()) {
    inMemoryShareLinks.set(id, shareLink);
    return shareLink;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .insert({
      id: shareLink.id,
      project_id: shareLink.project_id,
      target_type: shareLink.target_type,
      target_ref: shareLink.target_ref,
      enabled: shareLink.enabled,
      created_by: shareLink.created_by,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create share link: ${error.message}`);
  }

  return data as ShareLink;
}

/**
 * Get a share link by ID
 */
export async function getShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    return inMemoryShareLinks.get(shareLinkId) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('id', shareLinkId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ShareLink;
}

/**
 * Get an enabled share link by ID (for public access)
 */
export async function getEnabledShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const shareLink = inMemoryShareLinks.get(shareLinkId);
    if (shareLink && shareLink.enabled) {
      return shareLink;
    }
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('id', shareLinkId)
    .eq('enabled', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ShareLink;
}

/**
 * List share links for a project
 */
export async function listProjectShareLinks(projectId: string): Promise<ShareLink[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryShareLinks.values()).filter(
      (s) => s.project_id === projectId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list share links: ${error.message}`);
  }

  return (data || []) as ShareLink[];
}

/**
 * Disable a share link
 */
export async function disableShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const shareLink = inMemoryShareLinks.get(shareLinkId);
    if (!shareLink) return null;
    shareLink.enabled = false;
    return shareLink;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .update({ enabled: false })
    .eq('id', shareLinkId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as ShareLink;
}

/**
 * Enable a share link
 */
export async function enableShareLink(shareLinkId: string): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    const shareLink = inMemoryShareLinks.get(shareLinkId);
    if (!shareLink) return null;
    shareLink.enabled = true;
    return shareLink;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .update({ enabled: true })
    .eq('id', shareLinkId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as ShareLink;
}

/**
 * Delete a share link
 */
export async function deleteShareLink(shareLinkId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return inMemoryShareLinks.delete(shareLinkId);
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('share_links').delete().eq('id', shareLinkId);

  if (error) {
    throw new Error(`Failed to delete share link: ${error.message}`);
  }

  return true;
}

/**
 * Increment share link stats after a run
 */
export async function incrementShareLinkStats(
  shareLinkId: string,
  wasSuccess: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const shareLink = inMemoryShareLinks.get(shareLinkId);
    if (shareLink) {
      shareLink.run_count++;
      if (wasSuccess) {
        shareLink.success_count++;
      }
      shareLink.last_run_at = new Date().toISOString();
    }
    return;
  }

  const supabase = getServiceSupabaseClient();

  // Use the RPC function for atomic update
  const { error } = await supabase.rpc('increment_share_link_stats', {
    share_id: shareLinkId,
    was_success: wasSuccess,
  });

  if (error) {
    // If RPC fails, fall back to manual update
    const shareLink = await getShareLink(shareLinkId);
    if (shareLink) {
      await supabase
        .from('share_links')
        .update({
          run_count: shareLink.run_count + 1,
          success_count: shareLink.success_count + (wasSuccess ? 1 : 0),
          last_run_at: new Date().toISOString(),
        })
        .eq('id', shareLinkId);
    }
  }
}

/**
 * Get share link stats
 */
export async function getShareLinkStats(shareLinkId: string): Promise<ShareLinkStats | null> {
  const shareLink = await getShareLink(shareLinkId);
  if (!shareLink) return null;

  return {
    run_count: shareLink.run_count,
    success_count: shareLink.success_count,
    last_run_at: shareLink.last_run_at,
  };
}

/**
 * Check if a share link exists for a target
 */
export async function findShareLinkByTarget(
  projectId: string,
  targetType: ShareTargetType,
  targetRef: string
): Promise<ShareLink | null> {
  if (!isSupabaseConfigured()) {
    for (const shareLink of inMemoryShareLinks.values()) {
      if (
        shareLink.project_id === projectId &&
        shareLink.target_type === targetType &&
        shareLink.target_ref === targetRef
      ) {
        return shareLink;
      }
    }
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('project_id', projectId)
    .eq('target_type', targetType)
    .eq('target_ref', targetRef)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ShareLink;
}

/**
 * Get share link count for a project
 */
export async function getProjectShareLinkCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryShareLinks.values()).filter(
      (s) => s.project_id === projectId
    ).length;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .from('share_links')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to count share links: ${error.message}`);
  }

  return count || 0;
}
