# Personal OS — Get It Done

An AI Chief of Staff that closes the loop on what you delegate. You delegate something to a
person; Personal OS remembers it, drafts the message, reminds you, tracks the reply, escalates,
and closes the loop.

> **Status:** Phase 1 (MVP) in active build. This is production-intent software, built feature by
> feature with verification. See `DECISIONS.md` for the decision log and `CHANGELOG.md` for progress.

## Repository (canonical)
**GitHub is the single source of truth for this codebase.** The primary branch is `main`.
All work continues against the GitHub-backed repo: every verified feature is committed, and the
repo connects to Vercel for deployment. First-time setup instructions are in `PUSH_TO_GITHUB.md`.
The local `Mind Matters` folder is a working copy; GitHub is authoritative.

## Stack
- **Next.js 15** (App Router) · **TypeScript** (strict) · **Tailwind CSS** · PWA (installable)
- **PostgreSQL** via Supabase · **Prisma**
- **Google OAuth** (Supabase Auth)
- **Razorpay** (India) + **Stripe** (international)
- **Resend** (email) · **PostHog** + **Sentry** (observability)
- AI via a **swappable model-abstraction layer** (Anthropic by default)

## Design
Black / white / gold only. Premium glassmorphism, large breathable layouts, gold as the single
reward colour. Tokens live in `src/app/globals.css` and map into `tailwind.config.ts`. Every screen
composes the shared primitives in `src/components/ui/`.

## Quick start
```bash
cp .env.example .env.local   # fill in values — see KEYS_NEEDED.md
npm install
npm run db:migrate           # once DATABASE_URL is set (Step 1+)
npm run dev                  # http://localhost:3000
```
See **INSTALL.md** for full setup and **DEPLOY.md** for deployment.

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Local dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (no `any` allowed) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit/integration |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed development data |

## What's built so far
- ✅ **Step 0** — Project scaffold, black/white/gold design system + tokens, reusable UI primitives,
  PWA shell (installable + offline), navigation, repo docs.
- ⏳ Steps 1–10 — see the in-app build plan / `CHANGELOG.md`.

## Project layout
```
src/
  app/            # routes (App Router) + global styles
  components/ui/  # shared design-system primitives
  lib/            # utilities, domain/service layer (added Step 1)
prisma/           # schema, migrations, seed (added Step 1)
public/           # manifest, service worker, icons
```
