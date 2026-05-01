# Mind Matters — Personal Operating System (PRD)

## Product intent
Premium, AI-powered Personal OS — a single command center for tasks, discipline,
finances, loans, investments, notes, and now documents & reminders.
Tone: Calm, Intelligent, In control. Theme: **Black + Gold** with R.K.M. brand logo.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`. Modular helpers:
  `server.py` (routes), `docs_gen.py` (reportlab PDFs), `tg.py` (Telegram poller + reminder loop).
- **Auth**: Demo-login (JWT, single-user "you@mindmatters.local") for v1.
- **AI layer**: `emergentintegrations` → `LlmChat` with `gemini-3-flash-preview`.
- **File parsing**: pandas (Excel/CSV), pdfplumber (PDF), docxtpl (custom .docx templates).
- **Telegram**: long-polling (`getUpdates`) as asyncio background task. Inbound text →
  AI-parsed to task/expense/note. Outbound → direct Bot API.
- **Reminder scheduler**: asyncio loop every 30s; pings via Telegram.
- **Frontend**: React + Tailwind + Shadcn UI. Black + gold glass theme. Outfit (display),
  Cormorant Garamond (serif), Inter (body).

## User Personas
1. **Single-user owner** (v1): wants everything at a glance, one command center.
2. **Multi-user team** (v2 roadmap): schema already supports via `user_id`.

## Core Requirements (static)
- Strict black + gold + grey palette. No other accent colors.
- Glass surfaces, animated subtle ocean-wave background.
- Inline editing everywhere, one-tap primary actions, max 2-level nav.
- Sidebar (desktop) + bottom nav (mobile). Floating AI chat on every screen.
- `data-testid` on every interactive element.

## What's implemented

### v1 (first finish, 2026-02-??)
- Auth (demo-login + JWT)
- Tasks, Routines (+ streaks), Loans (+ accrued interest), Cash Flow (+ AI upload),
  Investments (pie + growth), Notes (+ tags + pin), Affirmations (daily).
- Dashboard snapshot + AI insights.
- Global AI chat (Gemini 3 Flash), NL Quick-Add (task/expense/note).
- Weather (Open-Meteo), placeholder news.
- Splash → Login → AppShell with sidebar/bottom-nav.
- Backend 16/16 pytest pass; frontend 95%.

### v1.1 (2026-02-??, Phase 2 delta)
- **Theme revamp**: black + rich gold (#C9A961 / #E4C98C), R.K.M. brand logo.
- **Documents** module: 2 built-in templates (RKM Foundation Donation Receipt,
  K.R.M. HUF Invoice) rendered with reportlab to beautiful gold/black PDFs.
  Custom `.docx` templates upload with `{{placeholder}}` discovery via docxtpl.
- **Reminders & Alarms**: CRUD + recurrence + `.ics` download + Telegram ping at fire time.
- **Telegram bot (@mindmattersbot)**: two-way via polling.
  - `/start <code>` from the app links the account.
  - Inbound text → auto-parsed task/expense/note with confirmation reply.
  - Reminders ping at exact time.
- **Share Statements**: `/api/share/statement` generates a branded PDF
  (loan, tasks-per-person, or monthly cash flow) and sends it to Telegram.
- **GNews** live headlines (country=in).
- **Settings** page: Telegram link flow, profile view.
- **Login**: Google OAuth button removed (demo-login only per user choice).
- Backend: 28/28 pytest pass. Frontend: 100% of tested flows.

## Prioritized Backlog
### P0
- [ ] None blocking — ready to demo.
### P1
- [ ] Morning AI briefing cron (5-line digest via Telegram).
- [ ] 7/30-day trend charts on dashboard.
- [ ] Optional email delivery (Resend) for statements/PDFs.
### P2
- [ ] Multi-user accounts + Google OAuth (credentials to be provided).
- [ ] Real investment NAV feeds.
- [ ] PWA / offline queue.
- [ ] Telegram photo OCR for receipt → expense.
- [ ] `.docx` → PDF conversion for custom templates (needs libreoffice or online svc).

## Environment
- `MONGO_URL`, `DB_NAME` (pre-provided)
- `EMERGENT_LLM_KEY` ✅
- `JWT_SECRET` ✅
- `NEWS_API_KEY` ✅ (GNews)
- `TELEGRAM_BOT_TOKEN` ✅ (@mindmattersbot)

## Frontend env
- `REACT_APP_BACKEND_URL` ✅
