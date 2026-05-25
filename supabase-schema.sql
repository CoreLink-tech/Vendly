-- Supabase schema for Vendly backend
-- Run this in your Supabase SQL editor after creating the project.

-- Enable Row Level Security on the tables after creation.

create table if not exists stores (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  whatsapp text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null default 0,
  image_url text,
  status text not null default 'live',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Optional: store profile data for users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Triggers to keep updated_at in sync
create or replace function update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger stores_updated_at
before update on stores
for each row
execute function update_timestamp();

create trigger products_updated_at
before update on products
for each row
execute function update_timestamp();

create trigger profiles_updated_at
before update on profiles
for each row
execute function update_timestamp();
