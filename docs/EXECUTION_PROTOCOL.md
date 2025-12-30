# Execution Protocol - 10-Agent Orchestration

**Status:** Foundation Complete ✅
**Last Updated:** 2024-12-30

## 1. Purpose

This document defines **how 10 agents work in parallel** on the Execution Layer codebase using git worktrees, branch strategies, and coordination protocols.

---

## 2. Agent Ownership Map

| Agent | Codename | Primary Directories | Key Deliverables |
|-------|----------|-------------------|------------------|
| 1 | ARCHITECT | `services/control-plane/`, `packages/shared/src/contracts/` | API contracts, control-plane routes, shared types |
| 2 | KERNEL | `services/runner/src/modal_app.py`, `src/build/`, `src/execute/` | Modal runtime, in-process execution, dependency caching |
| 3 | BRIDGE | `services/runner/src/openapi/`, `src/errors/` | OpenAPI extraction, entrypoint detection, error taxonomy |
| 4 | AESTHETIC | `apps/web/components/ui/`, `apps/web/styles/`, `packages/ui/` | Design system, UI primitives, Tailwind config |
| 5 | RUNPAGE | `apps/web/components/run-page/`, `packages/openapi-form/` | Run Page forms, schema→form generation |
| 6 | MEMORY | `services/control-plane/src/routes/context.ts`, context logic | Context fetch, storage, mounting |
| 7 | TRUST | `services/control-plane/src/routes/secrets.ts`, encryption | Secrets storage, KMS encryption, redaction |
| 8 | DELIGHT | `packages/sdk/`, `samples/` | Python SDK, sample apps, DX improvements |
| 9 | FINOPS | `infra/`, `services/control-plane/src/middleware/` | Rate limiting, quotas, retention cleanup |
| 10 | CUTTER | `docs/`, `.github/`, PR reviews | Scope enforcement, decision logs, PR reviews |

---

## 3. Git Worktree Strategy

### 3.1 Setup Commands

```bash
# In execution-layer/ (main repo)
cd /Users/federicodeponte/Downloads/runtime\ ai/execution-layer

# Create branches for each agent
git checkout -b agent-1/contracts
git checkout -b agent-2/modal-runtime
git checkout -b agent-3/openapi-bridge
git checkout -b agent-4/design-system
git checkout -b agent-5/run-page
git checkout -b agent-6/context-system
git checkout -b agent-7/secrets-system
git checkout -b agent-8/sdk-dx
git checkout -b agent-9/cost-controls
git checkout -b agent-10/pr-reviews
git checkout main

# Create worktrees (parallel development directories)
cd ..
git -C execution-layer worktree add agent-1-architect agent-1/contracts
git -C execution-layer worktree add agent-2-kernel agent-2/modal-runtime
git -C execution-layer worktree add agent-3-bridge agent-3/openapi-bridge
git -C execution-layer worktree add agent-4-aesthetic agent-4/design-system
git -C execution-layer worktree add agent-5-runpage agent-5/run-page
git -C execution-layer worktree add agent-6-memory agent-6/context-system
git -C execution-layer worktree add agent-7-trust agent-7/secrets-system
git -C execution-layer worktree add agent-8-delight agent-8/sdk-dx
git -C execution-layer worktree add agent-9-finops agent-9/cost-controls
git -C execution-layer worktree add agent-10-cutter agent-10/pr-reviews
```

### 3.2 Directory Layout After Setup

```
~/Downloads/runtime ai/
  execution-layer/          # Main repo (on 'main' branch)
  agent-1-architect/        # Worktree for Agent 1
  agent-2-kernel/           # Worktree for Agent 2
  agent-3-bridge/           # Worktree for Agent 3
  agent-4-aesthetic/        # Worktree for Agent 4
  agent-5-runpage/          # Worktree for Agent 5
  agent-6-memory/           # Worktree for Agent 6
  agent-7-trust/            # Worktree for Agent 7
  agent-8-delight/          # Worktree for Agent 8
  agent-9-finops/           # Worktree for Agent 9
  agent-10-cutter/          # Worktree for Agent 10
```

---

## 4. Agent Workflow

### 4.1 Daily Development Cycle

**Each agent follows this pattern:**

1. **Start work in their worktree:**
   ```bash
   cd ~/Downloads/runtime\ ai/agent-X-name/
   git status  # Verify on correct branch
   ```

2. **Make changes in owned directories only**
   - See Agent Ownership Map above
   - Never modify files owned by other agents without coordination

3. **Commit frequently:**
   ```bash
   git add .
   git commit -m "feat(agent-X): description of change"
   ```

4. **Push to remote branch:**
   ```bash
   git push origin agent-X/feature-name
   ```

5. **Pull latest from main daily:**
   ```bash
   git fetch origin main
   git merge origin/main
   # Resolve conflicts if any
   ```

### 4.2 Commit Message Convention

```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- docs: Documentation
- test: Tests
- chore: Build/tooling

Scope: agent-1, agent-2, ..., agent-10

Example:
feat(agent-2): implement CPU lane Modal function
fix(agent-7): resolve KMS decryption edge case
docs(agent-10): update scope cut plan
```

---

## 5. Coordination Mechanisms

### 5.1 Dependencies Between Agents

**Phase 1 (Foundation) - Week 1-2:**
```
Agent 1 (ARCHITECT) → Defines contracts
  ↓
Agents 2, 3, 4, 7 → Implement against contracts
```

**Phase 2 (Core Build) - Week 3-4:**
```
Agent 2 (KERNEL) → Runner works
  ↓
Agent 3 (BRIDGE) → OpenAPI extraction
  ↓
Agent 5 (RUNPAGE) → Form generation
```

**Phase 3 (Integration) - Week 5:**
```
Agent 6 (MEMORY) + Agent 7 (TRUST) → Context & Secrets
  ↓
Agent 9 (FINOPS) → Rate limiting & quotas
```

### 5.2 Shared Files (Coordination Required)

**High-risk files** (multiple agents depend on these):

| File | Owner | Notify Before Changing |
|------|-------|------------------------|
| `packages/shared/src/contracts/` | Agent 1 | Agents 2, 3, 6, 7 |
| `services/runner/src/modal_app.py` | Agent 2 | Agent 3 |
| `apps/web/components/ui/` | Agent 4 | Agent 5 |
| `services/control-plane/src/db/schema.sql` | Agent 1 | All agents |

**Coordination protocol:**
1. Post in shared document/chat: "Planning to change [file], affects [agents]"
2. Wait for acknowledgment from affected agents
3. Make change
4. Notify when complete

### 5.3 Communication Channels

**For this project:**
- **Primary:** I (Claude) orchestrate all agents and handle merge conflicts
- **Async updates:** Each agent commits to their branch with clear messages
- **Blockers:** Agents update their TODO comments when blocked
- **Reviews:** Agent 10 (CUTTER) reviews all PRs before I merge to main

---

## 6. Merge Strategy

### 6.1 Integration Flow

```
Agent branch → Review → Merge to main → All agents pull
```

**Daily integration:**
1. Each agent pushes to their branch
2. I review changes
3. If tests pass and no conflicts → merge to `main`
4. All agents pull `main` to stay in sync

**Conflict resolution:**
- Small conflicts → I resolve immediately
- Large conflicts → Coordinate affected agents to resolve together
- Breaking changes → Agent 1 (ARCHITECT) makes final decision

### 6.2 Merge Checklist

Before merging any agent's branch to `main`:

- [ ] Commits follow convention
- [ ] No conflicts with `main`
- [ ] Agent-owned files only (or coordination documented)
- [ ] TypeScript compiles (for TS changes)
- [ ] Tests pass (if applicable)
- [ ] Agent 10 (CUTTER) approved (for scope changes)

---

## 7. Testing Strategy

### 7.1 Test Ownership

| Agent | Tests | Location |
|-------|-------|----------|
| 1 | Contract validation | `packages/shared/src/__tests__/` |
| 2 | Runtime integration | `services/runner/tests/integration/` |
| 3 | OpenAPI extraction | `services/runner/tests/unit/` |
| 4 | Component tests | `packages/ui/src/__tests__/` |
| 5 | Form generation | `packages/openapi-form/src/__tests__/` |
| 6 | Context API | `services/control-plane/src/__tests__/` |
| 7 | Secrets encryption | `services/control-plane/src/__tests__/` |
| 8 | Sample apps | `services/runner/samples/*/test_*.py` |
| 9 | Middleware | `services/control-plane/src/middleware/__tests__/` |

### 7.2 Testing Commands

```bash
# TypeScript packages
cd packages/shared && npm run test

# Python runner
cd services/runner && pytest

# E2E tests (Agent 5 + Agent 8)
cd apps/web && npm run test:e2e
```

---

## 8. Integration Checkpoints

### Week 2 Checkpoint
**Required completions:**
- [ ] Agent 1: Contracts defined in `packages/shared/`
- [ ] Agent 4: Design tokens exported
- [ ] Agent 2: Base Modal image works
- [ ] All agents can import shared types

**Integration test:** Can import shared contracts in all services

---

### Week 4 Checkpoint
**Required completions:**
- [ ] Agent 2: Sample app runs in Modal
- [ ] Agent 3: OpenAPI extracted correctly
- [ ] Agent 5: Run Page form renders
- [ ] Agent 1: Control-plane routes exist

**Integration test:** Upload ZIP → Extract OpenAPI → Render form

---

### Week 5 Checkpoint
**Required completions:**
- [ ] Agent 6: Context fetch works
- [ ] Agent 7: Secrets encrypted/decrypted
- [ ] Agent 9: Rate limiting middleware active
- [ ] Share link flow complete

**Integration test:** Share endpoint → Recipient runs → Result shown

---

### Week 6 Checkpoint (Launch Ready)
**Required completions:**
- [ ] All acceptance tests pass
- [ ] Security checklist complete
- [ ] Golden demo (extract-company) works end-to-end
- [ ] Agent 10: All scope enforcement complete

**Integration test:** Full golden path from upload to share to result

---

## 9. Daily Standup Template

**Each agent posts this format:**

```markdown
## Agent X - [Codename] - [Date]

**Yesterday:**
- Completed: [task 1]
- Completed: [task 2]

**Today:**
- Working on: [task 3]
- Working on: [task 4]

**Blockers:**
- None / [description of blocker]

**Needs coordination:**
- None / [what I need from which agent]
```

---

## 10. Emergency Procedures

### 10.1 Broken Main Branch

If `main` breaks (tests fail, won't build):

1. **Identify breaking commit:** `git log --oneline`
2. **Revert immediately:** `git revert <commit-hash>`
3. **Notify affected agent**
4. **Fix in agent's branch, re-merge**

### 10.2 Merge Conflicts

If agent has conflicts when pulling `main`:

1. **Don't force push**
2. **Fetch and merge:** `git fetch origin main && git merge origin/main`
3. **Resolve conflicts** (keep both changes if possible)
4. **Test locally**
5. **Commit resolution:** `git commit -m "merge: resolve conflicts from main"`
6. **Push:** `git push`

### 10.3 Agent Blocked

If agent cannot proceed due to dependency:

1. **Update TODO comment:** `// TODO(agent-X): Blocked by agent-Y on [contract/feature]`
2. **Notify me (orchestrator)**
3. **I coordinate agents to unblock**
4. **Meanwhile, work on independent tasks**

---

## 11. Success Metrics

**We know the protocol works when:**

✅ All 10 agents commit daily without blocking each other
✅ Merge conflicts are < 5% of commits
✅ Integration checkpoints pass on schedule
✅ No agent is idle waiting for another agent >1 day
✅ `main` branch stays green (tests pass)

---

## 12. Tools & Commands Reference

### Worktree Management

```bash
# List all worktrees
git worktree list

# Remove worktree (if needed)
git worktree remove agent-X-name

# Prune stale worktrees
git worktree prune
```

### Branch Management

```bash
# See all branches
git branch -a

# Switch to agent branch (in worktree)
cd agent-X-name/
git checkout agent-X/feature-name

# Delete merged branch
git branch -d agent-X/feature-name
```

### Sync Commands

```bash
# In any worktree, sync with main
git fetch origin main
git merge origin/main

# Push current branch
git push origin HEAD
```

---

## 13. Phase Execution Order

**Week 1-2: Foundation**
```
Agent 1 (ARCHITECT) → Contracts first
Agent 4 (AESTHETIC) → Design system parallel
Agent 10 (CUTTER) → Non-goals doc parallel

WAIT FOR: Agent 1 contracts before others start
```

**Week 3-4: Core Build**
```
Agent 2 (KERNEL) → Modal runtime (uses Agent 1 contracts)
Agent 3 (BRIDGE) → OpenAPI extraction (uses Agent 2 runtime)
Agent 5 (RUNPAGE) → Forms (uses Agent 3 schemas + Agent 4 UI)
Agent 8 (DELIGHT) → SDK + samples parallel
```

**Week 5: Integration**
```
Agent 6 (MEMORY) → Context system
Agent 7 (TRUST) → Secrets system
Agent 9 (FINOPS) → Rate limiting + quotas

ALL parallel after Agents 2, 3, 5 complete
```

**Week 6: Polish**
```
All agents → Bug fixes
Agent 10 (CUTTER) → Final PR reviews
Agent 8 (DELIGHT) → Error message polish
Agent 1 (ARCHITECT) → Integration verification
```

---

## 14. Conflict Resolution Priority

**When agents disagree, resolve using this ladder:**

1. **CUTTER non-goals** (if it violates non-goals, it's rejected)
2. **ARCHITECT North Star** (Colab-for-apps > everything)
3. **AESTHETIC UX guardrails** (no Postman/Swagger/PaaS vibes)
4. **TRUST security defaults** (no secret leakage)
5. **KERNEL correctness** (it must run reliably)
6. **FINOPS cost caps** (must be bounded)
7. Everything else

**Tie-breaker policy:**
- If a change improves runtime but worsens UX simplicity → **UX wins**
- If a change improves UX but risks secret leakage → **TRUST wins**
- If a change requires new config screens → **CUTTER wins (reject)**

All conflicts end in a short decision memo in `docs/decisions/`.

---

## Status: ✅ PROTOCOL READY

All 10 agents can now start parallel development using this protocol.

Next step: Create worktrees and begin Phase 1 (Foundation).
