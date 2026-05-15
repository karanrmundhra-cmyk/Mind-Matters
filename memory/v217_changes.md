# v2.17 — Multi-Project, Strict Seed, 3-Level Subtasks

## Backend changes
- `/api/projects` CRUD with `project_id` filter on all 6 data routes
- `Project`, `ProjectMember`, `Comment` collections
- Auto-create "Personal" default project per user
- Backfill `project_id` on existing rows for legacy users
- `_purge_legacy_demo_data()`: wipes Coffee Shop, Welcome reminder, Quarterly Review deadline, Shopping List note signatures
- `_seed_strict_starter(uid, project_id)`: strict 2-tasks + 2-routines + 2-cashflow seed (NO notes/reminders/deadlines)
- Roles: admin | editor | commenter | viewer
- POST `/api/projects/{id}/share` with email + role
- POST `/api/projects/{id}/comments` for resource-level comments

## Frontend changes
- `/lib/projects.js` — ProjectProvider + useProjectReload hook
- `/components/ProjectSelector.jsx` — dropdown with active project, color dot, "Shared" badge
- `/components/ShareDialog.jsx` — invite by email + role select + member list
- `/lib/api.js` — axios interceptor injects `project_id` query/body on data routes
- `/lib/nestRows.js` — generic 3-level interleaver (depth 0, 1, 2)
- `pl-10` (depth 1) and `pl-20` (depth 2) progressive indent on Tasks/Routines/CashFlow

## Test credentials
karan@mindmatters.local / changeme123
