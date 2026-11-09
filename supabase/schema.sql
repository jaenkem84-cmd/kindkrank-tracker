-- Kindkrank-Tracker: gemeinsamer Familienordner
-- Im Supabase-SQL-Editor ausführen, nachdem Anonymous Sign-Ins
-- unter Authentication → Providers → Anonymous aktiviert sind.
-- Es wird nur der anon-Schlüssel in der App verwendet, nie service_role.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.invites (
  token text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.family_documents (
  family_id uuid primary key references public.families (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invites enable row level security;
alter table public.family_documents enable row level security;

create or replace function public.my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

create or replace function public.ensure_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  select family_id into fid from public.family_members where user_id = auth.uid() limit 1;
  if fid is not null then
    return fid;
  end if;
  insert into public.families default values returning id into fid;
  insert into public.family_members (family_id, user_id) values (fid, auth.uid());
  return fid;
end;
$$;

create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  tok text;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  select family_id into fid from public.family_members where user_id = auth.uid() limit 1;
  if fid is null then
    raise exception 'Keine Familie';
  end if;
  tok := encode(gen_random_bytes(9), 'hex');
  insert into public.invites (token, family_id, expires_at, created_by)
  values (tok, fid, now() + interval '7 days', auth.uid());
  return tok;
end;
$$;

create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  select family_id into fid
  from public.invites
  where token = invite_token and expires_at > now();
  if fid is null then
    raise exception 'Einladung ungültig oder abgelaufen';
  end if;
  insert into public.family_members (family_id, user_id)
  values (fid, auth.uid())
  on conflict do nothing;
  return fid;
end;
$$;

revoke all on function public.my_family_ids() from public;
revoke all on function public.ensure_family() from public;
revoke all on function public.create_invite() from public;
revoke all on function public.accept_invite(text) from public;
grant execute on function public.my_family_ids() to authenticated;
grant execute on function public.ensure_family() to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

drop policy if exists "families read" on public.families;
create policy "families read" on public.families
  for select to authenticated
  using (id in (select public.my_family_ids()));

drop policy if exists "members read" on public.family_members;
create policy "members read" on public.family_members
  for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists "documents read" on public.family_documents;
create policy "documents read" on public.family_documents
  for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists "documents write" on public.family_documents;
create policy "documents write" on public.family_documents
  for insert to authenticated
  with check (family_id in (select public.my_family_ids()));

drop policy if exists "documents update" on public.family_documents;
create policy "documents update" on public.family_documents
  for update to authenticated
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));
