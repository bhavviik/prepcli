-- ============================================================
-- prepcli — Supabase Schema (v2)
-- Safe to run on a fresh database OR on top of the v1 schema.
-- All CREATE TABLE use IF NOT EXISTS.
-- All ALTER TABLE use ADD COLUMN IF NOT EXISTS.
-- All policies use DROP IF EXISTS before CREATE (idempotent).
-- ============================================================
-- Run this entire file in: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists vector;

-- =============================================================================
-- PART 1 — CORE TABLES (v1, safe to re-run)
-- =============================================================================

-- ── public.users ─────────────────────────────────────────────────────────────
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  created_at timestamptz default now()
);

-- Auto-insert into public.users when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- PART 2 — ORGANIZATION LAYER (v2, Scenario 2: Company / Group Projects)
-- =============================================================================

-- ── public.organizations ─────────────────────────────────────────────────────
-- Sits above projects. One org can have many projects (teams) on the same repo.
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,  -- e.g. "acme-corp" used in prepcli init --org acme-corp
  owner_id   uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ── public.org_members ───────────────────────────────────────────────────────
create table if not exists public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.users(id)         on delete cascade,
  role       text not null default 'member',  -- 'owner' | 'admin' | 'member'
  invited_at timestamptz default now(),
  primary key (org_id, user_id)
);

-- ── public.org_context ───────────────────────────────────────────────────────
-- Shared brain for all teams in the org. Injected at STEP 0 before project_context.
-- Org context always takes precedence over project-level context.
create table if not exists public.org_context (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null unique references public.organizations(id) on delete cascade,
  infra       jsonb    default '{}',   -- cloud provider, regions, services
  standards   text[]   default '{}',   -- e.g. "all migrations need rollback plans"
  forbidden   text[]   default '{}',   -- e.g. "no console.log in production"
  tooling     jsonb    default '{}',   -- CI/CD, PM tools, deployment pipelines
  last_updated timestamptz default now(),
  updated_by  uuid references public.users(id)
);

-- =============================================================================
-- PART 3 — PROJECTS (v1 + v2 columns)
-- =============================================================================

-- ── public.projects ───────────────────────────────────────────────────────────
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.users(id) on delete cascade,
  name            text not null,
  git_remote      text,             -- exact remote URL from git remote get-url origin
  upstream_remote text,             -- for forks: canonical upstream repo URL
  created_at      timestamptz default now()
);

-- v2 additions to projects (safe if columns already exist)
alter table public.projects
  add column if not exists org_id     uuid references public.organizations(id) on delete set null,
  add column if not exists visibility text not null default 'private';
  -- visibility: 'private' | 'org' | 'public'

-- =============================================================================
-- PART 4 — PROJECT TABLES (v1, safe to re-run)
-- =============================================================================

-- ── public.project_members ───────────────────────────────────────────────────
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id)    on delete cascade,
  role       text not null default 'member',  -- 'owner' | 'member'
  invited_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- ── public.project_context ───────────────────────────────────────────────────
create table if not exists public.project_context (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null unique references public.projects(id) on delete cascade,
  stack               jsonb    default '{}',
  active_constraints  text[]   default '{}',
  recent_decisions    jsonb    default '[]',
  hard_limits         text[]   default '{}',
  conventions         jsonb    default '{}',
  open_questions      text[]   default '{}',
  last_updated        timestamptz default now(),
  updated_by_session  uuid
);

-- ── public.prompt_sessions ───────────────────────────────────────────────────
create table if not exists public.prompt_sessions (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  user_id              uuid not null references public.users(id)    on delete cascade,
  session_date         timestamptz default now(),
  workflow_type        text,         -- 'prep' | 'debug' | 'plan' | 'refactor' | 'review' | 'write'
  task_input           text,
  task_embedding       vector(384),  -- gte-small via Supabase Edge Functions (Phase 5)
  questions_asked      jsonb   default '[]',
  structured_prompt    jsonb   default '{}',
  go_timestamp         timestamptz,
  window_close_ts      timestamptz,
  delta_count          int     default 0,
  prompt_quality_score float,
  outcome              text    default 'in-progress',  -- 'satisfied' | 'abandoned' | 'in-progress'
  files_changed        text[]  default '{}',
  commit_hash          text
);

-- Wire updated_by_session FK now that prompt_sessions exists
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_updated_by_session'
      and table_name = 'project_context'
      and table_schema = 'public'
  ) then
    alter table public.project_context
      add constraint fk_updated_by_session
      foreign key (updated_by_session)
      references public.prompt_sessions(id)
      on delete set null
      not valid;
  end if;
end $$;

-- ── public.delta_records ─────────────────────────────────────────────────────
create table if not exists public.delta_records (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.prompt_sessions(id) on delete cascade,
  project_id        uuid not null references public.projects(id)        on delete cascade,
  turn_index        int,
  user_message      text,
  is_delta          boolean default false,
  gap_type          text,              -- 'missing_constraint' | 'missing_scope' | 'missing_environment'
                                       -- 'missing_platform' | 'clarification_needed'
                                       -- 'missing_integration' | 'missing_ownership' | 'missing_deadline'
  gap_category      text,
  promoted_question text,
  embedding         vector(384),       -- Phase 5: similarity search across sessions
  embedding_model   text default 'gte-small',
  created_at        timestamptz default now()
);

-- =============================================================================
-- PART 5 — COMMUNITY QUESTION BANK (v2, Scenario 3: Public / Open Source)
-- =============================================================================

-- ── public.community_question_bank ───────────────────────────────────────────
-- Fully anonymized. No user_id, no project_id, no session_id.
-- Only aggregated delta patterns — what gap appeared how often for what repo/workflow.
-- Populated by opt-in contributions from Scenario 3 public projects.
create table if not exists public.community_question_bank (
  id                uuid primary key default gen_random_uuid(),
  repo_canonical    text not null,    -- normalized upstream remote URL
                                      -- e.g. "github.com/lukevella/rallly"
  workflow_type     text,             -- which workflow this pattern appeared in
  gap_type          text,             -- which gap type
  promoted_question text not null,    -- the question that would have prevented the delta
  frequency         int     default 1,  -- how many times this pattern was observed
  last_seen         timestamptz default now(),
  -- NO user_id — fully anonymous
  -- NO project_id — cannot be traced back to any team
  -- NO session_id — cannot be traced back to any session
  unique (repo_canonical, workflow_type, gap_type, promoted_question)
);

-- =============================================================================
-- PART 6 — ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
alter table public.users                   enable row level security;
alter table public.organizations           enable row level security;
alter table public.org_members             enable row level security;
alter table public.org_context             enable row level security;
alter table public.projects                enable row level security;
alter table public.project_members         enable row level security;
alter table public.project_context         enable row level security;
alter table public.prompt_sessions         enable row level security;
alter table public.delta_records           enable row level security;
alter table public.community_question_bank enable row level security;

-- ── users ────────────────────────────────────────────────────────────────────
drop policy if exists "users_self" on public.users;
create policy "users_self"
  on public.users for all
  using (id = auth.uid());

-- ── organizations ─────────────────────────────────────────────────────────────
drop policy if exists "orgs_owner_all" on public.organizations;
create policy "orgs_owner_all"
  on public.organizations for all
  using (owner_id = auth.uid());

drop policy if exists "orgs_member_read" on public.organizations;
create policy "orgs_member_read"
  on public.organizations for select
  using (
    exists (
      select 1 from public.org_members
      where org_id = organizations.id and user_id = auth.uid()
    )
  );

-- ── org_members ───────────────────────────────────────────────────────────────
drop policy if exists "org_members_owner_manage" on public.org_members;
create policy "org_members_owner_manage"
  on public.org_members for all
  using (
    exists (
      select 1 from public.organizations
      where id = org_members.org_id and owner_id = auth.uid()
    )
  );

drop policy if exists "org_members_self_read" on public.org_members;
create policy "org_members_self_read"
  on public.org_members for select
  using (user_id = auth.uid());

-- ── org_context ───────────────────────────────────────────────────────────────
-- Any org member can read. Only owner/admin can write.
drop policy if exists "org_context_member_read" on public.org_context;
create policy "org_context_member_read"
  on public.org_context for select
  using (
    exists (
      select 1 from public.org_members
      where org_id = org_context.org_id and user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.organizations
      where id = org_context.org_id and owner_id = auth.uid()
    )
  );

drop policy if exists "org_context_admin_write" on public.org_context;
create policy "org_context_admin_write"
  on public.org_context for all
  using (
    exists (
      select 1 from public.organizations
      where id = org_context.org_id and owner_id = auth.uid()
    )
    or
    exists (
      select 1 from public.org_members
      where org_id = org_context.org_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- ── projects ──────────────────────────────────────────────────────────────────
drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all"
  on public.projects for all
  using (owner_id = auth.uid());

drop policy if exists "projects_member_read" on public.projects;
create policy "projects_member_read"
  on public.projects for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = projects.id and user_id = auth.uid()
    )
  );

-- ── project_members ───────────────────────────────────────────────────────────
drop policy if exists "members_owner_manage" on public.project_members;
create policy "members_owner_manage"
  on public.project_members for all
  using (
    exists (
      select 1 from public.projects
      where id = project_members.project_id and owner_id = auth.uid()
    )
  );

drop policy if exists "members_self_read" on public.project_members;
create policy "members_self_read"
  on public.project_members for select
  using (user_id = auth.uid());

-- ── project_context ───────────────────────────────────────────────────────────
drop policy if exists "context_member_all" on public.project_context;
create policy "context_member_all"
  on public.project_context for all
  using (
    exists (
      select 1 from public.project_members
      where project_id = project_context.project_id and user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.projects
      where id = project_context.project_id and owner_id = auth.uid()
    )
  );

-- ── prompt_sessions ───────────────────────────────────────────────────────────
drop policy if exists "sessions_own_insert" on public.prompt_sessions;
create policy "sessions_own_insert"
  on public.prompt_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "sessions_own_update" on public.prompt_sessions;
create policy "sessions_own_update"
  on public.prompt_sessions for update
  using (user_id = auth.uid());

drop policy if exists "sessions_member_read" on public.prompt_sessions;
create policy "sessions_member_read"
  on public.prompt_sessions for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = prompt_sessions.project_id and user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

-- ── delta_records ─────────────────────────────────────────────────────────────
drop policy if exists "deltas_own_insert" on public.delta_records;
create policy "deltas_own_insert"
  on public.delta_records for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_id = delta_records.project_id and user_id = auth.uid()
    )
  );

drop policy if exists "deltas_member_read" on public.delta_records;
create policy "deltas_member_read"
  on public.delta_records for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = delta_records.project_id and user_id = auth.uid()
    )
  );

-- ── community_question_bank ───────────────────────────────────────────────────
-- Anyone can read (public knowledge base).
-- Only authenticated users can insert/update (prevents spam).
-- No user-level filtering — data is anonymous by design.
drop policy if exists "community_public_read" on public.community_question_bank;
create policy "community_public_read"
  on public.community_question_bank for select
  using (true);

drop policy if exists "community_authed_write" on public.community_question_bank;
create policy "community_authed_write"
  on public.community_question_bank for insert
  with check (auth.uid() is not null);

drop policy if exists "community_authed_update" on public.community_question_bank;
create policy "community_authed_update"
  on public.community_question_bank for update
  using (auth.uid() is not null);

-- =============================================================================
-- PART 7 — INDEXES (for RAG performance)
-- =============================================================================

-- Vector similarity search indexes (used in Phase 5)
create index if not exists idx_sessions_task_embedding
  on public.prompt_sessions using ivfflat (task_embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_deltas_embedding
  on public.delta_records using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Lookup indexes
create index if not exists idx_projects_git_remote
  on public.projects (git_remote);

create index if not exists idx_projects_org_id
  on public.projects (org_id);

create index if not exists idx_sessions_project_workflow
  on public.prompt_sessions (project_id, workflow_type);

create index if not exists idx_deltas_project_gap
  on public.delta_records (project_id, gap_type);

create index if not exists idx_community_repo_workflow
  on public.community_question_bank (repo_canonical, workflow_type);

-- =============================================================================
-- VERIFY — run these queries to confirm everything is in place
-- =============================================================================
-- select tablename from pg_tables where schemaname = 'public' order by tablename;
-- select extname, extversion from pg_extension where extname = 'vector';
-- select policyname, tablename from pg_policies where schemaname = 'public' order by tablename, policyname;
