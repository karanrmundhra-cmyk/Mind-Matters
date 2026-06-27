# Decision Log

Every product/engineering decision the spec did not explicitly cover. Format:
**decision · alternatives · reason · files affected.**

---

### D-001 — Palette reduced to black / white / gold only
- **Decision:** Replace the spec's warm beige/cream/orange tokens with a strict black / white / gold system (light + dark). Gold remains the single reward/accent colour.
- **Alternatives:** Keep the original warm palette; introduce a secondary accent.
- **Reason:** Explicit user instruction (2026-06-28) correcting the original spec.
- **Files:** `src/app/globals.css`, `tailwind.config.ts`.

### D-002 — One restrained functional red for danger/error only
- **Decision:** Keep a single muted red token (`--pos-danger`) used **only** for destructive/error safety cues (e.g. "Drop loop", failed-send), never decoratively.
- **Alternatives:** (a) all-gold/black errors with no red at all; (b) full traffic-light status colours.
- **Reason:** Removing every danger colour harms user trust and accessibility (clarity of destructive actions). Status is never colour-alone anyway — dots are always paired with labels + shape. This honours "black/white/gold" for the brand while keeping errors safe and legible.
- **Status:** ✅ **Confirmed by user (2026-06-28):** keep a single restrained red used *exclusively* for destructive actions, errors, and critical warnings (accessibility). Everything else stays strictly black/white/gold.
- **Files:** `src/app/globals.css`, `src/components/ui/Button.tsx`, `src/components/ui/StatusDot.tsx`.

### D-003 — "Dispatch" interpreted as remote continuation of the build
- **Decision:** Treat "workable from dispatch" as: Karan continues building/using via the Claude Dispatch feature from his phone. All code lives in the `Mind Matters` project folder so Dispatch always has the latest state. Live hosting (Vercel/preview) is a separate later step for using the app on the phone.
- **Reason:** Clarified directly by user.
- **Files:** entire repo location.

### D-004 — Dependency versions pinned to current stable (June 2026)
- **Decision:** Next.js 15.3.4, React 19.1.0, Tailwind 3.4.17, TypeScript 5.6.3, ESLint 9.
- **Alternatives:** Tailwind v4 (CSS-first config).
- **Reason:** Tailwind v3.4 chosen over v4 for ecosystem maturity and precise token/config control needed by the design system. Logged as an intentional, low-impact choice; revisit when v4 plugin ecosystem fully settles.
- **Files:** `package.json`, `tailwind.config.ts`, `postcss.config.mjs`.

### D-005 — No reference image was provided
- **Decision:** The spec names an attached reference image as the canonical visual authority, but no image was actually attached. Building from the written design system + D-001 palette override.
- **Reason:** Cannot match an image that isn't present; proceeding rather than blocking.
- **Action:** If Karan supplies the image later, reconcile aesthetics against it (layout/interaction already governed by the written spec).

### D-006 — Fast-path date extraction normalises to 18:00 UTC (interim)
- **Decision:** The deterministic fast-path date parser returns target days at 18:00 UTC.
- **Reason:** Deterministic + testable without a tz database. Full local-tz + DST handling is layered in Step 4 (reminders), where deadlines/"due today" are computed against the user's timezone (UTC stored, local displayed — per spec).
- **Files:** `src/domain/parse/dates.ts`. Revisit in Step 4.
