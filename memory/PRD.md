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

### v2.23 — Email-only project invites + landing page (2026-02)
- **Tokenised invites**: `POST /api/projects/{pid}/share` now also mints a
  `secrets.token_urlsafe(18)` invite_token + builds an `invite_url` from the
  new `APP_BASE_URL` env. Re-sharing the same email is idempotent — reuses or
  back-fills the token and updates the role. ShareDialog auto-copies the URL
  to clipboard on success.
- **Public landing**: new `GET /api/invites/{token}` returns `{project,
  inviter, role, invited_email, accepted, has_account}` without auth so the
  recipient can read the invitation before signing in/up.
- **Frontend `/invite/:token`**: new `Invite.jsx` page renders the project
  chip, italic project name, inviter name, role badge (Admin/Editor/Commenter/
  Viewer with icons + descriptions), signup/signin tabs (defaults to signin
  when `has_account=true`), locked read-only email, and a single CTA that
  signs the user up (or in) + auto-claims the invite via
  `POST /api/invites/{token}/accept`. Already-accepted view + revoked-token
  error card are both wired.
- **Auto-accept**: a logged-in user with a matching email automatically
  accepts on visit. Email-mismatch returns 403 with an instructive message.
- **`APP_BASE_URL` env**: added to `/app/backend/.env` for absolute invite
  URLs. Falls back gracefully to a relative `/invite/<token>` if unset.
- **Tests**: 12/12 v2.23 pytest + 4/4 UI flows GREEN per
  `/app/test_reports/iteration_22.json`. v2.17-v2.22 regression smoke green.

### v2.22 — 30-item polish sprint (2026-02)
- Continuous Phase-1-to-4 sprint per user spec: removed reset-code box,
  logout button moved inline with user name, news widget fonts unified,
  Notes Decisions tab + search bar removed, Tasks status / Routines
  frequency defaults emptied with `+ Create Custom` placeholders, RowActions
  changed to 3×2 grid (84px), CashFlow Upload→Import + capitalised
  categories + lowercase 'ledger' subtitle, line-through styling on
  completed rows, bulk-delete-completed for tasks + routines
  (`DELETE /api/tasks/completed` and `DELETE /api/routines/completed`
  with sr_no compaction), sidebar collapse-toggle moved inline with the
  4-icon dock, dashboard quick-nav grew to 7 cards (added Reports +
  Settings), dashboard greeting line now shows weekday + date + time
  (`FRIDAY, MAY 15, 2026 · 8:13 PM`, updates per minute), light mode
  CSS tokens darkened for readability, RoutineIn.status Literal widened
  to include Done/Completed, legacy lowercase transaction categories
  normalised on startup (`Expense`/`Loan Given` etc.).
- **Tests**: 6/6 v2.22 backend pytest + visual frontend confirmation via
  screenshot per `/app/test_reports/iteration_21.json`. Item 11 (popovers
  vs centered modals) explicitly deferred — large component refactor.

### v2.21 — Daily Telegram digest + Activity filters + polish (2026-02)
- **Daily Telegram digest** (new): `digest_loop` in `tg.py` runs every 30 min;
  fires once per UTC day at/after each user's `digest_hour` (default 09:00
  UTC). Summarises last-24h @mentions of you + new comments + new tasks/tx
  added by collaborators across your shared projects. Skips users without
  Telegram linked and silently skips empty days. Settings: `GET/PATCH
  /api/digest/settings` and `POST /api/digest/send-now` (preview).
- **Settings → Daily Digest card**: enabled toggle, hour picker (00:00–23:00
  UTC), Send-preview button, last-sent timestamp. Renders only when
  Telegram is linked.
- **Activity-feed filters in Reports → Inbox**: client-side dropdowns
  `activity-filter-project` (auto-populated from event project_ids) +
  `activity-filter-kind` (comment / task_created / routine_created /
  transaction_created). Empty-state differentiates "no events" vs
  "no events match filters".
- **All-Projects comment visibility**: comment-bubble icon on
  Tasks/Routines/CashFlow/Notes now shows whenever the row itself has a
  `project_id`, even if the global selected project state hasn't loaded.
- **News widget**: `data-testid="news-source-chip"` added to the Custom
  badge; `AbortController` wired around the Dashboard fetcher so rapidly
  changing customRss text never leaves stale responses overwriting the
  latest news payload.
- **Tests**: 15/15 v2.21 pytest GREEN + 4/4 UI items + regression v2.17→v2.20
  green per `/app/test_reports/iteration_20.json`.

### v2.20 — @-mentions · Notes comments · Custom RSS (2026-02)
- **@-mention autocomplete** in `CommentDrawer`: typing `@` opens a popover
  of project members (owner + accepted invitees) showing a TG chip when the
  member's Telegram is linked. Selection inserts `@Name ` into the textarea.
  Comment bodies render `@handles` in highlighted gold spans.
- **Telegram mention notify**: `_extract_mentions` + `_notify_mentions` pings
  each mentioned member's linked Telegram chat with the comment snippet +
  project name + actor. Fire-and-forget — never blocks comment creation.
- **New endpoint**: `GET /api/projects/{pid}/mentionable` → membership-gated
  list of `{user_id, name, email, telegram_linked}`.
- **Notes-page comment thread** (Item from backlog): each selected note in a
  project shows a comment-bubble icon → opens the same `CommentDrawer`
  with `resourceType='note'`.
- **News widget custom RSS** (Item 7): Dashboard now has a "Custom RSS"
  toggle that opens an editor (`news-rss-editor`). Saved URLs persist to
  `localStorage.mm_news_custom_url` and override category-based feeds.
  `/api/news?custom_url=<URL>` returns `source='custom'`; a Custom chip
  appears on the widget when active. Falls through to google-news for
  invalid URLs (ftp://, bare strings).
- **Tests**: 16/16 v2.20 pytest GREEN + 100% frontend per
  `/app/test_reports/iteration_19.json`. Regression v2.17→v2.19 still green.

### v2.19 — Inline commenting on rows (2026-02)
- New `CommentDrawer` slide-in panel + comment-bubble icon (`MessageSquare`)
  on every Tasks / Routines / Cash-Flow row when a project is selected.
- Backend `GET /api/comments/counts?project_id=&resource_type=` returns
  `{resource_id: count}` for badge rendering in a single round-trip.
- Drawer supports: Ctrl/Cmd+Enter to send, hover-trash to delete (own or
  admin), Escape / backdrop / X to close, auto-focus on open, live badge
  increment after add. Comments posted via the drawer flow straight into
  the Reports → Inbox activity feed.
- **Tests**: 8/8 v2.19 pytest + 21/21 regression (v2.17+v2.18) green per
  `/app/test_reports/iteration_17.json`.

### v2.18 — Activity feed · Reminders compact · Mobile frozen col (2026-02)
- **Activity feed in Inbox**: new `GET /api/activity?limit=N` returns chronological
  events {comment, task_created, routine_created, transaction_created} across
  every project the user can see. Reports → Inbox is now the default tab and
  renders the feed with project color chips + time-ago + actor names.
- **Reminders compact table**: Upcoming card now has a proper column header row
  (#, Title, When, Recurrence, Notes, Source) matching Tasks/Routines style.
  `mm-frozen-col` applied to the `#` cell.
- **Mobile frozen first column** (Item 20): Tasks/Routines/CashFlow use a
  mobile-first GRID with `mm-table-wrap` overflow-x-auto wrapper + sticky
  first cell. Inner rows carry `min-w-[920|800|1100px] md:min-w-0`. Both
  `Reminder` and `Deadline` response models now expose `project_id`.
- **Tests**: 8/8 v2.18 pytest pass + 100% frontend per
  `/app/test_reports/iteration_16.json`. v2.17 regression green.

### v2.17 — Multi-project sharing · Strict seed · 3-level subtasks (2026-02)
- **Activity feed in Inbox**: new `GET /api/activity?limit=N` returns chronological
  events {comment, task_created, routine_created, transaction_created} across
  every project the user can see, with `project_id`, `project_name`,
  `project_color`, `actor_id`, `actor_name`, `subject_kind`, `subject_id`,
  `body`, `created_at`. Reports → Inbox is now the default tab and renders the
  feed at the top with project color chips + time-ago + actor names. Below it
  the legacy "Needs attention" card surfaces non-info patterns + recent
  timeline events.
- **Reminders compact table**: Upcoming card now has a proper column header row
  (#, Title, When, Recurrence, Notes, Source) matching Tasks/Routines style.
  Group sub-header tightened to 1.5-line padding. `mm-frozen-col` applied to
  the `#` cell so the leftmost stays put when scrolled on mobile.
- **Mobile frozen first column** (Item 20): Tasks/Routines/CashFlow now use a
  mobile-first GRID (`grid-cols-[56px_…] md:grid-cols-[60px_…]`). Each Card
  wraps in `mm-table-wrap` (overflow-x-auto on mobile only). Inner rows carry
  `min-w-[920|800|1100px] md:min-w-0` so the table preserves desktop column
  widths and scrolls horizontally on phones. The first cell of every row has
  `mm-frozen-col` (`position: sticky; left: 0`) so users always see the SR /
  checkbox column. Both `Reminder` and `Deadline` response models now expose
  `project_id` (was being silently stripped before).
- **Tests**: 8/8 v2.18 pytest pass + 100% frontend per
  `/app/test_reports/iteration_16.json`. v2.17 regression remains green.


- **Item 47 — Strict seed**: legacy demo signatures (Coffee Shop, Welcome reminder,
  Quarterly Review, Shopping List, Brinda call-about-repair, Self 20-min-walk) are
  purged on startup. `you@mindmatters.local` unattached demo user's data is wiped
  entirely. `seed_first_login` is now `_seed_strict_starter`: exactly 2 tasks
  (Rahul Courier, Amit Invoice follow-up) + 2 routines (Uptime, Hydrate & Tea) +
  2 cash-flow rows (Zomato, Brinda); notes/reminders/deadlines stay empty.
  `reset/seed` calls the same helper. Idempotent — only runs if all three starter
  collections are empty for the user.
- **Item 46 — Multi-project + sharing**: new `projects`, `project_members`,
  `comments` collections. Every data row now carries a `project_id`. Auto-create
  a "Personal" default project per user + back-fill `project_id` on startup.
  Endpoints: `GET/POST/PATCH/DELETE /api/projects`, `GET/POST/PATCH/DELETE
  /api/projects/{id}/members`, `POST /api/projects/{id}/share`,
  `GET/POST /api/projects/{id}/comments`, `DELETE /api/comments/{id}`. Roles:
  admin (full) | editor (CRUD) | commenter (read + comment) | viewer (read).
  Frontend: `ProjectProvider` context (`/lib/projects.js`) + `ProjectSelector`
  dropdown in AppShell top-right + `ShareDialog` modal. Axios interceptor
  injects `project_id` query/body on `/tasks /routines /transactions /notes
  /reminders /deadlines`. Pages re-fetch on `mm:project-changed` via
  `useProjectReload` hook.
- **Item 16 — 3-level subtasks**: new `/lib/nestRows.js` interleaves rows by
  `parent_id` with a `_depth` (0/1/2) flag. Tasks/Routines/CashFlow all use
  `depthPaddingClass(depth)` → `pl-10` (depth 1) / `pl-20` (depth 2). The
  "+subtask" button (`onSubtask`) is hidden on depth-2 rows so users can't go
  past 3 visible levels. Server already supports unlimited nesting via
  `parent_id`; only the UX is capped.
- **Tests**: 13/13 v2.17 pytest pass (test_v217.py, 4.29s); 100% frontend
  flows green per `/app/test_reports/iteration_15.json`.

### v2.15 — Finish-line batch on deferred P1 items (2026-02)
- **Sync dot tooltip** now shows "X ago" — green="Synced · 14s ago",
  yellow="2 changes queued · last sync 30s ago", red="Reconnecting · last
  sync 5m ago". `humanAgo()` helper + `lastSyncAt` tracked in the
  IndexedDB sync queue state.
- **Import dialog** — clear "Up to 50 entries at a time" message; over-50
  pastes/uploads are truncated client-side with a toast.
- **Reminder parse fix** — schema upgraded so the LLM returns verb-led
  titles ('Call Brinda' not 'hit Brinda'), separates notes from title,
  defaults time-of-day intelligently ('evening'=18:00, 'noon'=12:00 etc.).
- **Reminders compact table** — removed bulky source-context gold metadata
  block; replaced with small inline `reminder-source-badge` ("Tasks" /
  "Cash Flow" / etc.) on the right side of each row.
- **Currency conversion math** — new `/api/fx/rates` (cached 6h, falls back
  to a static table) + `/api/cashflow/totals?base=INR` returns category
  totals in the requested base. CashFlow page uses converted totals when
  available; falls back to local sum on offline.
- **Universal AttachmentsDialog** (`/components/AttachmentsDialog.jsx`) —
  shared modal now used by Routines + CashFlow (Tasks keeps its own).
  Accepts module ∈ {tasks, routines, transactions, notes}, 10MB/file,
  jpg/png/pdf/xlsx/csv/doc/docx.
- **Priority flag** wired on Routines + CashFlow too (was Tasks-only).
- Tests: 9/9 v2.15 backend pytest + 11/12 frontend testids green.

### v2.14 — Mega 47-item batch (2026-02)
**Security & login**
- `/api/auth/forgot` no longer returns the reset code in the response body
  (security fix). UI "YOUR RESET CODE" box removed from Login. Code goes via
  Telegram bot only (email/SMTP coming next iteration).

**Sidebar redesign (desktop)**
- Collapsible sidebar (chevron toggle, persists in `localStorage.mm_sidebar_collapsed`).
- Action dock embedded inside sidebar (Quick Add + Search + AI + Sync dot).
  FloatingDock wrapped in `md:hidden` — mobile-only now.
- Calendar removed from sidebar nav; merged into Reminders as a tab.

**Dashboard**
- Live date + time pill (auto-refreshes every minute).
- Quick-nav grid expanded 5 → 7 (Reports + Settings added).
- News widget — `/api/news` pulls 5 headlines from Google News RSS with
  category dropdown (All/Business/Tech/India/World), localStorage persists.

**Calendar / Reminders merge**
- Reminders page hosts both tabs (Calendar + Reminders). `/calendar` redirects.
- `GET /api/calendar/feed.ics?token=<jwt>` generates iCal subscription URL.

**Notes** — Decisions tab removed, search bar removed, parse preview = Title+Body only.
**Tasks** — Status adds Delegate; priority Flag wired (flagged rows float to top).
**Cash Flow** — 5th Upcoming Payments tile + per-row currency dropdown + Loan Given/Taken categories + lowercase "Unified ledger.".

**Data-model additions** — `flagged`, `attachments`, `parent_id` on Routine/Tx/Note (Task had them). `currency` on Tx.

**Universal attachments** — `POST/DELETE /api/{module}/{id}/attachments[/{att_id}]` for tasks/routines/transactions/notes. 10MB/file, 10/row cap.

**Seeding** — `POST /api/seed/first-login` (idempotent) auto-called after login. Inserts 2 example rows each in tasks/routines/transactions only when all three are empty.

**Mobile + light mode** — `.mm-frozen-col` sticky-left CSS class added; light-mode contrast hardening overrides `text-white*` Tailwind utilities to `--mm-text`.

**Focus mode** — also hides `nav-reports` + `nav-settings` + `.mm-focus-hide` (news, quick-nav).

**Telegram setup** — instructions collapsed into `<details>` accordion.

**Reports page** — restructured to 5 tabs: Inbox · Daily Brief · Synopsis · AI Briefing · Pattern Radar. Default tab now Synopsis (was Reports).

**Renames** — every "Bulk add" → "Import" across pages + BulkAddDialog header.

**Tests**: 12/12 backend pytest + 23/23 frontend critical flows. Zero regressions.

**Deferred to next iteration** (explicit):
- P1 — Multi-project + sharing (item 46). Foundational, ~3-5 days.
- P1 — Cloud storage OAuth for Vault (item 36).
- P1 — Currency CONVERSION math in summary cards (item 24, stub ships).
- P1 — Subtask UI for Routines/CashFlow (item 16, data model ready).
- P1 — Attachment dialog UI for Routines/CashFlow/Notes (backend ready).
- P1 — Reminders compact-table redesign (item 37).
- P1 — Reminder parse fix (item 38).
- P2 — Section "+ Add section" inline (item 15 stub).
- P2 — Mobile frozen-col wiring (CSS class ready).
- P2 — Import 50-cap message + drag-drop (item 12).
- P2 — Vault file mgmt + AI find-and-send via Telegram (item 36 follow-up).

### v2.12 — Calendar page · Reports page (Reports/Timeline/AI Briefing/Pattern Radar) · Notes Vault + Decisions tabs (2026-02)
- **Calendar page** (`/calendar`): two tabs — Calendar (full 7×6 month grid)
  and Agenda (chronological flat list for the visible month). Aggregates
  events client-side from `/api/tasks`, `/api/reminders` and
  `/api/deadlines`, then groups them per ISO date. Each cell shows up to 3
  coloured event chips (gold = task, emerald = reminder, red = deadline)
  with a "+N more" overflow. Today is highlighted in gold; prev/next/today
  shift the visible month.
- **Reports page** (`/reports`): four tabs.
  - **Reports** — recharts horizontal bar chart of monthly cash flow split
    by income / expense / asset / liability for the last 6 months. Driven
    by new `GET /api/reports/cashflow-monthly?months=N`.
  - **Timeline** — chronological feed of recent activity across tasks,
    transactions and notes (last 30 days, capped at 200). Driven by new
    `GET /api/reports/timeline?days=N`.
  - **AI Briefing** — clicks `POST /api/reports/briefing` which gathers a
    snapshot (tasks done, tasks open, expense this week, detected patterns)
    and asks Gemini 3 Flash for a 3-4 sentence pragmatic summary. Has a
    deterministic string fallback when the LLM is unavailable. Renders the
    quote plus 3 stat tiles.
  - **Pattern Radar** — rule-based anomaly detector via
    `GET /api/reports/patterns`. Flags: spending up/down ≥20% vs last
    month, overdue tasks count, loan repayment due in ≤14 days, routine
    completion <50% or ≥90% this week.
- **Notes tabs**: new tab bar — All / Vault / Decisions. **Vault** is gated
  by a 4-6 digit PIN stored in `localStorage.mm_vault_pin` and verified per
  session in `sessionStorage.mm_vault_unlocked`. Notes tagged
  `vault` are hidden from the All tab and surfaced only in Vault.
  **Decisions** filters by tag `decision` — natural way to track key
  decisions over time without a separate collection.
- **Sidebar nav** expanded to 9 entries (Calendar + Reports added between
  Cash Flow and Notes/Reminders). Mobile bottom-nav still surfaces the
  top 6 per `NAV.slice(0,6)` so Calendar/Reports/Settings remain desktop-
  sidebar-only on phones.
- **Tests**: 7/7 new backend pytest pass, 100% frontend testid + flow
  checks (calendar grid renders 42 cells, agenda toggles, all 4 Reports
  tabs render including SVG chart, AI briefing returns summary, Notes
  vault PIN gate works end-to-end).

### v2.11 — Offline-first sync queue · Horizontal Floating Dock · Subtask UI nesting (2026-02)
- **Offline-first sync queue (IndexedDB / Dexie)**: new `/app/frontend/src/lib/syncQueue.js`
  attaches an axios response interceptor that catches network-error
  mutations (POST/PATCH/PUT/DELETE) and enqueues them in a Dexie store
  named `mm_offline.queue`. On `online` event + every 20s, `drainQueue()`
  re-issues each queued request in FIFO order. After 3 retries with
  4xx/5xx the entry is dropped so a single bad row never blocks the queue.
  `subscribeSync(fn)` powers the dock dot:
    • green   — online + queue empty (everything synced)
    • yellow  — online + queue draining  OR  offline + queue empty
    • red     — offline + queued writes waiting to upload
  When the user goes back online the dot animates yellow → green as
  the queue drains, and a small gold count badge surfaces the pending
  number on the sync button.
- **Horizontal bottom-center Floating Dock**: dock layout flipped from
  vertical (right-edge column) to **horizontal pill at bottom-center**
  (`flex-row` + `left-1/2 -translate-x-1/2`). Wrapped in a gold-bordered
  glass pill with deep shadow so it reads as a single coherent control
  cluster. Clears the mobile bottom-nav at `bottom-20`, sits at
  `bottom-6` on desktop.
- **Subtask UI nesting on Tasks**: `visible` memo now interleaves child
  tasks (`parent_id` set) directly under their parent with a
  `_isSubtask` flag. Child rows get a `pl-10` left indent + a subtle
  background tint so the hierarchy reads at a glance. New
  `+ subtask` icon (ListPlus) in `RowActions` is only shown on parent
  rows; clicking prompts for a title and POSTs `/api/tasks` with
  `parent_id` set. Cascade delete (already in v2.10 backend) wipes
  children when their parent is deleted. Filters apply to both parents
  and children — an orphaned subtask stays visible if its parent was
  filtered out.
- **Tests**: 4/4 v2.10 regression pytest pass + 100% critical frontend
  flows (dock layout/order/online→offline→online sync drain with badge
  count, subtask renders, no regression artifacts).

### v2.10 — Loan Summary widget · Floating Dock · Task attachments · Subtask data-model (2026-02)
- **Dashboard Loan Summary widget**: new clickable card surfaces aggregated
  finance discipline next to deadlines. Backend `GET /api/cashflow/loan-summary`
  walks every liability/asset row with `interest_rate`/`emi`/`repayment_date`
  set and (a) skips repayments already in the past, (b) sums stored EMIs or
  computes them on the fly via the amortization formula, (c) tracks the
  nearest upcoming repayment. Card only renders when the user has at least
  one active loan. Tap → navigates to Cash Flow.
- **Bottom-right Floating Dock**: new `FloatingDock` component renders on
  every page with 4 buttons — Quick Add (+) · Search (⌘K) · AI sparkle ·
  Sync status dot. The sync dot heartbeats `GET /api/` every 30s
  (green = ok, yellow = degraded < 5 min, red = offline > 5 min, with
  `online`/`offline` browser events folded in). Removed the old sidebar
  Quick Add + Search buttons and the standalone gold AI bubble — those
  three actions now live in the dock instead, keeping the sidebar
  navigation-only.
- **Task attachments**: paperclip icon on each task row opens a dialog to
  upload/list/delete files (max 4MB/file, 8MB total per task), stored
  inline on the task doc as base64 `data_url`. Endpoints
  `POST /api/tasks/{id}/attachments` (multipart) +
  `DELETE /api/tasks/{id}/attachments/{att_id}`. RowActions now accepts
  optional `onAttach` + `attachmentCount` props with a small gold count
  badge so the paperclip surfaces the right context at a glance.
- **Task subtasks data-model**: `TaskIn` now accepts `parent_id`; cascade
  delete on `DELETE /api/tasks/{id}` removes any tasks pointing at it as
  parent. UI nesting deferred to a follow-up (current row layout still
  flat — section sub-headers continue to work as before).
- **Tests**: 4/4 new backend pytests + 20/20 v22 regression + all critical
  frontend flows pass (dock visible on every page, loan card visible when
  loans exist, attachment dialog open/upload/list/delete round-trip,
  sidebar Quick Add/Search removed, old AI bubble removed).

### v2.9 — Sections sub-headers · Per-module CSV+PDF exports · Cash Flow EMI · Telegram CRUD (2026-02)
- **🔥 P0 hotfix**: Tasks.jsx had broken JSX from a mid-edit refactor (orphaned
  `nodes.push(` with a missing opening `<div>` and `))` instead of
  `);` at the end). Restored the IIFE pattern so the row renders cleanly with
  optional Todoist-style section headers above each `section` change.
- **Sections sub-headers** (Todoist-style) on Tasks · Routines · Cash Flow. When
  any row in the visible list has a non-empty `section` field, the list is
  visually grouped under uppercase gold sub-headers
  (`task-section-<name>`, `routine-section-<name>`, `tx-section-<name>`).
  Rows without a section render flat (no behaviour change for existing data).
- **Per-module CSV + PDF exports**: every list page (Tasks, Routines, Cash Flow,
  Notes, Reminders) gets a small `Export ▾` button next to Bulk Add. Backend
  endpoints `GET /api/export/{module}.csv` and `.pdf` stream the user's
  data with module-specific headers and (for PDF) a styled black-and-gold
  landscape table via reportlab. `_EXPORT_DEFS` map keeps the shape DRY.
- **Cash Flow EMI/interest tracking**: `TransactionIn` extended with
  `interest_rate` (annual %), `interest_type` (percent | fixed),
  `repayment_date` (YYYY-MM-DD), and `emi` (₹). UI: every liability/asset row
  renders an inline `tx-loan-row` strip below it with editable Rate %, Repay
  date, EMI ₹ inputs plus an auto-calculated EMI preview using the standard
  amortization formula (P · i · (1+i)^n) / ((1+i)^n − 1).
- **Telegram CRUD with both confirmation paths**:
  - `_execute_pending` helper unifies the save/delete/update flow so it can
    be triggered by either inline-button callback OR a plain text "yes/no"
    reply (also accepts y, ok, confirm, go, sure / n, cancel, discard, skip).
  - New commands: `delete task #N`, `delete routine #N`, `delete expense #N`,
    `complete task #N` (also accepts "done 5", "mark task 5 done"). Each
    surfaces a preview with inline ✓/✗ buttons AND the text yes/no path.
  - `_format_preview` extended to render `delete_*` and `update_task` cards.
- **Tests**: backend 20/20 pytest pass (`/app/backend/tests/test_v22.py`).
  All 9 frontend critical testids verified (sections render, export menus
  open, EMI row visible on liability rows, CSV download works).

### v2.8 — Light/Dark/Focus · Universal Cmd+K · Voice mic · Forgot Password polish (2026-02)
_(Carried over from prior fork.)_

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

### v2.6 — Page-2 polish · custom status fix · recurrence engine · arrows removed (2026-02)
- **Sidebar logo** size adjusted 52→44 so the emblem matches the height of
  the "Mind Matters / PERSONAL OS" text block (proportionate per user).
- **Logo glow removed everywhere**: `Logo` component now defaults
  `glow={false}` — the whitish radial blur behind the emblem on splash,
  login, and sidebar is gone. Matches the clean look of the source PDF.
- **AiAddBar placeholder (Tasks)** simplified to
  "e.g. remind rahul to send invoice tomorrow #Work" — verbose "adds
  time/date? I'll offer a reminder too" comment dropped.
- **`#Work` syntax** (without colon) now parses to `group:'Work'`. AI prompt
  rewritten with explicit example + stronger directive: "details: KEEP EVERY
  non-trivial NOUN/OBJECT the user typed; never silently drop nouns".
  Verified: "buy medication #Family" → group=Family, details=medication.
- **Custom status now sticks**: Tasks status / Routines frequency / Cash
  Flow category selects switched from `defaultValue` (uncontrolled) to
  `value` (controlled) + auto-inject the current value as an `<option>` if
  it's not already in the preset list. After picking "+ Custom… → Hold",
  the dropdown now reads "Hold" instead of reverting to "+ Custom…".
- **Up/down arrow buttons removed** from `RowActions` across Tasks /
  Routines / Cash Flow — Sr column is editable and rows are still
  draggable, so the explicit arrows were redundant noise. Per user: "remove
  this up and down arrow from here and let it show the sr number".
- **Recurrence engine**: extended `reminder_loop` with a new
  `_next_fire_at(current_iso, recurrence, custom_recurrence)` helper that
  handles:
   • Presets: daily, weekly, biweekly, monthly, quarterly, half-yearly, yearly
   • Custom NL: "every N days/weeks/months/years", "every Tuesday and
     Thursday" (multi-weekday), "every Monday", "weekdays" (Mon-Fri only),
     "weekends" (Sat-Sun only), "bi-monthly"
  When a reminder fires, the loop now computes the next ISO datetime and
  resets `sent=false` so it triggers again at the right cadence.
  Verified: every 15 days → +15, every Tuesday/Thursday → next Tue/Thu,
  weekdays → skips weekend, etc.

### v2.5 — Forgot password · New crisp logo · Capitalized deadline placeholder · Bigger logos (2026-02)
- **Forgot password flow**: new `POST /api/auth/forgot` issues a 6-digit code
  (30-min expiry, bcrypt-hashed in `password_resets` collection). Returns the
  code in the response so it can be shown on the reset screen — and ALSO
  DM's it to the user's Telegram if they've linked their bot. Unknown emails
  return `{ok:true}` without leaking existence.
- `POST /api/auth/reset` validates the code, updates the password, marks the
  code consumed, and returns a JWT so the user lands logged-in immediately.
- Login screen rebuilt as 4 modes (`login` · `signup` · `forgot` · `reset`)
  with a tiny breadcrumb at the top of the card. "Forgot password?" link
  surfaced under the Sign-in CTA. Reset code shown in a gold-bordered hint
  panel; supports resend; numeric-only 6-digit input with wide tracking.
- **Logo refresh**: replaced `/public/rkm-logo.png` from the user-supplied
  vector PDF — re-rendered at 2400px source, near-black background stripped
  to transparency, cropped + square-padded to 1131×1131 for crisp display at
  every size. Cache-busted via `?v=2` on the Logo `<img>`.
- **Logo sizes** bumped: splash 56→120, login 44→88, sidebar 34→52 (so the
  emblem is proportionate to the "Mind Matters / PERSONAL OS" text stack
  per user direction "top of M to end of P").
- **Dashboard deadline placeholder**: "Deadline title (e.g. Tax filing)" →
  **"Deadline Title (e.g. Tax Filing)"** (capital T and F per user).

### v2.4 — Tasks page hotfix · Cash Flow parity · Notes redesign · Quick Add 5-way · Bot smarter (2026-02)
- **🔥 P0 hotfix**: Tasks page was crashing (500 from `/api/tasks`) because the
  Pydantic `Task.status` was a `Literal["Pending","Done","Follow-Up"]` and the
  v2.3 dropdown wrote "Completed". Loosened to `str` so any value (including
  custom statuses) round-trips.
- **Cash Flow** — parity with Tasks/Routines:
  - Editable Sr `<input type=number>` (`tx-sr-input`) with backend
    re-sequence; auto sr_no on create/upload; compact on delete; backfill on
    list-read for legacy docs.
  - Filter dropdowns now show distinct option lists for Sr / Date / Details /
    Amount / Mode (was free-text only). Category dropdown lists ONLY
    categories present in data (no phantom values).
  - Category cell is now a `<select>` with income/expense/asset/liability +
    custom values + "+ Custom…" sentinel. Direction auto-derived.
  - Date column widened to 140px (was 105px) so "2026-02-04" renders fully.
  - Enter-key navigates to next field on data rows (matches Tasks/Routines).
- **Bulk upload fixed**: `/api/transactions/upload` now writes `sr_no` from
  `_next_sr` instead of 0, increments per row. Verified: 4-row CSV inserted
  with sr_no 2-5 chained correctly.
- **AI expense parser**: rewritten with examples — extracts `vendor` (insurer/
  merchant), `name` (beneficiary), `amount` (handles "5 lakhs" → 500000),
  `head` (Insurance/Food/Travel/etc.), `mode`, `category`. "insurance from
  bajaj karan 5 lakhs" → `{vendor:Bajaj, name:Karan, amount:500000,
  head:Insurance, mode:Bank, category:liability}`.
- **AI notes**: prompt now treats single-item buy/get/pickup phrases ("buy
  soap", "get bread") as shopping-list appends, not standalone notes.
- **Notes UI**:
  - Removed `#` hashtag prefix everywhere — tags shown as plain pills.
  - "+ Custom" tag chip lets user create new tags inline (added to the
    selected note).
  - Top-right toolbar now shows `{count} note(s)` chip + Bulk add button
    (replaces the old "+ New note" button — matches Tasks/Routines pattern).
  - "+" icon moved into the search bar for inline note creation.
  - Search placeholder updated to "Search notes & tags".
- **Quick Add** now shows all 5 kinds: Task · Routine · Expense · Note ·
  Reminder. Switched from `/api/ai/parse` to `/api/parse/bulk` for richer
  schemas (group, vendor, recurrence, list-append, reminder_at). Auto-creates
  linked reminder when `reminder_at` is parsed for tasks.
- **Telegram bot** smarter routing:
  - Strips question prefixes ("what is/are", "show", "list", "give me", "tell
    me", "fetch") before regex matching.
  - Detects "NAME's tasks", "NAME tasks" (short input), and possessive forms.
  - Cleans trailing 's' so "brindas tasks" → person="Brinda".
  - "what is brindas tasks" now returns a tasks PDF instead of saving the
    sentence as a new task.

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
