-- Promote ashedavid2007@gmail.com to admin access in Supabase.
-- Run this after the user has already signed up through Supabase Auth.

insert into public.admin_users (user_id, email)
select
  au.id,
  lower(au.email)
from auth.users au
where lower(au.email) = 'ashedavid2007@gmail.com'
on conflict (email) do update
set user_id = excluded.user_id,
    email = excluded.email;

-- If the auth user does not exist yet, this query will insert 0 rows.
select *
from public.admin_users
where lower(email) = 'ashedavid2007@gmail.com';
