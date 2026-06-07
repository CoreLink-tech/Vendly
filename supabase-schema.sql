-- Vendly Supabase schema
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'ambassador_status'
  ) then
    alter table auth.users
      add column ambassador_status text not null default 'none';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'users_ambassador_status_check'
  ) then
    alter table auth.users
      add constraint users_ambassador_status_check
      check (ambassador_status in ('none', 'pending', 'accepted', 'declined'));
  end if;
end $$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  whatsapp text,
  subscription_status text,
  subscription_plan text,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  activated_at timestamptz,
  activated_by_code_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stores add column if not exists subscription_status text;
alter table public.stores add column if not exists subscription_plan text;
alter table public.stores add column if not exists subscription_started_at timestamptz;
alter table public.stores add column if not exists subscription_expires_at timestamptz;
alter table public.stores add column if not exists trial_started_at timestamptz;
alter table public.stores add column if not exists trial_ends_at timestamptz;
alter table public.stores add column if not exists activated_at timestamptz;
alter table public.stores add column if not exists activated_by_code_id uuid;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null default 0,
  image_url text,
  status text not null default 'live',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  customer_name text,
  customer_phone text,
  customer_note text,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'new',
  whatsapp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_views (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  visitor_key text,
  path text,
  referrer text,
  user_agent text,
  viewed_at timestamptz not null default now()
);

create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  visitor_key text,
  viewed_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid unique references auth.users(id) on delete cascade,
  referred_name text,
  referred_store_name text,
  referred_slug text,
  reward_amount numeric not null default 1000,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referral_signups alter column status set default 'pending';

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  source text not null default 'referral',
  amount numeric not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'unused',
  plan_type text not null default 'monthly',
  amount numeric not null default 4000,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activation_codes add column if not exists plan_type text not null default 'monthly';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stores_activated_by_code_id_fkey'
  ) then
    alter table public.stores
      add constraint stores_activated_by_code_id_fkey
      foreign key (activated_by_code_id)
      references public.activation_codes(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function public.update_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_updated_at on public.stores;
create trigger stores_updated_at before update on public.stores for each row execute function public.update_timestamp();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.update_timestamp();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_timestamp();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.update_timestamp();

drop trigger if exists referral_codes_updated_at on public.referral_codes;
create trigger referral_codes_updated_at before update on public.referral_codes for each row execute function public.update_timestamp();

drop trigger if exists referral_signups_updated_at on public.referral_signups;
create trigger referral_signups_updated_at before update on public.referral_signups for each row execute function public.update_timestamp();

drop trigger if exists activation_codes_updated_at on public.activation_codes;
create trigger activation_codes_updated_at before update on public.activation_codes for each row execute function public.update_timestamp();

create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.normalize_subscription_plan(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(value, ''))) = 'yearly' then 'yearly'
    else 'monthly'
  end;
$$;

create or replace function public.plan_duration_days(value text)
returns integer
language sql
immutable
as $$
  select case
    when public.normalize_subscription_plan(value) = 'yearly' then 365
    else 30
  end;
$$;

create or replace function public.plan_amount(value text)
returns numeric
language sql
immutable
as $$
  select case
    when public.normalize_subscription_plan(value) = 'yearly' then 40000
    else 4000
  end;
$$;

create or replace function public.subscription_days_left(expires_at timestamptz)
returns integer
language sql
stable
as $$
  select case
    when expires_at is null then 0
    else greatest(ceil(extract(epoch from (expires_at - now())) / 86400.0)::int, 0)
  end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.admin_users
    where user_id = auth.uid()
       or (email is not null and lower(email) = public.current_auth_email())
  );
$$;

create or replace function public.bootstrap_admin_access()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request admin access.';
  end if;

  -- One-time bootstrap: only the first requester (when no admins exist) can self-promote.
  if exists (select 1 from public.admin_users) then
    raise exception 'Admin access is already configured for this project.';
  end if;

  insert into public.admin_users (user_id, email)g
  values (auth.uid(), public.current_auth_email());

  return true;
end;
$$;

create or replace function public.ensure_my_referral_code(p_seed text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  prefix text;
  generated_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to generate a referral code.';
  end if;

  select code
  into existing_code
  from public.referral_codes
  where owner_id = auth.uid();

  if existing_code is not null then
    return existing_code;
  end if;

  prefix := upper(substr(regexp_replace(coalesce(p_seed, ''), '[^a-zA-Z0-9]+', '', 'g'), 1, 6));
  if prefix is null or prefix = '' then
    prefix := 'VENDLY';
  end if;

  loop
    generated_code := prefix || substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 4);
    begin
      insert into public.referral_codes (owner_id, code)
      values (auth.uid(), generated_code);
      return generated_code;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.register_referral_signup(
  p_ref_code text,
  p_referred_user_id uuid,
  p_referred_name text default null,
  p_store_name text default null,
  p_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.referral_codes%rowtype;
  saved_id uuid;
begin
  if p_ref_code is null or trim(p_ref_code) = '' or p_referred_user_id is null then
    return null;
  end if;

  select *
  into code_row
  from public.referral_codes
  where upper(code) = upper(trim(p_ref_code))
  limit 1;

  if code_row.owner_id is null or code_row.owner_id = p_referred_user_id then
    return null;
  end if;

  insert into public.referral_signups (
    referrer_id,
    referred_user_id,
    referred_name,
    referred_store_name,
    referred_slug,
    reward_amount,
    status
  )
  values (
    code_row.owner_id,
    p_referred_user_id,
    nullif(trim(p_referred_name), ''),
    nullif(trim(p_store_name), ''),
    nullif(trim(lower(p_slug)), ''),
    1000,
    'pending'
  )
  on conflict (referred_user_id) do update
    set referred_name = excluded.referred_name,
        referred_store_name = excluded.referred_store_name,
        referred_slug = excluded.referred_slug
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.referral_available_balance(p_owner_id uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with earned as (
    select coalesce(sum(reward_amount), 0) as total
    from public.referral_signups
    where referrer_id = p_owner_id
      and status = 'active'
  ),
  reserved as (
    select coalesce(sum(amount), 0) as total
    from public.withdrawal_requests
    where owner_id = p_owner_id
      and source = 'referral'
      and status in ('pending', 'approved', 'paid')
  )
  select greatest((select total from earned) - (select total from reserved), 0);
$$;

create or replace function public.activate_referral_signup_for_referred_user(
  p_referred_user_id uuid,
  p_plan_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plan text := public.normalize_subscription_plan(p_plan_type);
  updated_count integer;
begin
  if p_referred_user_id is null then
    return 0;
  end if;

  update public.referral_signups
  set status = 'active',
      reward_amount = 1000
  where referred_user_id = p_referred_user_id
    and status = 'pending'
  returning 1 into updated_count;

  return coalesce(updated_count, 0);
end;
$$;

-- Ambassador: add column to auth.users to track ambassador program status
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'ambassador_status'
  ) then
    alter table auth.users add column ambassador_status text not null default 'none';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_ambassador_status_check'
  ) then
    alter table auth.users add constraint users_ambassador_status_check check (ambassador_status in ('none','pending','accepted','declined'));
  end if;
end $$;

-- RPC: return current user's ambassador status
create or replace function public.get_my_ambassador_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select ambassador_status from auth.users where id = auth.uid()), 'none');
$$;

-- RPC: set current user's ambassador_status to 'pending' (application)
create or replace function public.apply_for_ambassador()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before applying.';
  end if;

  update auth.users
  set ambassador_status = 'pending'
  where id = auth.uid();
end;
$$;

-- Admin RPC: list pending ambassador applications
create or replace function public.admin_ambassador_applications()
returns table(
  user_id uuid,
  name text,
  username text,
  email text,
  phone text,
  ambassador_status text,
  applied_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    coalesce(nullif(u.user_metadata->>'fullName',''), nullif(u.user_metadata->>'firstName',''), (p.first_name || ' ' || p.last_name), '') as name,
    coalesce(nullif(u.user_metadata->>'slug',''), nullif(u.user_metadata->>'username',''), split_part(u.email, '@', 1)) as username,
    lower(coalesce(u.email, u.user_metadata->>'email')) as email,
    coalesce(u.user_metadata->>'phone', '') as phone,
    coalesce(u.ambassador_status, 'none') as ambassador_status,
    u.created_at as applied_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(u.ambassador_status, 'none') = 'pending'
  order by u.created_at desc;
$$;

-- Admin RPC: set ambassador status for a user
create or replace function public.admin_set_ambassador_status(
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'You do not have access to update ambassador status.';
  end if;

  if p_status not in ('none','pending','accepted','declined') then
    raise exception 'Invalid ambassador status.';
  end if;

  update auth.users
  set ambassador_status = p_status
  where id = p_user_id;
end;
$$;

create or replace function public.create_withdrawal_request(
  p_amount numeric,
  p_bank_name text,
  p_account_number text,
  p_account_name text
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  available_balance numeric;
  request_row public.withdrawal_requests;
  owner_store_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to request a withdrawal.';
  end if;

  if p_amount is null or p_amount < 1000 then
    raise exception 'Minimum withdrawal is NGN 1,000.';
  end if;

  if nullif(trim(coalesce(p_bank_name, '')), '') is null
     or nullif(trim(coalesce(p_account_number, '')), '') is null
     or nullif(trim(coalesce(p_account_name, '')), '') is null then
    raise exception 'Complete the bank name, account number, and account name fields.';
  end if;

  available_balance := public.referral_available_balance(auth.uid());
  if p_amount > available_balance then
    raise exception 'Your available referral balance is not enough for this withdrawal request.';
  end if;

  select id
  into owner_store_id
  from public.stores
  where owner_id = auth.uid()
  limit 1;

  insert into public.withdrawal_requests (
    owner_id,
    store_id,
    source,
    amount,
    bank_name,
    account_number,
    account_name,
    status
  )
  values (
    auth.uid(),
    owner_store_id,
    'referral',
    p_amount,
    trim(p_bank_name),
    trim(p_account_number),
    trim(p_account_name),
    'pending'
  )
  returning * into request_row;

  return request_row;
end;
$$;

create or replace function public.log_store_view(
  p_store_id uuid,
  p_owner_id uuid,
  p_visitor_key text,
  p_path text default null,
  p_referrer text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_store_id is null or p_owner_id is null then
    return;
  end if;

  insert into public.store_views (store_id, owner_id, visitor_key, path, referrer, user_agent)
  values (p_store_id, p_owner_id, nullif(trim(p_visitor_key), ''), p_path, p_referrer, p_user_agent);
end;
$$;

create or replace function public.log_product_view(
  p_store_id uuid,
  p_owner_id uuid,
  p_product_id uuid,
  p_visitor_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_store_id is null or p_owner_id is null or p_product_id is null then
    return;
  end if;

  insert into public.product_views (store_id, owner_id, product_id, visitor_key)
  values (p_store_id, p_owner_id, p_product_id, nullif(trim(p_visitor_key), ''));
end;
$$;

create or replace function public.create_storefront_order(
  p_store_id uuid,
  p_owner_id uuid,
  p_items jsonb,
  p_total_amount numeric,
  p_whatsapp_url text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  total_items integer := 0;
  item_value jsonb;
  order_row public.orders;
begin
  if p_store_id is null or p_owner_id is null then
    raise exception 'A valid store is required to create an order.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be sent as an array.';
  end if;

  for item_value in select * from jsonb_array_elements(p_items)
  loop
    total_items := total_items + greatest(coalesce((item_value ->> 'quantity')::integer, 0), 0);
  end loop;

  if total_items <= 0 then
    raise exception 'At least one product must be included in the order.';
  end if;

  insert into public.orders (
    owner_id,
    store_id,
    customer_name,
    customer_phone,
    customer_note,
    items,
    item_count,
    total_amount,
    status,
    whatsapp_url
  )
  values (
    p_owner_id,
    p_store_id,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    nullif(trim(coalesce(p_customer_note, '')), ''),
    p_items,
    total_items,
    coalesce(p_total_amount, 0),
    'new',
    p_whatsapp_url
  )
  returning * into order_row;

  return order_row;
end;
$$;

create or replace function public.redeem_activation_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.activation_codes%rowtype;
  updated_store_id uuid;
  normalized_plan text;
  started_at timestamptz := now();
  expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in again before activating your store.';
  end if;

  if nullif(trim(coalesce(input_code, '')), '') is null then
    raise exception 'Enter your activation code.';
  end if;

  select *
  into code_row
  from public.activation_codes
  where upper(code) = upper(trim(input_code))
  for update;

  if code_row.id is null then
    raise exception 'That activation code was not found.';
  end if;

  if code_row.status <> 'unused' then
    raise exception 'That activation code has already been used.';
  end if;

  normalized_plan := public.normalize_subscription_plan(code_row.plan_type);
  expires_at := started_at + make_interval(days => public.plan_duration_days(normalized_plan));

  update public.activation_codes
  set status = 'redeemed',
      redeemed_by = auth.uid(),
      redeemed_at = now()
  where id = code_row.id;

  update public.stores
  set subscription_status = 'active',
      subscription_plan = normalized_plan,
      subscription_started_at = started_at,
      subscription_expires_at = expires_at,
      activated_at = now()
      ,activated_by_code_id = code_row.id
  where owner_id = auth.uid()
  returning id into updated_store_id;

  if updated_store_id is null then
    raise exception 'No store record was found for this account.';
  end if;

  perform public.activate_referral_signup_for_referred_user(auth.uid(), normalized_plan);

  return jsonb_build_object(
    'message', 'Activation successful. Your store is live again.',
    'store_id', updated_store_id,
    'code', code_row.code,
    'plan', normalized_plan,
    'expires_at', expires_at,
    'days_left', public.subscription_days_left(expires_at)
  );
end;
$$;

drop function if exists public.admin_generate_activation_code(text, numeric, text);
drop function if exists public.admin_generate_activation_code(text, text, numeric, text);
create or replace function public.admin_generate_activation_code(
  p_code text default null,
  p_plan_type text default 'monthly',
  p_amount numeric default null,
  p_note text default null
)
returns public.activation_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
  result_row public.activation_codes;
  normalized_plan text;
begin
  if not public.is_admin() then
    raise exception 'You do not have access to generate activation codes.';
  end if;

  generated_code := upper(nullif(trim(coalesce(p_code, '')), ''));
  if generated_code is null then
    generated_code := 'VDL-' || substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 8);
  end if;

  normalized_plan := public.normalize_subscription_plan(p_plan_type);

  insert into public.activation_codes (code, status, plan_type, amount, note, created_by)
  values (
    generated_code,
    'unused',
    normalized_plan,
    coalesce(p_amount, public.plan_amount(normalized_plan)),
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  )
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.admin_activate_vendor_subscription(
  p_owner_id uuid,
  p_plan_type text,
  p_started_at timestamptz default now()
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plan text;
  updated_row public.stores;
  started_at timestamptz;
  expires_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'You do not have access to update vendor accounts.';
  end if;

  normalized_plan := public.normalize_subscription_plan(p_plan_type);
  started_at := coalesce(p_started_at, now());
  expires_at := started_at + make_interval(days => public.plan_duration_days(normalized_plan));

  update public.stores
  set subscription_status = 'active',
      subscription_plan = normalized_plan,
      subscription_started_at = started_at,
      subscription_expires_at = expires_at,
      activated_at = now()
  where owner_id = p_owner_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Vendor store was not found.';
  end if;

  perform public.activate_referral_signup_for_referred_user(p_owner_id, normalized_plan);

  return updated_row;
end;
$$;

create or replace function public.admin_set_store_status(
  p_owner_id uuid,
  p_status text
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text := lower(trim(coalesce(p_status, '')));
  updated_row public.stores;
begin
  if not public.is_admin() then
    raise exception 'You do not have access to update vendor accounts.';
  end if;

  if normalized_status not in ('active', 'paused', 'expired', 'pending_activation') then
    raise exception 'Unsupported store status: %', p_status;
  end if;

  update public.stores
  set subscription_status = normalized_status,
      subscription_plan = case when normalized_status = 'active' then coalesce(subscription_plan, 'monthly') else subscription_plan end,
      subscription_started_at = case when normalized_status = 'pending_activation' then null else subscription_started_at end,
      subscription_expires_at = case when normalized_status in ('expired', 'pending_activation') then null else subscription_expires_at end,
      activated_at = case when normalized_status = 'pending_activation' then null else activated_at end,
      activated_by_code_id = case when normalized_status = 'pending_activation' then null else activated_by_code_id end
  where owner_id = p_owner_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Vendor store was not found.';
  end if;

  return updated_row;
end;
$$;

create or replace function public.admin_update_withdrawal_status(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text := lower(trim(coalesce(p_status, '')));
  updated_row public.withdrawal_requests;
begin
  if not public.is_admin() then
    raise exception 'You do not have access to review withdrawals.';
  end if;

  if normalized_status not in ('pending', 'approved', 'paid', 'rejected') then
    raise exception 'Unsupported withdrawal status: %', p_status;
  end if;

  update public.withdrawal_requests
  set status = normalized_status,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      admin_note = nullif(trim(coalesce(p_admin_note, admin_note, '')), '')
  where id = p_request_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Withdrawal request not found.';
  end if;

  return updated_row;
end;
$$;

drop function if exists public.admin_vendor_accounts();
create or replace function public.admin_vendor_accounts()
returns table (
  owner_id uuid,
  email text,
  first_name text,
  last_name text,
  display_name text,
  store_id uuid,
  store_name text,
  store_slug text,
  whatsapp text,
  subscription_status text,
  subscription_plan text,
  subscription_started_at timestamptz,
  subscription_expires_at timestamptz,
  days_left integer,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  activated_at timestamptz,
  product_count bigint,
  order_count bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.owner_id,
    lower(coalesce(u.email, '')) as email,
    p.first_name,
    p.last_name,
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as display_name,
    s.id as store_id,
    s.name as store_name,
    s.slug as store_slug,
    s.whatsapp,
    s.subscription_status,
    s.subscription_plan,
    s.subscription_started_at,
    s.subscription_expires_at,
    public.subscription_days_left(s.subscription_expires_at) as days_left,
    s.trial_started_at,
    s.trial_ends_at,
    s.activated_at,
    coalesce(product_counts.total, 0) as product_count,
    coalesce(order_counts.total, 0) as order_count,
    s.created_at
  from public.stores s
  left join public.profiles p on p.id = s.owner_id
  left join auth.users u on u.id = s.owner_id
  left join (
    select owner_id, count(*) as total
    from public.products
    group by owner_id
  ) product_counts on product_counts.owner_id = s.owner_id
  left join (
    select owner_id, count(*) as total
    from public.orders
    group by owner_id
  ) order_counts on order_counts.owner_id = s.owner_id
  where public.is_admin()
  order by s.created_at desc;
$$;

create or replace function public.admin_withdrawal_requests()
returns table (
  request_id uuid,
  owner_id uuid,
  vendor_name text,
  vendor_email text,
  store_name text,
  store_slug text,
  whatsapp text,
  amount numeric,
  bank_name text,
  account_number text,
  account_name text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  admin_note text
)
language sql
security definer
set search_path = public
as $$
  select
    wr.id as request_id,
    wr.owner_id,
    coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), s.name, lower(coalesce(u.email, '')), 'Vendor') as vendor_name,
    lower(coalesce(u.email, '')) as vendor_email,
    s.name as store_name,
    s.slug as store_slug,
    s.whatsapp,
    wr.amount,
    wr.bank_name,
    wr.account_number,
    wr.account_name,
    wr.status,
    wr.requested_at,
    wr.reviewed_at,
    wr.admin_note
  from public.withdrawal_requests wr
  left join public.stores s on s.owner_id = wr.owner_id
  left join public.profiles p on p.id = wr.owner_id
  left join auth.users u on u.id = wr.owner_id
  where public.is_admin()
  order by wr.requested_at desc;
$$;

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete your account.';
  end if;

  delete from auth.users where id = auth.uid();
  return true;
end;
$$;

create or replace function public.get_my_ambassador_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ambassador_status, 'none')
  from auth.users
  where id = auth.uid();
$$;

drop function if exists public.apply_for_ambassador();
create or replace function public.apply_for_ambassador()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to apply as an ambassador.';
  end if;

  update auth.users
  set ambassador_status = 'pending'
  where id = auth.uid();

  return 'pending';
end;
$$;

drop function if exists public.admin_ambassador_applications();
create or replace function public.admin_ambassador_applications()
returns table (
  user_id uuid,
  name text,
  username text,
  email text,
  phone text,
  ambassador_status text
)
language sql
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), s.name, lower(coalesce(u.email, '')), 'Vendor') as name,
    coalesce(
      nullif(trim(u.user_metadata ->> 'username'), ''),
      nullif(trim(s.slug), ''),
      lower(split_part(coalesce(u.email, ''), '@', 1)),
      u.id::text
    ) as username,
    lower(coalesce(u.email, '')) as email,
    coalesce(
      nullif(trim(u.user_metadata ->> 'phone'), ''),
      nullif(trim(u.phone), ''),
      nullif(trim(s.whatsapp), ''),
      ''
    ) as phone,
    coalesce(u.ambassador_status, 'none') as ambassador_status
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.stores s on s.owner_id = u.id
  where public.is_admin()
    and u.ambassador_status = 'pending'
  order by u.email nulls last;
$$;

create or replace function public.admin_set_ambassador_status(
  p_user_id uuid,
  p_status text
)
returns auth.users
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text := lower(trim(coalesce(p_status, '')));
  updated_user auth.users%rowtype;
begin
  if not public.is_admin() then
    raise exception 'You do not have access to update ambassador applications.';
  end if;

  if normalized_status not in ('none', 'pending', 'accepted', 'declined') then
    raise exception 'Unsupported ambassador status: %', normalized_status;
  end if;

  update auth.users
  set ambassador_status = normalized_status
  where id = p_user_id
  returning * into updated_user;

  if updated_user.id is null then
    raise exception 'Ambassador user not found.';
  end if;

  return updated_user;
end;
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.bootstrap_admin_access() to authenticated;
grant execute on function public.ensure_my_referral_code(text) to authenticated;
grant execute on function public.register_referral_signup(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.referral_available_balance(uuid) to authenticated;
grant execute on function public.create_withdrawal_request(numeric, text, text, text) to authenticated;
grant execute on function public.log_store_view(uuid, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.log_product_view(uuid, uuid, uuid, text) to anon, authenticated;
grant execute on function public.create_storefront_order(uuid, uuid, jsonb, numeric, text, text, text, text) to anon, authenticated;
grant execute on function public.redeem_activation_code(text) to authenticated;
grant execute on function public.apply_for_ambassador() to authenticated;
grant execute on function public.get_my_ambassador_status() to authenticated;
grant execute on function public.admin_ambassador_applications() to authenticated;
grant execute on function public.admin_set_ambassador_status(uuid, text) to authenticated;
grant execute on function public.admin_generate_activation_code(text, text, numeric, text) to authenticated;
grant execute on function public.admin_activate_vendor_subscription(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_set_store_status(uuid, text) to authenticated;
grant execute on function public.admin_update_withdrawal_status(uuid, text, text) to authenticated;
grant execute on function public.admin_vendor_accounts() to authenticated;
grant execute on function public.admin_withdrawal_requests() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.store_views enable row level security;
alter table public.product_views enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.activation_codes enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "stores public read" on public.stores;
create policy "stores public read" on public.stores
for select
using (true);

drop policy if exists "stores owner manage" on public.stores;
create policy "stores owner manage" on public.stores
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "products public live read" on public.products;
create policy "products public live read" on public.products
for select
using (status = 'live' or owner_id = auth.uid() or public.is_admin());

drop policy if exists "products owner manage" on public.products;
create policy "products owner manage" on public.products
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "profiles owner read" on public.profiles;
create policy "profiles owner read" on public.profiles
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles owner write" on public.profiles;
create policy "profiles owner write" on public.profiles
for all
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "orders owner read" on public.orders;
create policy "orders owner read" on public.orders
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "orders owner update" on public.orders;
create policy "orders owner update" on public.orders
for update
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "orders owner delete" on public.orders;
create policy "orders owner delete" on public.orders
for delete
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "orders owner insert" on public.orders;
create policy "orders owner insert" on public.orders
for insert
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "store views owner read" on public.store_views;
create policy "store views owner read" on public.store_views
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "product views owner read" on public.product_views;
create policy "product views owner read" on public.product_views
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "referral codes owner manage" on public.referral_codes;
create policy "referral codes owner manage" on public.referral_codes
for all
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "referral signups referrer read" on public.referral_signups;
create policy "referral signups referrer read" on public.referral_signups
for select
using (referrer_id = auth.uid() or public.is_admin());

drop policy if exists "withdrawals owner read" on public.withdrawal_requests;
create policy "withdrawals owner read" on public.withdrawal_requests
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "withdrawals owner insert" on public.withdrawal_requests;
create policy "withdrawals owner insert" on public.withdrawal_requests
for insert
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "withdrawals admin update" on public.withdrawal_requests;
create policy "withdrawals admin update" on public.withdrawal_requests
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "activation codes admin read" on public.activation_codes;
create policy "activation codes admin read" on public.activation_codes
for select
using (public.is_admin());

drop policy if exists "activation codes admin manage" on public.activation_codes;
create policy "activation codes admin manage" on public.activation_codes
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin users self read" on public.admin_users;
create policy "admin users self read" on public.admin_users
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin users admin manage" on public.admin_users;
create policy "admin users admin manage" on public.admin_users
for all
using (public.is_admin())
with check (public.is_admin());
