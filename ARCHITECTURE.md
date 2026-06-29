# Architecture

Personal OS is a Next.js (App Router) PWA with a strict separation between **domain logic**
(pure, tested) and **persistence** (a swappable repository). AI and payments sit behind abstraction
boundaries so providers can change by config.

## Layers

```
UI (app/, components/)                 ← React Server + Client Components; no business logic
        │  server actions / route handlers (validate + call services)
Domain / services (src/domain/)        ← pure business logic, fully unit-tested
        │  WorkspaceRepository interface (the ONLY persistence contract)
Persistence (src/server/repositories/) ← InMemory now · Prisma/Supabase next (same interface)
```

- **Business rules live only in `src/domain/`.** The UI never decides rules; the API validates
  server-side; the AI proposes structured data, the service layer enforces rules.
- **One implementation per rule.** The loop state machine (`planTransition`) is the single source of
  transition logic, used by every repository.

## Key modules
- `domain/enums.ts` — canonical enums shared by schema, services, UI.
- `domain/loop/` — state machine (`stateMachine.ts`), transition planner (`service.ts`), follow-up
  cadence (`followup.ts`), filters/segments (`filters.ts`), repository interface (`repository.ts`).
- `domain/parse/` — strict schema, deterministic fast-path, orchestrator (fast-path → AI → one
  clarifying question; never invents contacts/dates).
- `ai/` — `ModelProvider` boundary; `StubProvider` (keyless) + `AnthropicProvider` (live); versioned prompts.
- `domain/time/tz.ts` — UTC-stored / local-computed timezone helpers (DST-aware, `Intl`).
- `domain/reminders/` — derive/bucket/quiet-hours/snooze/cap + `dueFollowups` job.
- `domain/routines/streak.ts` — daily-reset streak engine.
- `domain/briefing/` — daily briefing + Weekly Closed Loops (North Star).
- `domain/send/links.ts` — assisted-send deep links (mailto/tel/wa.me).
- `domain/billing/plans.ts` + `server/payments/webhooks.ts` — tiers + HMAC webhook verification.
- `server/repositories/` — `WorkspaceRepository` impls + `getRepository()` swap point.

## Data model (entities)
User, Space, Membership, Group, Contact, CommunicationConsent, Loop, LoopOwner, Touch,
LoopTransition, Reminder, Routine, RoutineCheck, Attachment, Subscription, AuditLog, IdempotencyKey.
See `prisma/schema.prisma` for fields, indexes, optimistic-locking `version` columns, and cascade
rules; `prisma/rls.sql` for tenant-isolation Row-Level Security.

## Loop state machine
`Draft → Confirmed → Scheduled → Awaiting → Responded → Completed → Closed`, with
`Awaiting → Blocked|Escalated → (Responded|Dropped)`, `any non-terminal → Dropped`,
`Closed|Dropped → Archived → Deleted`. No skipping; every transition is audit-logged with history.

## Request / data flow (capture → loop)
1. Capture bar → `parseLoop` (fast-path, else AI) → draft **or** one clarifying question.
2. Editable Confirm card → **Confirm** → `createLoopAction` → repository persists (Confirmed).
3. Assisted send → AI draft → deep link opened by the user's client → `sent` touch → Awaiting.
4. Follow-up engine schedules `nextFollowupAt`; the cron job surfaces due follow-ups.

## Security
Strict CSP + security headers (`next.config.mjs`); server-side validation + typed API envelopes;
HMAC-verified payment webhooks; idempotency keys for state-changing POSTs; RLS for tenant isolation;
soft-delete before hard-delete; audit log on important actions.

## What's gated on credentials
Persistence (Supabase), live AI (Anthropic), email (Resend), payment checkout (Razorpay/Stripe),
push notifications. All corresponding logic is built and unit-tested behind these boundaries.
