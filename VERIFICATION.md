# Verification Log

Per-feature acceptance + self-audit, kept honest. ✅ verified · ⏳ pending · ⚠️ note.

## Step 0 — Foundation + black/white/gold design system

**Acceptance targets:** reusable design system built before screens; tokens for
colour/spacing/radius/shadow/blur/type/motion; shared primitives; light+dark; PWA installable;
clean TypeScript.

| Check | Result |
|-------|--------|
| Strict TypeScript, no `any`, `tsc --noEmit` | ✅ 0 errors |
| Design tokens (B/W/gold, light+dark) in `globals.css` → Tailwind | ✅ implemented |
| Reusable primitives (GlassCard, Button, Input, Chip, StatusDot, ThemeToggle, BottomNav, CaptureBar) | ✅ implemented |
| Status never colour-alone (dot + label + shape) | ✅ `StatusDot` |
| `prefers-reduced-motion` respected | ✅ globals.css |
| Focus-visible rings, ≥44px tap targets | ✅ in primitives |
| PWA: manifest + service worker + icons + offline route | ✅ implemented |
| Security headers + CSP baseline | ✅ `next.config.mjs` |
| Production `next build` succeeds | ⏳ could not complete in the build sandbox (per-call time cap; bg processes killed between calls). Resolve on Vercel preview build. |
| Visual screenshots (light/dark × mobile/desktop) | ⏳ pending preview deploy |
| Lighthouse ≥90 (perf + a11y) | ⏳ pending preview deploy |

**Conclusion:** Code complete and type-clean. Runtime/visual/build verification deferred to the
first Vercel preview deploy (which also delivers phone access). No code defects known.

## Step 1 — Data model + domain/service layer + loop state machine

**Acceptance targets:** full data model with UUID PKs/FKs/enums/indexes/optimistic locking;
state machine enforced at the service layer (illegal transitions rejected, every transition
audit-logged + history kept); unit tests; migrations + seed.

| Check | Result |
|-------|--------|
| Prisma schema — all entities, UUID PKs, FK cascade rules, enums, composite indexes | ✅ `prisma/schema.prisma` |
| Optimistic-locking `version` on Loop + Subscription | ✅ |
| Soft-delete (`deletedAt`) + transition history (`LoopTransition`) + `AuditLog` + `IdempotencyKey` | ✅ |
| State machine: legal transitions only, no skipping, self-transition rejected | ✅ 8 tests |
| `planTransition` derives timestamps (waitingSince, completed/closed/archived/deleted) + follow-up scheduling | ✅ 6 tests |
| Follow-up cadence defaults (Critical1/High2/Medium3/Low7) + override | ✅ 4 tests |
| Channel routing locked (WA→user; others→delegatee) + MVP gating + consent gating | ✅ 5 tests |
| `transitionLoop` writes update+transition+touch+audit atomically with version guard | ✅ implemented (typed) |
| Row-Level Security policies (tenant isolation) | ✅ `prisma/rls.sql` |
| Seed data spanning statuses | ✅ `prisma/seed.ts` |
| `tsc --noEmit` (strict, no `any`) | ✅ 0 errors |
| `vitest run` | ✅ 23/23 pass |
| Migration files applied + RLS applied + seed run against a real DB | ⏳ needs Supabase `DATABASE_URL` (engine CDN blocked in sandbox). Generated on first connect — see `prisma/MIGRATIONS.md`. |

**Conclusion:** Data model + business logic complete and verified by tests. Only DB-execution
steps await Supabase credentials (per the agreed "keys when needed" boundary).

## Step 2 — Capture → AI parse → Confirm (core complete; end-to-end wiring pending keys)

| Check | Result |
|-------|--------|
| Strict parse schema + draft-or-one-question result type | ✅ `parse/schema.ts` |
| Deterministic fast-path (owners only from known contacts; dates never guessed) | ✅ 9 tests |
| AI model-abstraction layer (swap by config) + keyless StubProvider fallback | ✅ `src/ai/` |
| Live AnthropicProvider (timeout, JSON-validated, inert without key) | ✅ implemented |
| Versioned prompt (version + changelog) | ✅ `ai/prompts/parse.ts` |
| Orchestrator: fast-path no-model when confident; AI fallback; one clarifying question | ✅ 6 tests |
| Never invents a contact (unknown owner → unresolved → question) | ✅ tested |
| Past/missing deadline + missing owner → ask, not guess | ✅ tested |
| API envelopes + validation + error mapping | ✅ 2 tests |
| AI Confirm card — fields editable, wrong-contact guard, nothing pre-confirm | ✅ `ConfirmCard.tsx` |
| `tsc` 0 errors · `vitest` 40/40 | ✅ |
| `POST /loops/parse` + `POST /loops` routes wired to DB + capture→persist e2e | ⏳ **needs Supabase** (DB + tenant/auth) |
| Parse accuracy ≥90% on a benchmark set | ⏳ **needs `ANTHROPIC_API_KEY`** (live model) |

**Genuine blocker reached:** completing capture→confirm→**persist** end-to-end needs Supabase, and the
live parse-accuracy benchmark needs the Anthropic key. All logic that can be built + tested without
them is done and green.

## Step 3 — Loops list + detail + timeline + filters (in progress)

| Check | Result |
|-------|--------|
| Single `WorkspaceRepository` interface; in-memory impl; one swap point for Prisma | ✅ |
| One business-logic impl (transitions via shared `planTransition`) | ✅ |
| Segments + universal AND filters + one-tap clear (pure `selectLoops`) | ✅ 8 tests |
| `pathToClosed` advances states without skipping (tick-to-close) | ✅ 2 tests |
| In-memory repo: create/transition/version/reorder/touches | ✅ 5 tests |
| Loops screen: segment tabs, group quick-tabs, filter chips, loop rows | ✅ |
| Loop row: tick-to-close (gold anim), owners, deadline, status dot+label, channel, days-waiting | ✅ |
| Capture → AI confirm → create (keyless via StubProvider + server action) | ✅ wired |
| Loop detail + single communication timeline + Mark-closed/Drop actions | ✅ |
| Loading skeleton · empty · error states | ✅ |
| `tsc` 0 errors · `vitest` 55/55 | ✅ |
| Drag-to-reorder **gesture** (persistence + action done; pointer/keyboard gesture) | ⏳ next sub-task |
| Keyboard-accessible reorder (a11y) | ⏳ Step 10 a11y pass |
| Visual screenshots (light/dark × mobile/desktop), tab-switch <100ms perf check | ⏳ needs build env / preview |

## Steps 4–10 — not started.
