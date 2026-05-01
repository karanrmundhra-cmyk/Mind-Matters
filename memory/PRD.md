# Mind Matters — Personal Operating System (PRD)

## Original Problem Statement (condensed)
Build **Mind Matters** — a premium, AI-powered Personal OS. Single command center for
tasks, discipline (routines), finances, loans, investments, and personal notes.
Design benchmark: "Apple iOS settings × McKinsey deliverable". Strict black/white/grey
glassmorphism with an animated monochrome wave background. AI (Gemini 3 Flash) as the
intelligence layer for NL parsing, cross-module queries, and anomaly detection.
Phase 2 includes Telegram bot integration (deferred).

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`. Single `server.py`.
- **Auth**: Demo-login (JWT) for v1. Google OAuth UI placeholder (wired later).
- **AI layer**: `emergentintegrations` → `LlmChat` with `gemini-3-flash-preview`.
- **File upload**: pandas (Excel/CSV) + pdfplumber (PDF). AI categorization via Gemini.
- **Schema (multi-user ready)**: every doc has `user_id`, UUID `id`, ISO datetime strings.
- **Frontend**: React + Tailwind + Shadcn UI. Monochrome glass theme. Outfit (display),
  Cormorant Garamond (serif brand), Inter (body).

## User Personas
1. **Single-user owner** (v1): wants everything at a glance, one command center.
2. **Multi-user team** (v2 roadmap): schema already supports via `user_id`.

## Core Requirements (static)
- Black/white/grey ONLY, glass surfaces, animated ocean wave background.
- Inline editing everywhere, one-tap primary actions, max 2-level nav.
- Sidebar (desktop) + bottom nav (mobile). Floating AI chat on every screen.
- Zero clutter. data-testid on every interactive element.

## What's been implemented (2026-02-?? — Initial MVP)
- Auth: `/api/auth/demo-login`, `/api/auth/me` with JWT (30-day expiry).
- Tasks: CRUD + bulk + filters (status, name, date range). sr_no auto.
- Routines: CRUD + bulk + routine_logs toggle. Summary with category % and daily streaks.
- Loans: CRUD + accrued_interest (simple interest) + summary (net exposure, overdue count).
- Transactions: CRUD + `POST /api/transactions/upload` (Excel/CSV/PDF → AI categorization).
- Investments: CRUD + summary (total invested/value, monochrome allocation, upcoming maturities).
- Notes: CRUD + tag filter + text search + pin.
- Affirmations: daily upsert (`GET`/`PUT /api/affirmations/today`).
- Dashboard snapshot: pending tasks, routine %, cash flow today, loan exposure,
  AI-generated insights (long-pending tasks, overdue loans, routine shortfall, spending delta).
- AI chat: `/api/ai/chat` persists session; context-aware answers using user data.
- AI parse: `/api/ai/parse` turns NL into structured task/expense/note.
- News placeholder (3 static headlines); Weather via Open-Meteo (free, no key).
- Frontend: Splash → Login → App shell with sidebar+bottom nav, Dashboard, Tasks,
  Routines, Loans, Cash Flow (with upload), Investments (pie + line chart), Notes
  (Apple-notes layout), global floating AI chat + Quick-add modal.
- Testing: 16/16 backend pytest tests pass; frontend smoke tests pass.

## Prioritized Backlog
### P0 — Remaining before "v1 ship"
- Wire Google OAuth (user to provide Client ID/Secret).
- Live news source (GNews/NewsAPI — user to provide key).
### P1 — Phase 2
- Telegram bot (two-way): input text/image/PDF → auto-log; outbound: daily task digest,
  loan reminders, routine nudges, weekly financial summary.
- Morning briefing generator (cron + AI).
- 7-day / 30-day trend charts on dashboard.
### P2 — Phase 3
- Multi-user accounts + roles.
- Real portfolio NAV tracking (integrate a free MF/stock API).
- Offline-first (PWA service worker + IndexedDB sync queue).
- Mobile native (React Native shell).

## Environment Variables
- `MONGO_URL`, `DB_NAME` (pre-provided)
- `EMERGENT_LLM_KEY` (set; powers Gemini 3 Flash)
- `JWT_SECRET` (set)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (empty; fill when wiring OAuth)
- `NEWS_API_KEY` (empty)

## Frontend env
- `REACT_APP_BACKEND_URL` (pre-provided)
