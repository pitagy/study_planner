-- Enable RLS if not enabled
alter table profiles enable row level security;

-- Allow a user to read *their own* profile
do $$ begin
  if not exists (select 1 from pg_policies where schemaname=current_schema and tablename='profiles' and policyname='profiles select own') then
    create policy "profiles select own" on profiles
      for select using ( id = auth.uid() );
  end if;
end $$;

-- Allow staff to read all profiles
do $$ begin
  if not exists (select 1 from pg_policies where schemaname=current_schema and tablename='profiles' and policyname='profiles read by staff') then
    create policy "profiles read by staff" on profiles
      for select using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','teacher'))
      );
  end if;
end $$;

-- Allow self upsert/update
do $$ begin
  if not exists (select 1 from pg_policies where schemaname=current_schema and tablename='profiles' and policyname='profiles insert self') then
    create policy "profiles insert self" on profiles
      for insert with check ( id = auth.uid() );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname=current_schema and tablename='profiles' and policyname='profiles update self') then
    create policy "profiles update self" on profiles
      for update using ( id = auth.uid() ) with check ( id = auth.uid() );
  end if;
end $$;

-- Allow admin to update approvals/roles
do $$ begin
  if not exists (select 1 from pg_policies where schemaname=current_schema and tablename='profiles' and policyname='profiles admin update all') then
    create policy "profiles admin update all" on profiles
      for update using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end $$;
