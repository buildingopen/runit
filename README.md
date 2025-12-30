# Agent 10 (CUTTER) - Scope Guardrails & Documentation

**Mission:** Prevent scope creep and ensure all agents follow v0 constraints.

**Role:** Governance - No code, just documentation and enforcement mechanisms.

---

## What This Agent Delivers

### 1. **docs/non_goals.md** - The Forbidden List
**Comprehensive list of ALL features we DO NOT build in v0.**

**15 major categories, 100+ specific exclusions:**
- Infrastructure & Platform (always-on hosting, custom domains, multi-service, etc.)
- Development Experience (IDE, git sync, custom build, etc.)
- Security & Access Control (fine-grained IAM, SSO, audit logs, etc.)
- Data & Storage (persistent storage, object storage integration, etc.)
- Monitoring & Observability (APM, metrics, error tracking, etc.)
- Collaboration (teams, comments, approval workflows, etc.)
- Billing & Usage (cost dashboards, quota management, etc.)
- Marketplace & Ecosystem (templates, extensions, community, etc.)
- Advanced Runtime (auto-scaling, geo-distribution, resource tuning, etc.)
- AI/ML Platform (model registry, training jobs, dataset management, etc.)
- API Features (public API, webhooks, rate limiting per endpoint, etc.)
- Compliance & Governance (SOC 2, HIPAA, policy enforcement, etc.)
- UI/UX Complexity (settings pages, dashboards, customization, etc.)
- Documentation & Help (interactive tutorials, video content, ticketing, etc.)
- Integration Features (CI/CD, monitoring integrations, notifications, etc.)

**Purpose:** End all "should we add X?" debates instantly with "Check non_goals.md".

---

## Files Created

1. **docs/non_goals.md** (100+ exclusions across 15 categories)
2. **docs/scope_cut_plan.md** (30 explicitly cut features with rationale)
3. **docs/review_gate.md** (12-point PR review criteria)
4. **.github/PULL_REQUEST_TEMPLATE.md** (Mandatory compliance checkpoint)

---

**Status:** COMPLETE - All governance documentation ready for v0.
**Last Updated:** 2024-12-30
