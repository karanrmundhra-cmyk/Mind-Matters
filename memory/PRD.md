# Mind Matters — Personal Operating System (PRD)

## Product intent
Premium, AI-powered Personal OS — a single command center for tasks, discipline,
finances, loans, investments, notes, invoices, and reminders. **Black + Gold** theme
with the R.K.M. brand logo. AI-first input on every page (type → confirm → done).

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Modular: `server.py`, `docs_gen.py` (PDFs),
  `tg.py` (Telegram polling + reminder scheduler).
- **Auth**: Demo-login (JWT, single-user) for v1.
- **AI**: Gemini 3 Flash via Emergent Universal Key.
- **File parsing**: pandas (Excel/CSV), pdfplumber (PDF), docxtpl (custom templates).
- **Telegram**: long-poll `getUpdates` background task; inbound text → AI-parsed
  task/expense/note; outbound bot API for reminders + PDF delivery.
- **Reminder scheduler**: asyncio loop every 30s; pings Telegram on fire.
- **Frontend**: React + Tailwind + Shadcn UI. Cormorant Garamond (serif), Outfit
  (display), Inter (body). Pure black + rich gold (#C9A961 / #E4C98C).

## What's implemented

### v1 (initial, 2026-02)
- Auth, Tasks, Routines (+ streaks), Loans (+ interest), Cash Flow (+ AI upload),
  Investments, Notes, Affirmations, Dashboard insights, AI chat, Quick-Add.

### v1.1 — Documents + Telegram (2026-02)
- Black + gold theme + R.K.M. logo.
- Documents/Invoices module: 2 built-in templates (RKM Donation Receipt, KRM HUF
  Invoice). Custom .docx templates with `{{placeholders}}`.
- Reminders & Alarms with Telegram pings + .ics download.
- Telegram bot @mindmattersbot two-way (link via Settings).
- Share-statement PDFs to Telegram.
- GNews live headlines.

### v1.2 — UX overhaul + AI-first input (2026-02)
- **Dashboard simplified**: greeting (name in gold gradient) + weather +
  Routines-today % + affirmation + multi-deadline countdown + GNews headlines.
  Removed Insights/Jump-in/quick-add tiles/pending/cash/loans cards.
- **Universal AiAddBar** at top of every module: type plain English → preview → confirm.
- **BulkAddDialog**: paste TSV/CSV/text or upload .xlsx/.csv → AI normalizes → confirm.
- **Sidebar order**: Dashboard, Tasks, Routines, Cash Flow, Loans, Investments,
  Invoices, Notes, Reminders, Settings.
- **Tasks**: column order Sr|Date|Person|Task|Details|Status; sr_no auto-renumbers
  on delete (compaction).
- **Routines**: master list + daily checklist (auto-resets daily). 4 fixed time
  blocks: Block 1 · 4 Hours, Block 2 · 8 Hours, Block 3 · 4 Hours, Block 4 · 8 Hours.
  Columns: Hour | Task | Details | Frequency.
- **Loans**: heading "Sr Number Date Name Amount Interest Details"; sr_no compacts.
- **Cash Flow**: simplified manual entry (Date Amount Details Company Head); AI
  Auto-fill button for Head/Company/Mode.
- **Investments**: removed current_value/growth from required UI. Custom Type
  support. Columns: Sr | Type | Date | Provider | Amount | % or Maturity Value.
- **Notes**: image upload (base64 in Mongo, max 4MB) with grid + delete.
- **Invoices** (renamed from Documents): RKM Receipt + KRM Invoice rendered
  pixel-closer to source format. Comma-tolerant amount parser.
- **Reminders**: recurrence enum extended — Quarterly, Half-Yearly, Yearly added.
- **Backend**: 23/23 v1.2 pytest pass. Frontend: 14/14 critical flows after fixes.

## Persona
1. **Single-user owner** (v1) — Karan, all-in-one premium command center.
2. **Multi-user team** (v2) — schema already supports via `user_id`.

## Prioritized Backlog
### P0 — None blocking.
### P1
- [ ] Refactor `server.py` (~1850 lines) into routers (deadlines, parse, notes_images, etc.)
- [ ] Surface AI parse errors with `{error, raw}` so AiAddBar can hint the user.
- [ ] Bulk-write sr_no compaction (faster for >100 rows).
- [ ] `.docx` → PDF conversion for custom templates (libreoffice or web service).
- [ ] Telegram photo OCR for receipts → expense.
### P2
- [ ] Multi-user accounts + Google OAuth.
- [ ] Real investment NAV feeds.
- [ ] PWA / offline queue.
- [ ] Migrate old routines (`category` → `time_block`).

## Environment
- `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`,
  `NEWS_API_KEY` (GNews), `TELEGRAM_BOT_TOKEN` (@mindmattersbot).
- Frontend: `REACT_APP_BACKEND_URL`.
