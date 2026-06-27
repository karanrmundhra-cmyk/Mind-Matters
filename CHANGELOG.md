# Changelog

All notable changes to Personal OS. Format loosely follows Keep a Changelog.

## [Unreleased]

### Step 0 — Foundation (in progress)
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
- **Remaining in Step 3:** drag-to-reorder *gesture* (persistence + `reorderLoopsAction` done & tested;
  pointer/keyboard gesture pending) and visual screenshots (need a build env).
