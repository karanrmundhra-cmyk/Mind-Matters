-- Row-Level Security policies for Personal OS (Supabase/Postgres).
-- Applied after the baseline Prisma migration. Tenant isolation is enforced here as
-- a backstop; the service layer also scopes every query by spaceId.
--
-- Assumes Supabase Auth: auth.uid() returns the current user's UUID.
-- A user can see a Space they own or are a member of; all child rows inherit that.

-- Helper: spaces the current user may access.
create or replace function public.accessible_space_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from "Space" s
  where s."ownerUserId" = auth.uid()
  union
  select m."spaceId"
  from "Membership" m
  where m."userId" = auth.uid()
$$;

-- Enable RLS on tenant-scoped tables.
alter table "User"                 enable row level security;
alter table "Space"                enable row level security;
alter table "Membership"           enable row level security;
alter table "Group"                enable row level security;
alter table "Contact"              enable row level security;
alter table "CommunicationConsent" enable row level security;
alter table "Loop"                 enable row level security;
alter table "LoopOwner"            enable row level security;
alter table "Touch"                enable row level security;
alter table "LoopTransition"       enable row level security;
alter table "Reminder"             enable row level security;
alter table "Routine"              enable row level security;
alter table "RoutineCheck"         enable row level security;
alter table "Attachment"           enable row level security;
alter table "Subscription"         enable row level security;
alter table "AuditLog"             enable row level security;

-- User: can read/update only self.
create policy user_self on "User"
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Space: owner or member.
create policy space_access on "Space"
  for all using (id in (select accessible_space_ids()))
  with check ("ownerUserId" = auth.uid());

-- Space-scoped tables.
create policy group_access on "Group"
  for all using ("spaceId" in (select accessible_space_ids()));
create policy contact_access on "Contact"
  for all using ("spaceId" in (select accessible_space_ids()));
create policy loop_access on "Loop"
  for all using ("spaceId" in (select accessible_space_ids()));
create policy audit_access on "AuditLog"
  for select using ("spaceId" in (select accessible_space_ids()));

-- Child-of-loop tables (join through Loop.spaceId).
create policy touch_access on "Touch"
  for all using ("loopId" in (select id from "Loop" where "spaceId" in (select accessible_space_ids())));
create policy transition_access on "LoopTransition"
  for all using ("loopId" in (select id from "Loop" where "spaceId" in (select accessible_space_ids())));
create policy reminder_access on "Reminder"
  for all using ("loopId" in (select id from "Loop" where "spaceId" in (select accessible_space_ids())));
create policy attachment_access on "Attachment"
  for all using ("loopId" in (select id from "Loop" where "spaceId" in (select accessible_space_ids())));
create policy loopowner_access on "LoopOwner"
  for all using ("loopId" in (select id from "Loop" where "spaceId" in (select accessible_space_ids())));
create policy consent_access on "CommunicationConsent"
  for all using ("contactId" in (select id from "Contact" where "spaceId" in (select accessible_space_ids())));

-- Membership + per-user tables.
create policy membership_access on "Membership"
  for all using ("userId" = auth.uid() or "spaceId" in (select accessible_space_ids()));
create policy routine_access on "Routine"
  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
create policy routinecheck_access on "RoutineCheck"
  for all using ("routineId" in (select id from "Routine" where "userId" = auth.uid()));
create policy subscription_access on "Subscription"
  for all using ("userId" = auth.uid()) with check ("userId" = auth.uid());
