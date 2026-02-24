# Runtime AI — Validation Roadmap

## Thesis
People who build with AI tools (Cursor, ChatGPT, n8n) can GET code but can't DEPLOY it. Runtime AI is the missing piece: upload a ZIP, get a live endpoint in 30 seconds.

Open source alone doesn't validate anything. People don't want to self-host — that's the whole point. If they could self-host, they'd just use Modal directly. We need to prove demand exists before investing in infrastructure.

## What's Built (done)
- Full product: upload ZIP/GitHub → detect actions → go live → run via share link
- Landing page, auth, dashboard, templates, billing routes, share links
- Docker backend (self-hosted on AX41) + Modal backend (cloud)
- 190+ tests, E2E passing
- Dejargoned: all user-facing text is plain English
- Self-hosted Supabase for auth/DB

---

## Validation Plays (cheapest to most expensive)

### Play 1: Landing Page + Waitlist
**Effort:** 1 day | **Cost:** $0

- [ ] Get domain (runtimeai.dev or similar)
- [ ] Ship landing page (already built — just needs a domain)
- [ ] Add waitlist form (email collection → Supabase table or simple Google Form)
- [ ] Record 60s demo video: ZIP upload → running endpoint → share link
- [ ] Post on HN ("Show HN: Upload a Python API, get a live endpoint in 30 seconds")
- [ ] Post on Reddit: r/Python, r/MachineLearning, r/webdev
- [ ] Tweet/X thread with video

**Signal:** 500+ signups in first week = real interest. <50 = move on.

### Play 2: "Deploy This For Me" Concierge
**Effort:** 0 days build | **Cost:** $0

- [ ] Find 10 people on ML Twitter/Discord who have a FastAPI project
- [ ] DM them: "Send me your ZIP, I'll deploy it in 30 seconds and send you the link"
- [ ] Do it manually with the existing AX41 setup
- [ ] Track reactions

**Signal:** Do they say "holy shit" or "cool I guess"? Do they ask for more? Do they tell friends?

### Play 3: Hosted Free Tier
**Effort:** 1 week | **Cost:** ~$50/mo

- [ ] Host on existing infra: AX41 (Docker backend) or Render + Modal free tier
- [ ] Free tier: 5 runs/day, CPU only, 60s timeout, 3 apps max
- [ ] Behind auth (Supabase already wired)
- [ ] Modal free tier covers ~30 hours/month — enough for validation

**Signal:** Do people come back? Do they share their endpoints? What do they build?

### Play 4: ProductHunt + HN Launch
**Effort:** 1 day | **Cost:** $0

- [ ] The product works. Just launch it.
- [ ] Title: "Runtime AI — upload a Python API, get a live endpoint in 30 seconds"
- [ ] Host on Render (blueprint exists) or just use AX41
- [ ] Track: upvotes, comments, signups, what people try to build

---

## Week-by-Week Plan

### Week 1: Landing Page + Waitlist + First Posts
1. Buy domain
2. Point DNS, set up SSL (Caddy or nginx)
3. Add waitlist form to landing page
4. Record demo video (Loom or screen recording)
5. Write and post: HN, Reddit r/Python, Twitter
6. Start concierge outreach (DM 10 people)

### Week 2: Evaluate Signals + Host Free Tier (if signals are good)
- If >200 signups: deploy hosted free tier on Modal + Render
- If <50 signups: pivot messaging, try different channels, or shelve
- Continue concierge conversations
- Talk to anyone who signed up — what are they trying to build?

### Week 3: Watch What People Build
- Monitor usage: what apps do people create?
- Talk to top 10 users (email/DM)
- Identify patterns: what's the most common use case?
- Fix any blocking bugs that real users hit

### Week 4: Decision
- **Invest:** >100 active users, retention, word-of-mouth → add Stripe, scale infra
- **Pivot:** interest but wrong positioning → adjust messaging/audience
- **Shelve:** no real demand → move on, keep the code

---

## Pre-Launch Checklist

### Already Done
- [x] Landing page with clear value prop
- [x] Auth (signup/login via Supabase)
- [x] Dashboard, project CRUD, deploy flow
- [x] Docker + Modal execution backends
- [x] Templates (PDF extractor, AI chatbot, web scraper)
- [x] Share links (public endpoints)
- [x] Rate limiting + quota enforcement
- [x] Dejargon pass (plain English everywhere)
- [x] Billing routes (Stripe integration scaffolded)
- [x] 190+ tests passing

### Still Needed for Launch
- [ ] Domain + DNS + SSL
- [ ] Waitlist form on landing page
- [ ] Demo video (60s screen recording)
- [ ] OG image / Twitter card meta tags
- [ ] Paste-your-code option (huge for target audience — they copy from ChatGPT)
- [ ] PostHog analytics (key exists, just wire it up)
- [ ] Render deploy config (or keep on AX41 behind Caddy)

### Nice-to-Have (post-validation)
- [ ] Stripe billing (only after proving demand)
- [ ] Usage dashboard
- [ ] Integration docs (n8n, Make, Zapier)
- [ ] GPU support
- [ ] Custom domains for share links

---

## Hosting Strategy

Validation phase: use existing infra, don't scale prematurely.

| Phase | Hosting | Cost |
|-------|---------|------|
| Waitlist only | Static page on Vercel/Netlify | $0 |
| Free tier (<100 users) | AX41 Docker backend | $0 (already paying for AX41) |
| Free tier (100-500 users) | Render + Modal free tier | ~$50/mo |
| Paid tier (post-validation) | Render Pro + Modal pay-as-you-go | Scales with revenue |

The AX41 can handle the validation phase easily. Only move to Render + Modal when there's actual demand.
