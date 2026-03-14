// ABOUTME: Billing routes for Stripe integration: subscription info, checkout, portal, and webhook.
// ABOUTME: Webhook endpoint is excluded from auth middleware and verified by Stripe signature.

import { Hono } from 'hono';
import { getAuthContext } from '../middleware/auth.js';
import * as billingStore from '../db/billing-store.js';
import * as projectsStore from '../db/projects-store.js';
import { getTierLimits, type Tier } from '../config/tiers.js';
import { logger } from '../lib/logger.js';
import { getFrontendUrl } from '../lib/env.js';

const billing = new Hono();

// Dynamic import: stripe is optional (not needed in OSS mode)
let stripeInstance: any | null | undefined;
async function getStripe(): Promise<any | null> {
  if (stripeInstance !== undefined) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { stripeInstance = null; return null; }
  try {
    const { default: Stripe } = await import('stripe');
    stripeInstance = new Stripe(key);
  } catch {
    stripeInstance = null;
  }
  return stripeInstance;
}

/**
 * GET /billing/subscription - Get current subscription and usage
 */
billing.get('/subscription', async (c) => {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const sub = await billingStore.getOrCreateSubscription(authContext.user.id);
  const usage = await billingStore.getMonthlyUsage(authContext.user.id);
  const limits = getTierLimits(sub.tier);

  // Get actual total project count (not the monthly counter)
  let totalProjects = 0;
  try {
    const projects = await projectsStore.listProjects(authContext.user.id);
    totalProjects = projects.length;
  } catch {
    totalProjects = usage?.projects_count || 0; // fallback to monthly counter
  }

  return c.json({
    tier: sub.tier,
    status: sub.status,
    current_period_end: sub.current_period_end,
    usage: {
      cpu_runs: usage?.cpu_runs || 0,
      gpu_runs: usage?.gpu_runs || 0,
      projects_count: totalProjects,
    },
    limits,
  });
});

/**
 * POST /billing/checkout - Create Stripe Checkout session for upgrade
 */
billing.post('/checkout', async (c) => {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const stripe = await getStripe();
  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const body = await c.req.json();
  const tier = body.tier as string;
  if (tier !== 'pro' && tier !== 'team') {
    return c.json({ error: 'Invalid tier. Must be "pro" or "team"' }, 400);
  }

  const priceId = tier === 'pro'
    ? process.env.STRIPE_PRO_PRICE_ID
    : process.env.STRIPE_TEAM_PRICE_ID;

  if (!priceId) {
    return c.json({ error: `Price not configured for ${tier} tier` }, 503);
  }

  // Get or create Stripe customer
  let sub = await billingStore.getOrCreateSubscription(authContext.user.id);
  let customerId = sub.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: authContext.user.email,
      metadata: { user_id: authContext.user.id },
    });
    customerId = customer.id;
    await billingStore.updateSubscription(authContext.user.id, {
      stripe_customer_id: customerId,
    });
  }

  // Always use configured FRONTEND_URL, never accept user-supplied redirect URLs (open redirect risk)
  const baseUrl = getFrontendUrl();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/settings/billing`,
    metadata: { user_id: authContext.user.id, tier },
  });

  return c.json({ url: session.url });
});

/**
 * POST /billing/portal - Create Stripe Customer Portal session
 */
billing.post('/portal', async (c) => {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const stripe = await getStripe();
  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const sub = await billingStore.getSubscription(authContext.user.id);
  if (!sub?.stripe_customer_id) {
    return c.json({ error: 'No billing account found' }, 404);
  }

  const returnUrl = getFrontendUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${returnUrl}/settings/billing`,
  });

  return c.json({ url: session.url });
});

/**
 * POST /billing/webhook - Stripe webhook handler
 * Excluded from auth middleware; verified by Stripe signature.
 */
billing.post('/webhook', async (c) => {
  const stripe = await getStripe();
  if (!stripe) {
    return c.json({ error: 'Billing not configured' }, 503);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: 'Webhook secret not configured' }, 503);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  let event: any;
  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { error: String(err) });
    return c.json({ error: 'Invalid signature' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier as Tier;
      if (userId && tier) {
        await billingStore.updateSubscription(userId, {
          stripe_subscription_id: session.subscription as string,
          tier,
          status: 'active',
        });
        logger.info('Subscription activated', { userId, tier });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const sub = await billingStore.getSubscriptionByCustomerId(subscription.customer as string);
      if (sub) {
        const periodStart = subscription.current_period_start;
        const periodEnd = subscription.current_period_end;

        // Resolve tier from price ID
        const priceId = subscription.items?.data?.[0]?.price?.id;
        let tier: Tier = 'free';
        if (priceId) {
          if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro';
          else if (priceId === process.env.STRIPE_TEAM_PRICE_ID) tier = 'team';
          else {
            logger.error('Unknown Stripe price ID in subscription update, defaulting to free', {
              userId: sub.user_id, priceId,
              knownPrices: { pro: process.env.STRIPE_PRO_PRICE_ID, team: process.env.STRIPE_TEAM_PRICE_ID },
            });
          }
        } else {
          logger.warn('No price ID in subscription update, defaulting tier to free', { userId: sub.user_id });
        }

        await billingStore.updateSubscription(sub.user_id, {
          status: subscription.status === 'active' ? 'active' : subscription.status === 'past_due' ? 'past_due' : 'canceled',
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          ...(tier ? { tier } : {}),
        });
        logger.info('Subscription updated via webhook', { userId: sub.user_id, tier: tier || 'unchanged' });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const sub = await billingStore.getSubscriptionByCustomerId(subscription.customer as string);
      if (sub) {
        await billingStore.updateSubscription(sub.user_id, {
          tier: 'free',
          status: 'canceled',
        });
        logger.info('Subscription canceled, reverted to free', { userId: sub.user_id });
      }
      break;
    }
  }

  return c.json({ received: true });
});

export default billing;
