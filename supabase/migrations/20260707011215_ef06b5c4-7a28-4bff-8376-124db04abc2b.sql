
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Auto-grant admin to owner email on signup
create or replace function public.grant_admin_if_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'wecreatestudio26@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_grant_admin
after insert on auth.users
for each row execute function public.grant_admin_if_owner();

-- Access codes
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  buyer_email text,
  source text not null default 'admin',
  created_at timestamptz not null default now()
);

grant select, update on public.access_codes to authenticated;
grant all on public.access_codes to service_role;

alter table public.access_codes enable row level security;

-- Admins can read all
create policy "admins read all codes" on public.access_codes
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can check a specific unused code (needed for redeem lookup)
create policy "authenticated read unused codes" on public.access_codes
  for select to authenticated
  using (used_by is null);

-- User can read their own redeemed code
create policy "user read own code" on public.access_codes
  for select to authenticated
  using (used_by = auth.uid());

-- Users can mark an unused code as used by themselves
create policy "user redeem unused code" on public.access_codes
  for update to authenticated
  using (used_by is null)
  with check (used_by = auth.uid());

create index access_codes_used_by_idx on public.access_codes(used_by);
