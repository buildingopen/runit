# Execution Layer - Sharpening Roadmap

## Vision
**"You built it with AI. We make it live."**

Target: People who just started using AI tools (Cursor, n8n, ChatGPT). They can GET code but can't DEPLOY it. Runtime AI is the missing piece.

## Current State
- v0.1.0, feature-complete
- Deployed on Render (web + API) + Modal (runner)
- No landing page (home = dashboard)
- No billing/payments
- No templates
- No user analytics
- Developer-oriented messaging ("FastAPI", "OpenAPI", "endpoints")

---

## Week 1: Landing Page + Repositioning

### 1.1 Marketing Landing Page
**Files:** New `/apps/web/app/(marketing)/page.tsx` (separate from dashboard)
- Hero: "Turn your Python script into a live app. No servers. No Docker. No devops."
- Subhero: "Built something with Cursor or ChatGPT? Make it live in 60 seconds."
- 3-step visual: Write code → Upload → Share link
- Use cases section: PDF converter, AI chatbot, data scraper, webhook for n8n
- Social proof placeholder (GitHub stars, "open source")
- CTA: "Deploy for free" → signup
- Pricing section (free / pro / team)
- Footer with links

### 1.2 Rename & Dejargon
**Global search-replace across `/apps/web/`:**
| Old | New |
|-----|-----|
| "Endpoint" (user-facing) | "Action" |
| "Environment Variables" | "Secrets" (already partially used) |
| "OpenAPI" | remove entirely from UI |
| "FastAPI" | "Python app" (in error messages) |
| "Deploy" | "Go live" |
| "Runtime" (product name) | "Runtime" (keep, it's fine) |
| "Execution Layer" (login page) | "Runtime" |
| "Mini App" | "App" (simpler) |

### 1.3 SEO & Meta
- Add metadataBase, OG images, Twitter cards
- robots.txt
- Sitemap

---

## Week 2: Simplified Onboarding + Templates

### 2.1 Paste-Your-Code Upload
**File:** Modify `/apps/web/app/new/page.tsx`
- Add third option: "Paste your Python code"
- Simple textarea with syntax highlighting
- Auto-wraps in FastAPI if it's a plain script
- Backend: create ZIP from pasted code, feed into existing pipeline
- This is THE killer feature for the target audience

### 2.2 Template Gallery
**Files:** New `/apps/web/app/templates/page.tsx` + template data
- 6-8 starter templates:
  1. "PDF to Text" - upload PDF, get extracted text
  2. "AI Chatbot" - simple Gemini/OpenAI wrapper
  3. "Image Generator" - text to image (GPU)
  4. "Data Scraper" - URL in, structured data out
  5. "CSV Analyzer" - upload CSV, get insights
  6. "Webhook Handler" - receive n8n/Make webhooks
  7. "Email Sender" - simple email API
  8. "File Converter" - convert between formats
- Each template: one-click deploy, pre-filled code + config
- Store templates in `/services/runner/templates/` as .py files

### 2.3 Onboarding Flow
**File:** Modify post-signup redirect
- After signup: "What do you want to build?" → template selector
- Skip option: "I have my own code"
- Tooltip tour on first project (optional, don't overdo)

### 2.4 Integration Docs
**Files:** New `/apps/web/app/(marketing)/integrations/page.tsx`
- "Works with n8n" - show how to use share link as webhook
- "Works with Make" - HTTP module pointing to share link
- "Works with Zapier" - webhook trigger
- Simple copy-paste instructions, not full docs

---

## Week 3: Billing (Stripe)

### 3.1 Pricing Tiers
| | Free | Pro ($19/mo) | Team ($49/mo) |
|---|------|-------------|---------------|
| CPU runs | 100/month | 2,000/month | 10,000/month |
| GPU runs | 0 | 100/month | 500/month |
| Apps | 3 | 20 | Unlimited |
| Secrets per app | 5 | 20 | 50 |
| Share links | 3 | Unlimited | Unlimited |
| File upload | 10MB | 50MB | 100MB |
| Support | Community | Email | Priority |

### 3.2 Stripe Integration
**Files:**
- New `/services/control-plane/src/routes/billing.ts`
- New `/apps/web/app/settings/billing/page.tsx`
- New Supabase migration: `subscriptions` table

Implementation:
- Stripe Checkout for upgrades
- Stripe Customer Portal for management
- Webhook handler for subscription events
- Quota enforcement tied to subscription tier
- Usage meter on dashboard ("47/100 runs used this month")

### 3.3 Usage Dashboard
**File:** New `/apps/web/app/settings/usage/page.tsx`
- Run count (CPU/GPU) with progress bar
- Per-app breakdown
- Billing period info
- Upgrade CTA when approaching limits

---

## Week 4: Launch

### 4.1 Analytics
- PostHog (EU region, already have key)
- Track: signups, first deploy, runs, share link creates, template usage
- Funnel: visit → signup → first deploy → first share

### 4.2 Domain
- Get domain (runtime.ai already in README, check availability)
- Or: runtimeapp.dev, getruntime.dev, etc.
- SSL, DNS, update Render config

### 4.3 Launch Prep
- GitHub repo: make public, clean README for open source
- Record 60s demo video (Cursor → Runtime → live app)
- Write launch posts:
  - Product Hunt
  - Hacker News (Show HN)
  - r/selfhosted, r/Python, r/webdev
  - Twitter/X thread
  - n8n community forum

### 4.4 Polish
- Error messages: friendly, actionable ("Your code has an error on line X. Here's how to fix it")
- Loading states: fun, engaging (not just spinners)
- Empty states: helpful, guide to next action
- Mobile responsive check on all pages

---

## Implementation Order (Priority)

1. Landing page (highest impact, gates everything)
2. Paste-your-code (removes biggest friction)
3. Templates (gives users a starting point)
4. Dejargon pass (makes everything approachable)
5. Stripe billing (enables revenue)
6. Analytics (measures funnel)
7. Launch materials (Product Hunt, HN, etc.)

## Files to Create
- `/apps/web/app/(marketing)/page.tsx` - Landing page
- `/apps/web/app/(marketing)/pricing/page.tsx` - Pricing page
- `/apps/web/app/(marketing)/integrations/page.tsx` - Integration docs
- `/apps/web/app/(marketing)/layout.tsx` - Marketing layout (no sidebar)
- `/apps/web/app/templates/page.tsx` - Template gallery
- `/services/runner/templates/*.py` - Template Python files
- `/services/control-plane/src/routes/billing.ts` - Stripe routes
- `/apps/web/app/settings/billing/page.tsx` - Billing UI
- `/apps/web/app/settings/usage/page.tsx` - Usage dashboard

## Files to Modify
- `/apps/web/app/new/page.tsx` - Add paste-code option
- `/apps/web/app/page.tsx` - Dashboard (add usage bar)
- `/apps/web/app/login/page.tsx` - Update branding
- `/apps/web/app/signup/page.tsx` - Update branding + post-signup flow
- `/apps/web/app/layout.tsx` - Add meta tags
- `/services/control-plane/src/middleware/quota.ts` - Tie to Stripe tiers
- All user-facing components - dejargon pass
