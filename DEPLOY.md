# Deploy

GitHub is the canonical repo (`PUSH_TO_GITHUB.md`). Recommended hosting: **Vercel** (Next.js native)
with **Supabase** for Postgres + Auth.

## Vercel (recommended)
1. Push to GitHub (see `PUSH_TO_GITHUB.md`).
2. In Vercel: **New Project → import the GitHub repo**. Framework auto-detected (Next.js).
3. Add Environment Variables (from `.env.example` / `KEYS_NEEDED.md`): `DATABASE_URL`, `DIRECT_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, payment keys, `CRON_SECRET`, etc.
4. Deploy. The PWA is then installable on iOS/Android/desktop from the deployed URL.
5. **Cron:** add a Vercel Cron hitting `POST /api/v1/cron/followups` (daily) with
   `Authorization: Bearer $CRON_SECRET`.

## Database
- Create a Supabase project, set `DATABASE_URL` (pooled) + `DIRECT_URL` (direct).
- `npm run db:deploy` to apply migrations; apply `prisma/rls.sql` for Row-Level Security.

## Docker (self-host)
```bash
docker compose up --build         # app + Postgres
```
See `Dockerfile` (multi-stage, standalone Next output) and `docker-compose.yml`.

## Pre-deploy checklist
`npm run typecheck && npm run test && npm run lint && npm run build` all green · env vars set ·
migrations applied · RLS applied · webhooks registered (Stripe/Razorpay) pointing at
`/api/v1/...` with their signing secrets · `CRON_SECRET` set.

## Rollback
Vercel keeps immutable deployments — promote the previous deployment. For DB, keep the prior
migration and use `prisma migrate resolve` / a reviewed down migration.
