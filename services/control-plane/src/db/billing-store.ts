// ABOUTME: CRUD operations for subscriptions and monthly usage tables.
// ABOUTME: Used by billing routes and quota middleware for tier-based enforcement.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import type { Tier } from '../config/tiers.js';
import { features } from '../config/features.js';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: Tier;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface MonthlyUsage {
  id: string;
  user_id: string;
  month_start: string;
  cpu_runs: number;
  gpu_runs: number;
  projects_count: number;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data as Subscription | null;
}

export async function getOrCreateSubscription(userId: string): Promise<Subscription> {
  const existing = await getSubscription(userId);
  if (existing) return existing;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier: 'free',
      status: 'active',
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);
  return data as Subscription;
}

export async function updateSubscription(
  userId: string,
  updates: Partial<Pick<Subscription, 'stripe_customer_id' | 'stripe_subscription_id' | 'tier' | 'status' | 'current_period_start' | 'current_period_end'>>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getServiceSupabaseClient();
  // Use upsert to handle the case where the user has no row yet (e.g., webhook fires before user visits billing page)
  await supabase
    .from('subscriptions')
    .upsert(
      { user_id: userId, ...updates },
      { onConflict: 'user_id' }
    );
}

export async function getSubscriptionByCustomerId(customerId: string): Promise<Subscription | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();
  return data as Subscription | null;
}

export async function getMonthlyUsage(userId: string): Promise<MonthlyUsage | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { data } = await supabase
    .from('monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .single();

  return data as MonthlyUsage | null;
}

export async function incrementMonthlyUsage(userId: string, lane: 'cpu' | 'gpu'): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  await supabase.rpc('increment_monthly_usage', {
    p_user_id: userId,
    p_month_start: monthStart,
    p_field: lane === 'cpu' ? 'cpu_runs' : 'gpu_runs',
  });
}

export async function incrementProjectsCount(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getServiceSupabaseClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  await supabase.rpc('increment_monthly_projects', {
    p_user_id: userId,
    p_month_start: monthStart,
  });
}

export async function getUserTier(userId: string): Promise<Tier> {
  if (features.isOSS) return 'unlimited';
  const sub = await getSubscription(userId);
  return sub?.tier || 'free';
}
