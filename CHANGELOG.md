# Changelog

All notable changes to Personal OS. Format loosely follows Keep a Changelog.

## [Unreleased]
_Infrastructure phase: GitHub ✅ → Supabase (DB ✅, auth pending) → Anthropic → remaining → deploy._

### Deploy fixes (surfaced by the first Vercel build — real Prisma client vs local stub)
- Prisma `Json` inputs (`Touch.payload`) cast at the persistence boundary (the generated client's
  `InputJsonValue` type isn't present in the offline stub) — contained, documented lint exceptions.
- `createLoop` uses the explicit `contact: { connect }` relation form for owners.
- `db.ts` constructs the client with a placeholder datasource URL when `DATABASE_URL` is unset, so the
  app boots on the in-memory repository without a DB configured (no construction crash).

### AI — Gemini provider added (swappable layer)
- `GeminiProvider` (`src/ai/providers/gemini.ts`) implementing the same `ModelProvider` interface;
  `getProvider()` selects it via `AI_PROVIDER=gemini` + `GEMINI_API_KEY`. Shared `extractJson` helper
  factored out (used by both providers) + tested. `tsc` 0, `eslint` 0, **101 tests**.

### Supabase — database (applied + verified via connector)
- Wiped the legacy schema from the `mind-matters` project (13 empty tables, owner-authorized).
- Applied the full Personal OS schema: **17 tables + 13 enums + indexes + FKs**, matching
  `schema.prisma` naming/types (so the Prisma baseline stays clean).
- **RLS enabled with tenant-isolation policies** (`accessible_space_ids()` + per-table policies) —
  fixed the connector's critical "RLS disabled" advisory. `rls.sql` updated to match.
- Seeded the demo workspace (3 loops, 2 contacts, 3 owners, 2 routines, 3 touches) under the dev
  user/space; verified the `listLoops` join returns owners correctly.
- Fixed dev user/space constants to valid UUIDs (Postgres `uuid` columns).
- **Pending for live in-app use:** `DATABASE_URL`/`DIRECT_URL` + `service_role` in env (→ Prisma
  client connects, `getRepository()` flips to Prisma), Prisma migration baseline, and Google OAuth
  (Supabase Auth) for sign-in.

### Infra prep (keyless, ahead of credentials)
- **Prisma/Supabase repository** (`src/server/repositories/prisma.ts`) implementing the full
  `WorkspaceRepository` interface — loops/touches/contacts/groups/routines, optimistic-locked updates,
  transitions via the shared `transitionLoop`/`planTransition`, per-day routine checks.
- **Swap-point wired:** `getRepository()` returns Prisma when `DATABASE_URL` is set, else in-memory —
  so connecting Supabase needs only env + `migrate` + `rls.sql`, no app code changes.
- Verified: `tsc` 0, `eslint` 0, **98/98 tests** still green. (Prisma repo is exercised end-to-end once
  a database is connected; the interface contract is covered by the in-memory repo tests.)

## [0.1.0-keyless-foundation] — 2026-06-28
First stable milestone: the **complete MVP feature set, built and verified without any external
credentials** (in-memory repository + deterministic stub AI). Quality gates green —
**98/98 tests · tsc 0 errors · eslint 0 warnings · zero `any`**. This tag is the rollback point
before infrastructure is wired in.

### Milestone 1 — pre-infrastructure review + cleanup
- Self-review verified: 74 source files, 17 test files, **98/98 tests**, **tsc 0 errors**, **eslint 0**,
  zero `any`, zero TODO/placeholder logic.
- Removed duplication: status-group sets (`HIDDEN_STATUSES`/`DONE_STATUSES`/`isHidden`/`isDone`) now
  live once in `stateMachine.ts`; dev timezone centralised as `DEV_TZ` (`src/lib/dev.ts`).
- Tightened ESLint (`ignoreRestSiblings`); fixed the 2 lint errors it surfaced.
- Flagged orphaned `ComingSoon.tsx` for deletion on the Mac (mount blocks deletion in-sandbox).
- Verdict: codebase ready for GitHub push, Supabase, Anthropic, and Vercel. See `VERIFICATION.md`.


### Step 0 — Foundation (complete)
- Scaffolded Next.js 15 + TypeScript (strict) + Tailwind project as an installable PWA.
- Established the **black / white / gold** design-token system (light + dark) in `globals.css`,
  mapped into `tailwind.config.ts`.
- Built reusable UI primitives: `GlassCard`, `Button`, `Input`, `Chip`, `StatusDot`, `ThemeToggle`,
  `BottomNav`, `CaptureBar`, `ComingSoon`.
- Added PWA manifest + service worker (installable, offline app-shell) and offline route.
- Security headers + strict CSP baseline in `next.config.mjs`.
- Repo docs: `README`, `KEYS_NEEDED`, `DECISIONS`, `.env.example`; lint/format config.

### Step 1 — Data model + domain/service layer + loop state machine (complete)
- Full Prisma schema (15 models) — UUID PKs, FK cascade rules, enums, composite indexes,
  optimistic-locking `version` columns, soft-delete, transition history, audit log, idempotency keys.
- Canonical domain enums (`src/domain/enums.ts`) shared by schema, services, and UI.
- Loop **state machine** (`stateMachine.ts`) with legal-transition enforcement; pure
  `planTransition` (`service.ts`) deriving timestamps + follow-up scheduling; follow-up cadence
  (`followup.ts`); locked channel routing + MVP/consent gating (`routing.ts`).
- Atomic `transitionLoop` writer with optimistic locking + transition/touch/audit in one tx.
- Row-Level Security policies (`prisma/rls.sql`), dev seed (`prisma/seed.ts`), migrations guide.
- Verified: `tsc` 0 errors, **23/23 unit tests pass**.

### Step 2 — Capture → AI parse → Confirm (in progress)
- Strict `ParsedLoop` zod schema + `ParseResult` (draft | one clarifying question); confidence threshold.
- Deterministic **fast-path parser** (`fastPath.ts`) for the predictable ~80%: resolves owners only
  against known contacts (never invents), relative-date extraction (`dates.ts`, never guesses),
  priority + channel detection, definition-of-done heuristic, confidence scoring.
- Verified: `tsc` 0 errors, **32/32 unit tests pass**.
- **AI model-abstraction layer** (`src/ai/`): `ModelProvider` interface, config-driven `getProvider()`,
  deterministic **StubProvider** (keyless fallback so capture never breaks), live **AnthropicProvider**
  (timeout + JSON validation, inert without key), versioned parse prompt with changelog.
- **Parse orchestrator** (`orchestrator.ts`): fast-path first (no model call when confident + owner
  resolved + future-dated), AI fallback otherwise; enforces product rules — missing owner → one
  question, past deadline → ask to correct, low confidence → one question, owners re-resolved against
  known contacts (never invented).
- **API infrastructure** (`src/lib/api.ts`): consistent success/error envelopes, typed error codes +
  HTTP mapping, zod body validation, handler wrapper.
- **AI Confirm card UI** (`ConfirmCard.tsx`): every field editable, wrong-contact guard blocks confirm
  on unresolved owners, nothing created pre-confirm.
- Verified: `tsc` 0 errors, **40/40 unit tests pass** (incl. orchestrator + fast-path + API).
- **Remaining (needs keys):** wiring `POST /api/v1/loops/parse` + `POST /api/v1/loops` and the
  capture→confirm→persist flow end-to-end requires Supabase (DB + tenant/auth). Live parsing accuracy
  benchmark requires `ANTHROPIC_API_KEY`.

### Step 3 — Loops list + detail + timeline + filters (in progress)
- **Repository architecture:** single `WorkspaceRepository` interface (the persistence contract);
  temporary `InMemoryWorkspaceRepository` (seeded) to unblock UI/tests; one swap point
  (`getRepository()`) that the Prisma/Supabase impl will replace with no other changes. Transitions
  reuse the shared `planTransition` (one business-logic implementation).
- **Pure list semantics** (`filters.ts`): segments (By me / To me / Waiting / Watching), universal
  AND filters (status/priority/channel/owner/deadline) + one-tap clear, deadline buckets,
  days-waiting, manual ordering. `pathToClosed` for tick-to-close (advances states, never skips).
- **Loops screen:** segment tabs, group quick-tabs, filter chips + clear, loop rows (tick-to-close
  with gold animation, owners, deadline, status dot+label, channel icon, days-waiting), empty +
  loading-skeleton + error states.
- **Capture → confirm → create**, end-to-end and keyless (orchestrator + StubProvider in the client,
  persisted via server action to the repository).
- **Loop detail:** header + status, "Done when", single communication **timeline**, Mark-closed / Drop
  actions (state-machine enforced + audit-logged).
- Verified: `tsc` 0 errors, **55/55 unit tests pass**.
- **Drag-to-reorder** gesture: pointer HTML5 drag-and-drop + keyboard-accessible grip handle
  (Arrow Up/Down), optimistic local reorder persisted via `reorderLoopsAction`. Step 3 functionally
  complete; only visual screenshots await a build env.

### Repository
- **GitHub set as canonical** (private `mind-matters`, branch `main`) — `README` + `PUSH_TO_GITHUB.md`
  document the one-step setup. Push pending Karan's GitHub auth (no autonomous credential handling).

### Step 4 — Follow-up engine + reminders + timezone (core complete)
- **Timezone foundation** (`domain/time/tz.ts`): UTC-stored / local-computed via `Intl` (no dep) —
  local date keys, local-midnight-as-UTC, next-local-midnight (routine resets), DST-aware day diff.
- **Reminders domain** (`domain/reminders/`): derive deadline + follow-up reminders from loops,
  timezone-aware Overdue/Today/Upcoming bucketing, quiet-hours hold, snooze (15m/1h/tomorrow),
  1-per-loop-per-channel-per-day cap, and a pure idempotent **dueFollowups** background-job engine.
- **Reminders screen:** month calendar (dots on reminder days, today highlighted) + Overdue/Today/
  Upcoming lists, rendered in the user's timezone, empty state.
- **Cron route** `POST /api/v1/cron/followups` — CRON_SECRET-gated, idempotent, returns the due set.
- Verified: `tsc` 0 errors, **70/70 unit tests pass** (13 new for tz + reminders).
- **Remaining (needs keys/infra):** notification + push dispatch (Resend/web-push), persisting
  `Reminder` rows + `reminded` touches (Supabase). Logic + schedule are done and verifiable now.

### Step 5 — Routines (complete)
- Pure **streak engine** (`domain/routines/streak.ts`): local-midnight reset, consecutive-day
  increment, same-day idempotent check, miss-resets, display-streak (alive if today/yesterday).
- Repository extended (one interface): `listRoutines` / `createRoutine` / `checkRoutine` (uses the
  shared streak engine); in-memory impl seeded. **Nightly reset is computed from the local day — no
  job needed** (the checkbox simply un-checks at local midnight).
- **Routines screen:** today's progress + best-streak header, daily checklist (tick = gold, strikes
  through), per-routine flame streak, add-routine input.
- Verified: `tsc` 0 errors, **75/75 unit tests pass** (5 new streak tests).

### Step 6 — Dashboard + daily AI briefing (complete)
- Pure **briefing engine** (`domain/briefing/`): Weekly Closed Loops (North Star), needs-you-today
  (overdue/due-today), waiting-on-others, suggested escalations (blocked / long-ignored / critical+overdue).
  Timezone-aware, deterministic (AI phrasing can layer on later).
- **Dashboard** (home `/`): greeting, WCL + best-streak cards, AI briefing card, "Needs you today",
  "Waiting on others", global capture bar. (Replaces the Step-0 design-system preview.)
- Verified: `tsc` 0 errors, **79/79 unit tests pass** (4 new briefing tests).

### Step 7 — Onboarding + assisted send (keyless parts complete)
- **Assisted send** (`domain/send/links.ts`): mailto / tel / wa.me deep links — the user's own
  client sends, never the server. Gated channels (telegram/sms/voice) return null.
- **`sendLoopAction`**: drafts the message via the AI layer (stub keyless / Anthropic live), opens the
  deep link, logs `drafted` + `sent` touches, advances the loop Confirmed→Scheduled→Awaiting.
- **Send button** on loop detail (channel-aware label).
- **Onboarding** (`/onboarding`): intro → sign-in → guided first loop → dashboard. Google sign-in is
  honestly gated until Supabase Auth is connected; a demo path proceeds keyless.
- Verified: `tsc` 0 errors, **84/84 unit tests pass** (5 new send-link tests).
- **Remaining (needs keys):** Google OAuth (Supabase), real email send (Resend) — deep-link assisted
  send works today; tenant/auth scoping replaces the dev user/space.

### Step 8 — Payments (keyless parts complete)
- **Plan limits + pricing** (`domain/billing/plans.ts`): Free (10 loops / 1 routine) vs Pro/Business
  (unlimited), gating helpers, annual = 2 months free.
- **Webhook signature verification** (`server/payments/webhooks.ts`): real HMAC-SHA256 for **Stripe**
  (`t`/`v1`, timing-safe, replay-tolerance) and **Razorpay**, with full unit tests (valid/tamper/stale/
  wrong-secret).
- **Plans screen** (`/plans`): Free/Pro/Business cards, monthly↔annual toggle, feature lists; checkout
  gated until payment keys.
- Verified: `tsc` 0 errors, **94/94 unit tests pass** (10 new: plans + webhooks).
- **Remaining (needs keys):** live Razorpay/Stripe checkout + mandate creation + dunning (sandbox keys).

### Step 9 — Attachments, Settings, consent, JSON export (keyless parts complete)
- **Attachment validation** (`domain/attachments/validate.ts`): MIME whitelist + 10 MB cap + filename
  checks, tested.
- **JSON export** (`GET /api/v1/export`): full workspace (loops + timelines, contacts, groups,
  routines) as a download — DPDP "own your data".
- **Settings screen:** profile, plans/billing link, contacts & consent (assisted-send vs autonomous
  opt-in note), integration status (reads which keys are connected), security summary, data export.
- Verified: `tsc` 0 errors, **98/98 unit tests pass** (4 new attachment tests).
- **Remaining (needs infra):** actual file upload to signed-URL storage + virus scan.

### Step 10 — Repo deliverables + hardening (keyless parts complete)
- Docs: `ARCHITECTURE.md` (layers, modules, data model, state machine, flows, security),
  `INSTALL.md`, `DEPLOY.md` (Vercel + Supabase + Docker + cron), plus existing `README`/`DECISIONS`/
  `VERIFICATION`/`CHANGELOG`/`KEYS_NEEDED`/`PUSH_TO_GITHUB`.
- **Dockerfile** (multi-stage, Next standalone) + **docker-compose.yml** (app + Postgres) +
  `output: 'standalone'`.
- **CI** (`.github/workflows/ci.yml`): install → prisma generate → typecheck → lint → test → build →
  dependency audit, on `main`.
- Security headers + strict CSP already in `next.config.mjs`; a11y baked into components (focus rings,
  aria labels, ≥44px targets, status never colour-alone, prefers-reduced-motion).
- **Remaining (needs build env / keys):** production `next build` + Lighthouse ≥90 + visual
  screenshots + live security/dependency scan + actual deploy. All gated on a real environment, not code.
