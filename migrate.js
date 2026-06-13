#!/usr/bin/env node

/**
 * Vendly Database Migration Script
 * 
 * ============================================================
 * SETUP INSTRUCTIONS:
 * ============================================================
 * 1. Set the following environment variables before running:
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 * 2. Run the script with: node migrate.js
 * 
 * The script is idempotent (safe to run multiple times).
 * All SQL statements use "create if not exists" or "create or replace"
 * to ensure safe re-execution.
 * ============================================================
 * 
 * This script handles all DDL (schema) changes for:
 * - ambassador_requests: Tracks ambassador applications
 * - ambassador_earnings: Tracks ambassador commission earnings
 * - RPC functions: admin_ambassador_requests, admin_review_ambassador_request, ambassador_available_balance
 */

const fs = require('fs');
const path = require('path');

const MIGRATION_SQL = `
-- ============================================================
-- AMBASSADOR REQUESTS TABLE
-- ============================================================
-- Tracks when vendors apply to become ambassadors
create table if not exists public.ambassador_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  status text not null default 'pending',
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- ============================================================
-- AMBASSADOR EARNINGS TABLE
-- ============================================================
-- Tracks recurring commission earned by ambassadors
create table if not exists public.ambassador_earnings (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  amount numeric not null,
  source_event text not null default 'activation',
  status text not null default 'pending',
  earned_at timestamptz not null default now()
);

-- ============================================================
-- RPC: admin_ambassador_requests()
-- ============================================================
-- Returns all pending ambassador applications with vendor/store details
create or replace function public.admin_ambassador_requests()
returns table(
  request_id uuid,
  owner_id uuid,
  vendor_name text,
  store_id uuid,
  store_name text,
  email text,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ar.id,
    ar.owner_id,
    coalesce(p.first_name || ' ' || p.last_name, 'User') as vendor_name,
    ar.store_id,
    s.name as store_name,
    au.email,
    ar.status,
    ar.applied_at,
    ar.reviewed_at
  from public.ambassador_requests ar
  left join public.profiles p on p.id = ar.owner_id
  left join public.stores s on s.id = ar.store_id
  left join auth.users au on au.id = ar.owner_id
  order by ar.applied_at desc;
$$;

-- ============================================================
-- RPC: admin_review_ambassador_request(p_request_id, p_status)
-- ============================================================
-- Admin-only function to approve or decline an ambassador request
create or replace function public.admin_review_ambassador_request(
  p_request_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can review ambassador requests';
  end if;
  
  if p_status not in ('approved', 'declined') then
    raise exception 'Status must be approved or declined';
  end if;
  
  update public.ambassador_requests
  set
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_request_id;
end;
$$;

-- ============================================================
-- RPC: ambassador_available_balance(p_owner_id)
-- ============================================================
-- Returns the amount an ambassador can withdraw from cleared earnings
-- minus any pending/approved/paid withdrawal requests for ambassador source
create or replace function public.ambassador_available_balance(p_owner_id uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with cleared_earnings as (
    select coalesce(sum(amount), 0) as total
    from public.ambassador_earnings
    where ambassador_id = p_owner_id
      and status = 'cleared'
  ),
  reserved_withdrawals as (
    select coalesce(sum(amount), 0) as total
    from public.withdrawal_requests
    where owner_id = p_owner_id
      and source = 'ambassador'
      and status in ('pending', 'approved', 'paid')
  )
  select greatest((select total from cleared_earnings) - (select total from reserved_withdrawals), 0);
$$;

-- ============================================================
-- RPC: referral_available_balance(p_owner_id)
-- ============================================================
-- Returns the amount available for referral withdrawal
-- minus any pending/approved/paid withdrawal requests for referral source
create or replace function public.referral_available_balance(p_owner_id uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with total_earnings as (
    select coalesce(sum(reward_amount), 0) as total
    from public.referral_signups
    where referrer_id = p_owner_id
      and status = 'active'
  ),
  reserved_withdrawals as (
    select coalesce(sum(amount), 0) as total
    from public.withdrawal_requests
    where owner_id = p_owner_id
      and source = 'referral'
      and status in ('pending', 'approved', 'paid')
  )
  select greatest((select total from total_earnings) - (select total from reserved_withdrawals), 0);
$$;
`;

function main() {
  console.log('🚀 Vendly Database Migration Script');
  console.log('=' .repeat(60));
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('\n⚠️  Missing environment variables.');
    console.log('\nPlease set:');
    console.log('  export SUPABASE_URL=https://your-project.supabase.co');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    console.log('\nThen run: node migrate.js');
    console.log('\nAlternatively, copy the SQL below and run in Supabase SQL Editor.\n');
  }
  
  console.log('\n📋 SCHEMA MIGRATIONS TO APPLY:\n');
  console.log(MIGRATION_SQL);
  console.log('\n' + '='.repeat(60));
}

main();
