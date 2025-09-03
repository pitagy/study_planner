-- schema + rls
create type user_role as enum ('student','teacher','admin');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text unique,
  role user_role not null default 'student',
  approved boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  tag text,
  must_do text,
  topic text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  focus_target int,
  satisfaction_target int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  actual_start timestamptz not null,
  actual_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  target_achieved int,
  rating int,
  feedback text,
  created_at timestamptz default now()
);

alter table profiles  enable row level security;
alter table plans     enable row level security;
alter table sessions  enable row level security;
alter table evaluations enable row level security;

create policy "profiles read self" on profiles for select using (auth.uid() = id);
create policy "profiles read by staff" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','teacher'))
);
create policy "profiles admin update" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "plans crud by owner if approved" on plans for all using (
  user_id = auth.uid()
  and (select approved from profiles where id = auth.uid())
) with check (
  user_id = auth.uid()
  and (select approved from profiles where id = auth.uid())
);
create policy "plans read by staff" on plans for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','teacher'))
);

create policy "sessions crud by owner if approved" on sessions for all using (
  user_id = auth.uid() and (select approved from profiles where id = auth.uid())
) with check (user_id = auth.uid() and (select approved from profiles where id = auth.uid()));
create policy "sessions read by staff" on sessions for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','teacher'))
);

create policy "evaluations crud by owner if approved" on evaluations for all using (
  user_id = auth.uid() and (select approved from profiles where id = auth.uid())
) with check (user_id = auth.uid() and (select approved from profiles where id = auth.uid()));
create policy "evaluations read by staff" on evaluations for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','teacher'))
);
