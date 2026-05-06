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

### v1.3 — AI confirmation everywhere + Insurance + Telegram 2-way (2026-02)
- **Universal AI confirmation row**: AiAddBar now renders an EDITABLE preview row
  matching every page's exact table headers. User edits before saving — no more
  blind auto-save. Backwards-compat via `describe` fallback for legacy callers.
- **Tasks**: parser forces a one-word verb in `task` (rest → `details`); auto-fills
  today's date when missing; bell icon (`task-to-reminder`) on each row creates
  an aligned reminder/alarm.
- **Loans**: new `interest_type` field (`percent` | `fixed`). Fixed = flat ₹ amount,
  percent = pro-rated daily. Manual UI selector + inline column.
- **Investments**: split into Investment vs Insurance tabs with their own totals.
  New `insured_for` field (Self / Wife / Mother / Father / Children / Medical / …).
  Manual add toggles between Investment and Insurance kinds.
- **Cash Flow**: bank-statement upload (`/api/transactions/upload`) returns flagged
  duplicates; UI renders a one-by-one Keep / Skip review card.
- **Invoices**: AI bar (`/api/parse/invoice`) extracts fields from free text and
  shows a confirmation preview before applying to the form.
- **Telegram bot**: inline-keyboard ✓ Add / ✗ Discard confirmation before saving;
  parses statement queries ("pending tasks of Brinda", "loan statement of Rakesh",
  "cash flow this month") → returns a generated PDF.
- **Title-case smart**: backend + frontend both Title-Case strings; preserve
  ALL-CAPS abbreviations (LIC, HDFC, GST, …).
- **Routes**: `/cashflow` aliased to `/cash-flow` for resilience.
- **Tests**: 9/9 v1.3 backend pytest pass; 7/7 critical Playwright frontend flows
  green; carry-over 23/23 v1.2 + 12/12 phase2 still passing.

### v2.0 — Mobile-first · Unified Cash Flow · Email Auth · Groups everywhere (2026-02)
- **Breaking**: Loans + Investments pages removed (merged into Cash Flow).
  Invoices + News widgets removed. Loans + Investments collections wiped on
  startup (one-time migration — user-confirmed).
- **Cash Flow is now THE ledger**: categories income|expense|asset|liability
  with 4 rolling-total tiles. Loans live as liability/asset with interest in
  remarks; Investments as asset; Insurance as liability with `insured_for`
  field on the row.
- **Email + password auth**: `/api/auth/signup` (name, email, password) and
  `/api/auth/login`. bcrypt hashed. First signup auto-attaches to the legacy
  demo user so existing data is preserved. Demo-login kept for compatibility.
- **Dashboard redesigned**: 5 quick-access icon tiles
  (Tasks/Routines/Cash Flow/Notes/Reminders), two affirmations (internet
  quote from zenquotes + user's personal fixed affirmation saved on the user
  model), no more News/Routine-% cards.
- **Groups everywhere**: Tasks, Routines, Cash Flow get a free-text `group`
  field that autofills from prior entries and renders as clickable tabs. The
  `+ New group` button accepts any custom name. Routines' legacy block1..4
  retired in favour of these user-named groups.
- **Custom frequency on Routines**: no more Daily-only enum — free text with
  autocomplete from datalist.
- **Reorder**: every row on Tasks / Routines / Cash Flow has up/down arrows
  AND HTML5 drag-and-drop. Backed by new `POST /api/{resource}/reorder`.
- **Reminder source context**: reminders created from any page carry
  `source_page` + `source_context` snapshot and render a mini-card showing
  the original row's fields on the Reminders page.
- **Daily quote**: new `GET /api/quote/today` (zenquotes + deterministic
  fallback).
- **Layout contract** (Tasks/Routines/Cash Flow/Notes/Reminders): headers
  visible → manual entry row BELOW headers → actual data rows. Plus page
  subtitle + one-line description, chip + Bulk add, AI bar, filters, group
  tabs. Every row ends with reminder · delete · up · down · drag handle.
- **Mobile-first**: narrow-screen friendly padding + viewport targeting,
  responsive stat grids, column collapse at `md:`.
- **Tests**: backend 13/13 v2.0 pytest pass; frontend 14/15 Playwright pass
  (one MEDIUM testid alias fixed post-test — Tasks #new-row `new-task-task`).

### v2.3 — Smarter AI · editable Sr · status auto-tick · prominent Set button (2026-02)
- **Tasks AI parser**: now extracts `date`, `group` (from `#group:` / `Group:`),
  `name` (To person), `task` (verb), `details`, `status`, AND `reminder_at`
  when a clock time is given. The frontend auto-creates a linked reminder when
  `reminder_at` is present. Example "Remind rahul to send invoice #group:work
  on 05/06/2026 4:00 pm" → all fields filled + reminder for 5 Jun 4 PM.
- **Routines AI parser**: smarter mapping — time-of-day words ("morning",
  "evening") become `group`, person words ("self", "wife") become `name`,
  verb becomes `activity`, qualifier ("at park") becomes `details`. Example
  "morning walk at park daily self" → group=Morning · name=Self · activity=Walk
  · details=at park · frequency=Daily.
- **Editable Sr column**: Tasks AND Routines now have a `<input type=number>`
  for the Sr cell. Editing it triggers a backend resequence
  (`PATCH /tasks/{id}` or `/routines/{id}` with `{sr_no:N}`) that shifts other
  rows to keep numbering contiguous.
- **Routine sr_no fix**: routine create/bulk now assign sr_no automatically;
  delete compacts the sequence; `/routines` list backfills sr_no for any
  legacy docs missing it (one-time migration on first read).
- **Up/down arrows + drag**: useReorder now optimistically updates `sr_no` on
  every row in state (before the POST returns) so the visible Sr number
  changes immediately on move. POST `/api/{tasks|routines|transactions}/reorder`
  also writes sr_no = idx+1 on the server.
- **Task status**: select dropdown with Pending / Completed / Follow-Up + any
  custom statuses ever entered + a "+ Custom…" sentinel that prompts for a
  new name. "Done" still treated as completed for backward compat.
- **Auto-tick on Completed**: setting status to "Completed" via the dropdown
  auto-fills the tick AND sinks the row to the bottom (sort by status). Tick
  toggles between Pending and Completed.
- **Filter parity**: every header on Tasks (Sr, Date, Group, To, Task, Details,
  Status) and Routines (Sr, Group, Name, Task, Details, Frequency) now passes
  `options=[distinct values]` to FilterHeader so users see one-click pick
  lists like the existing To/Status filters. Frequency filter no longer shows
  values that don't exist in the data.
- **Frequency dropdown**: replaced the freeform input on Routines with a
  proper `<select>` (Daily/Weekly/Monthly/Quarterly/Half-Yearly/Yearly + any
  user-added custom values + "+ Custom…" sentinel).
- **Enter-key navigation**: pressing Enter inside any input/select on a
  Tasks or Routines data row now jumps focus to the next field in the same
  row (selection auto-selects). Already worked on the #new entry row;
  now extended to existing rows.
- **Date column width** (Tasks): widened to 140px so dates like "05/06/2026"
  are fully visible.
- **Reminder Dialog Set button**: redesigned as a prominent gold-gradient
  pill ("Set time" / "Time set" toggle) next to the date picker, with a
  helper subtitle explaining the flow. Main CTA renamed from
  "Create Reminder" → "Set Reminder".

### v2.2 — Reminders grouped by source · Tasks tick · Vendor/Mode rename · Setup PDF · Reset & Seed (2026-02)
- **Tasks**: each row gets a circular tick button. Clicking it toggles
  Pending↔Done; "Done" rows automatically sink to the bottom (sort by status).
- **Reminders page rewrite**: upcoming reminders are grouped by `source_page`
  (Tasks / Routines / Cash Flow / Notes / Standalone). The buggy
  `renderGroupedUpcoming` reference + missing `capWords` import that broke the
  page at session start are fixed; auto-capitalization is fully removed here.
- **Cash Flow column rename**: Name → Vendor, Remarks → Mode. Backend keeps
  both fields populated for backwards compat (`vendor`, `mode` written
  alongside legacy `name`, `remarks` on every insert/patch).
- **"+ Create Custom" placeholders** on every `#new` row across Tasks /
  Routines / Cash Flow datalist inputs — communicates "type anything new or
  pick from the dropdown".
- **AI bar tagline removed**: "Type & review before saving" caption stripped
  per user feedback (the AiAddBar is now silent until parsed rows appear).
- **Reset & Seed**: `POST /api/reset/seed` (body `{confirm:"RESET"}`) wipes
  this user's tasks/routines/transactions/notes/reminders/deadlines and seeds
  exactly one example per page. Useful for new users to see the layout.
- **Bank statement upload mapped to v2.2 schema**: `/api/transactions/upload`
  now writes `vendor`, `mode`, `head`, `category` alongside legacy fields.
- **Telegram setup PDF**: new public `GET /api/docs/telegram-setup.pdf`
  renders a 10-step BotFather setup guide; Settings page has a "Setup PDF"
  download button on the Telegram card.
- **Notes list-append AI prompt**: AI returns `list_title`/`list_tag`+`items`
  → `POST /api/notes/append-list` patches the existing list instead of
  creating duplicates.

### v2.1 — UX revamp: filter-per-column · quick-tags · reminder modal · calendar sync (2026-02)
- **Global**: auto-capitalization removed (frontend `capWords`, backend
  `_title_case_smart` + `_normalize_row`). All string inputs preserve the
  user's exact text. Default date = today on every manual entry row.
- **AiAddBar tagline** changed to "Type & review before saving."
- **Quick-tag pills** on AI bar: existing groups (Tasks/Routines/Cash Flow)
  and hashtags (Notes) render as tappable chips that inject
  `Group: <name>` or `#<tag>` into the textarea.
- **Per-column filters**: every table header has a tiny filter icon
  (Excel-style popover with search + one-click distinct values). The old
  top-bar Filter card is gone.
- **ReminderDialog**: row bell icons now open a macOS-Reminders-style modal
  (title / date / time / recurrence: None, Every Day, Every Week, Every
  Month, Every 3 Months, Every 6 Months, Every Year). No more auto-create.
- **Notes list-append**: `POST /api/notes/append-list` matches by title
  substring or tag, appends bullets to the found list, or creates a new
  one. AI prompt teaches the model to return `list_title` / `list_tag` +
  `items[]` so "add milk, eggs to #shopping" updates the existing list.
- **Notes reminder** now applies to the **entire note/list**, not per line.
- **Routines**: added "Name" column between Group and Task; PATCH accepts it.
- **Cash Flow**: "Bulk add" button removed — upload-only (same bulk parser).
- **Calendar subscription**: iCal feed URL (`GET /api/cal/{token}.ics`) —
  public, rotatable token endpoint in Settings. Paste into iOS / Google /
  Outlook Calendar to auto-sync every reminder. Step-by-step instructions
  shown for each platform.
- **Reminders "Send again"**: `POST /api/reminders/{id}/resend` duplicates a
  sent reminder with `fire_at` shifted by recurrence period (or +1 day).
- **Settings rewritten**: Account block shows real email; Change Password
  form (`POST /api/auth/change-password`, bcrypt); Calendar Subscription
  with copy + iOS/Google steps + rotate; Telegram step-by-step BotFather
  guide; Data Export (`GET /api/export/data.xlsx` — multi-sheet xlsx of
  tasks/routines/cash flow/notes/reminders/deadlines); About.
- **Table UX**: new `.mm-input-ghost` CSS — inputs look like plain text
  until hovered / focused, restoring v1.3 readability with v2 editability.
- **Bug fix**: Tailwind purge was stripping dynamic `md:grid-cols-[…]`
  template classes → tables stacked vertically. Safelisted the three
  grid-template strings in `tailwind.config.js`.
- **Tests**: 16/18 v2.1 backend pytest pass (2 failures are test-script
  strictness bugs, not product bugs). All 14 frontend smoke assertions
  pass (testids, redirects, reminder dialog flow, settings sections).

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
- [ ] Refactor `server.py` (~2100 lines) into per-resource routers (pending since iter_3)
- [ ] Toast on POST /api/tasks failure in manual #new row; required-field hints
- [ ] Virtualize Routines list when > ~150 rows (Karan is at 54 today)
- [ ] Fuzzy duplicate detection on bank-statement uploads
- [ ] Add `group` migration helper: walk old routines with `time_block` and copy it into `group`
- [ ] `GET /api/affirmations/today` should not insert a row — return empty default instead
- [ ] `.docx` → PDF conversion for custom templates (libreoffice)
### P2
- [ ] Google OAuth on top of email/password
- [ ] Real investment NAV feeds via Alpha Vantage / CoinGecko
- [ ] Dashboard proactive anomaly insights (overdue loans, expense spikes)
- [ ] PWA + offline queue
- [ ] Routines page: 4-block visual dashboard replaced by per-group horizontal swim lanes

## Environment
- `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`,
  `NEWS_API_KEY` (GNews), `TELEGRAM_BOT_TOKEN` (@mindmattersbot).
- Frontend: `REACT_APP_BACKEND_URL`.
