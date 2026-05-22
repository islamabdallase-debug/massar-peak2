-- ============================================================
--  مسار SaaS — Multi-tenant Schema (Supabase PostgreSQL)
--  Phase 5: Centers · Users · Roles · Subscriptions
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fast text search

-- ─── ENUMS ──────────────────────────────────────────────────
create type user_role as enum (
  'super_admin',    -- Massar platform admin
  'center_admin',   -- Center/school owner
  'supervisor',     -- Senior therapist (can view all center data)
  'therapist'       -- Standard therapist (own students only)
);

create type subscription_plan as enum (
  'free',           -- 3 students, basic features
  'pro',            -- 50 students, analytics, export
  'enterprise'      -- unlimited, admin panel, API
);

create type subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'paused'
);

create type invite_status as enum (
  'pending', 'accepted', 'expired', 'revoked'
);

-- ─── CENTERS (Multi-tenant root) ────────────────────────────
create table centers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  name_en       text,
  slug          text unique not null,            -- URL-friendly identifier
  logo_url      text,
  country       text default 'SA',
  city          text,
  phone         text,
  email         text,
  website       text,
  address       text,
  settings      jsonb default '{}',              -- center-specific config
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

create index idx_centers_slug on centers(slug);

-- ─── USER PROFILES (extends auth.users) ─────────────────────
create table user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  center_id     uuid references centers(id) on delete set null,
  role          user_role not null default 'therapist',
  full_name     text not null,
  avatar_url    text,
  phone         text,
  specialization text,                           -- RFT specialization details
  is_active     boolean default true,
  preferences   jsonb default '{}',              -- UI preferences per user
  last_seen_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_user_profiles_center on user_profiles(center_id);
create index idx_user_profiles_role   on user_profiles(center_id, role);

-- ─── INVITATIONS ─────────────────────────────────────────────
create table invitations (
  id            uuid primary key default uuid_generate_v4(),
  center_id     uuid not null references centers(id) on delete cascade,
  invited_by    uuid not null references user_profiles(id),
  email         text not null,
  role          user_role not null default 'therapist',
  token         text unique not null default encode(gen_random_bytes(32), 'hex'),
  status        invite_status default 'pending',
  expires_at    timestamptz default now() + interval '7 days',
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

create index idx_invitations_token  on invitations(token);
create index idx_invitations_email  on invitations(email);
create index idx_invitations_center on invitations(center_id);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────
create table subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  center_id       uuid unique not null references centers(id) on delete cascade,
  plan            subscription_plan default 'free',
  status          subscription_status default 'trialing',
  trial_ends_at   timestamptz default now() + interval '14 days',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  student_limit   int default 3,               -- -1 = unlimited
  therapist_limit int default 1,               -- -1 = unlimited
  features        jsonb default '{
    "analytics": false,
    "export_word": false,
    "export_excel": false,
    "ai_analysis": false,
    "api_access": false,
    "priority_support": false
  }',
  external_id     text,                        -- Stripe/payment gateway ID
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Plan defaults trigger ───────────────────────────────────
create or replace function apply_plan_defaults()
returns trigger language plpgsql as $$
begin
  case new.plan
    when 'free' then
      new.student_limit   := 3;
      new.therapist_limit := 1;
      new.features := '{"analytics":false,"export_word":false,"export_excel":false,"ai_analysis":false,"api_access":false,"priority_support":false}';
    when 'pro' then
      new.student_limit   := 50;
      new.therapist_limit := 5;
      new.features := '{"analytics":true,"export_word":true,"export_excel":true,"ai_analysis":true,"api_access":false,"priority_support":false}';
    when 'enterprise' then
      new.student_limit   := -1;
      new.therapist_limit := -1;
      new.features := '{"analytics":true,"export_word":true,"export_excel":true,"ai_analysis":true,"api_access":true,"priority_support":true}';
  end case;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_subscription_plan_defaults
  before insert or update of plan on subscriptions
  for each row execute function apply_plan_defaults();

-- ─── STUDENTS (extended for multi-tenant) ───────────────────
-- Extends the existing students table with center_id + therapist assignment
alter table students
  add column if not exists center_id     uuid references centers(id),
  add column if not exists assigned_to   uuid references user_profiles(id),
  add column if not exists archived_at   timestamptz;

create index if not exists idx_students_center    on students(center_id);
create index if not exists idx_students_therapist on students(assigned_to);
create index if not exists idx_students_name_trgm on students using gin(name gin_trgm_ops);

-- ─── SESSIONS (extended) ────────────────────────────────────
alter table sessions
  add column if not exists center_id    uuid references centers(id),
  add column if not exists conducted_by uuid references user_profiles(id);

create index if not exists idx_sessions_center    on sessions(center_id);
create index if not exists idx_sessions_conductor on sessions(conducted_by);

-- ─── ANALYTICS SNAPSHOTS ────────────────────────────────────
create table analytics_snapshots (
  id          uuid primary key default uuid_generate_v4(),
  center_id   uuid not null references centers(id) on delete cascade,
  period      date not null,                -- first day of the period
  period_type text default 'weekly',        -- daily | weekly | monthly
  data        jsonb not null default '{}',  -- aggregated stats
  created_at  timestamptz default now(),
  unique(center_id, period, period_type)
);

create index idx_analytics_center_period on analytics_snapshots(center_id, period desc);

-- ─── AUDIT LOG ──────────────────────────────────────────────
create table audit_log (
  id          uuid primary key default uuid_generate_v4(),
  center_id   uuid references centers(id),
  user_id     uuid references auth.users(id),
  action      text not null,               -- student.created, session.saved, etc.
  entity_type text,
  entity_id   text,
  metadata    jsonb default '{}',
  ip_addr     inet,
  created_at  timestamptz default now()
);

create index idx_audit_center_time on audit_log(center_id, created_at desc);
create index idx_audit_user_time   on audit_log(user_id, created_at desc);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

-- Helper: get current user's center_id
create or replace function current_center_id()
returns uuid language sql stable security definer as $$
  select center_id from user_profiles where id = auth.uid();
$$;

-- Helper: get current user's role
create or replace function current_user_role()
returns user_role language sql stable security definer as $$
  select role from user_profiles where id = auth.uid();
$$;

-- Centers RLS
alter table centers enable row level security;
create policy "center_members_see_own_center" on centers
  for select using (
    id = current_center_id()
    or current_user_role() = 'super_admin'
  );
create policy "center_admin_update_own" on centers
  for update using (
    id = current_center_id()
    and current_user_role() in ('center_admin', 'super_admin')
  );

-- User profiles RLS
alter table user_profiles enable row level security;
create policy "see_same_center_users" on user_profiles
  for select using (
    center_id = current_center_id()
    or id = auth.uid()
    or current_user_role() = 'super_admin'
  );
create policy "update_own_profile" on user_profiles
  for update using (id = auth.uid());
create policy "admin_manage_profiles" on user_profiles
  for all using (
    center_id = current_center_id()
    and current_user_role() in ('center_admin', 'supervisor', 'super_admin')
  );

-- Subscriptions RLS
alter table subscriptions enable row level security;
create policy "center_see_own_subscription" on subscriptions
  for select using (
    center_id = current_center_id()
    or current_user_role() = 'super_admin'
  );

-- Students RLS (multi-tenant extension)
drop policy if exists "users see own students" on students;
create policy "students_center_isolation" on students
  for all using (
    center_id = current_center_id()
    and (
      -- therapist sees own assigned students
      assigned_to = auth.uid()
      -- supervisor/admin sees all center students
      or current_user_role() in ('supervisor', 'center_admin', 'super_admin')
    )
  );

-- Sessions RLS
drop policy if exists "users see own sessions" on sessions;
create policy "sessions_center_isolation" on sessions
  for all using (
    center_id = current_center_id()
    and (
      conducted_by = auth.uid()
      or current_user_role() in ('supervisor', 'center_admin', 'super_admin')
    )
  );

-- Analytics RLS
alter table analytics_snapshots enable row level security;
create policy "analytics_center_only" on analytics_snapshots
  for select using (center_id = current_center_id());

-- Audit log RLS
alter table audit_log enable row level security;
create policy "audit_center_admin_only" on audit_log
  for select using (
    center_id = current_center_id()
    and current_user_role() in ('center_admin', 'supervisor', 'super_admin')
  );

-- ─── FUNCTIONS ──────────────────────────────────────────────

-- Get center usage stats
create or replace function get_center_stats(p_center_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_students',   (select count(*) from students where center_id = p_center_id and deleted_at is null),
    'total_sessions',   (select count(*) from sessions where center_id = p_center_id and deleted_at is null),
    'total_therapists', (select count(*) from user_profiles where center_id = p_center_id and is_active = true),
    'sessions_this_month', (
      select count(*) from sessions
      where center_id = p_center_id
      and saved_at >= extract(epoch from date_trunc('month', now()))::bigint * 1000
    ),
    'avg_pass_rate', (
      select round(avg((summary->0->>'pct')::numeric), 1)
      from sessions
      where center_id = p_center_id
      and saved_at >= extract(epoch from now() - interval '30 days')::bigint * 1000
    ),
    'plan', (select plan from subscriptions where center_id = p_center_id),
    'student_limit', (select student_limit from subscriptions where center_id = p_center_id)
  ) into result;
  return result;
end;
$$;

-- Check if center can add student (subscription limit)
create or replace function can_add_student(p_center_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_limit int;
  v_count int;
begin
  select student_limit into v_limit from subscriptions where center_id = p_center_id;
  if v_limit = -1 then return true; end if;
  select count(*) into v_count from students where center_id = p_center_id and deleted_at is null;
  return v_count < v_limit;
end;
$$;

-- Auto-create subscription when center is created
create or replace function create_center_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into subscriptions (center_id, plan, status)
  values (new.id, 'free', 'trialing');
  return new;
end;
$$;

create trigger trg_center_create_subscription
  after insert on centers
  for each row execute function create_center_subscription();

-- ─── REALTIME ───────────────────────────────────────────────
alter publication supabase_realtime add table students;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table user_profiles;

-- ─── SEED: Super Admin Center ────────────────────────────────
-- Run manually after setup:
-- insert into centers (name, slug) values ('مسار — إدارة النظام', 'massar-admin');
