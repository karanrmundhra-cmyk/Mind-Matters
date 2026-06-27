# Migrations

The baseline migration is generated from `schema.prisma` the first time the database is
connected (engine binaries are required and aren't reachable in the offline build sandbox):

```bash
# 1. Set DATABASE_URL + DIRECT_URL in .env.local (see KEYS_NEEDED.md → Supabase)
npm run db:migrate -- --name init     # creates prisma/migrations/<ts>_init + applies it
psql "$DIRECT_URL" -f prisma/rls.sql  # apply Row-Level Security policies
npm run db:seed                       # optional: development data
```

- Forward migrations are the timestamped folders Prisma creates under `prisma/migrations/`.
- Rollback: keep the previous migration; use `prisma migrate resolve` / a down script per release.
  Destructive operations are guarded — no column/table drops without an explicit reviewed migration.
- `prisma/rls.sql` is idempotent-ish policy SQL applied after each migration in non-local envs.

> Until Supabase credentials are provided, the schema is verified by `prisma validate` /
> `prisma generate` in any engine-reachable environment (local dev, CI, Vercel). The domain/service
> layer that sits on top is already verified here by the unit tests (`npm run test`).
