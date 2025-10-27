-- profiles 테이블 정리 (NULL 허용 및 기본값 보수)
alter table public.profiles
  alter column center_name drop not null,
  alter column student_name drop not null;

-- user_role -> role 로 일치 (이미 role 이면 skip)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='profiles' and column_name='user_role') then
    alter table public.profiles rename column user_role to role;
  end if;
end $$;

-- 컬럼 기본값 보수
alter table public.profiles
  alter column role set default 'student',
  alter column approved set default true;

-- 중복된 uuid 값이 있으면 기본 PK / FK 제약조건 보수 (필요 시)
alter table public.profiles
  add constraint if not exists profiles_pkey primary key (id);

alter table public.profiles
  add constraint if not exists profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;