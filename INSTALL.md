# Install & local development

## Prerequisites
- Node.js ≥ 20
- npm ≥ 10
- (For real persistence) a Postgres database — Supabase, or local Postgres via Docker (below)

## Steps
```bash
git clone <your-repo-url> mind-matters && cd mind-matters
cp .env.example .env.local        # fill in values as you get them — see KEYS_NEEDED.md
npm install
npm run dev                       # http://localhost:3000
```

The app runs **without any keys**: it uses an in-memory repository (seeded sample data) and a
deterministic stub for AI parsing. Capture → confirm → loops → reminders → routines → dashboard all
work locally. Add keys to switch on persistence and live AI.

## Quality gates (run before committing)
```bash
npm run typecheck     # tsc --noEmit, strict, no `any`
npm run test          # vitest unit/integration
npm run lint          # eslint
npm run build         # production build
```

## Local Postgres (optional, for Prisma)
```bash
docker compose up -d db            # starts Postgres on localhost:5432
# set DATABASE_URL/DIRECT_URL in .env.local to the local db (see docker-compose.yml)
npm run db:migrate -- --name init  # generate + apply the baseline migration
psql "$DIRECT_URL" -f prisma/rls.sql
npm run db:seed
```

## Notes
- Prisma engine binaries download on first `prisma generate` (needs network).
- The in-memory repository resets on restart — it's dev/test scaffolding only. The Prisma repository
  implements the same `WorkspaceRepository` interface and replaces it with no other code changes.
