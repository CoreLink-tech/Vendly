# Vendly

This project is a static front-end powered by Supabase for auth and product storage.

## What was added
- `supabase.js`: Supabase client initializer using your project URL and anon key.
- `vendly-nav.js`: session restore and Supabase-aware auth guard improvements.
- Auth integration in `login.html` and `signup.html`.
- Product persistence in `dashboard.html` using `products` table.
- `supabase-schema.sql`: recommended Supabase schema for `stores`, `products`, and `profiles`.

## Supabase setup
1. Open your Supabase project.
2. Go to `SQL Editor` and run `supabase-schema.sql`.
3. Enable Row Level Security for `stores`, `products`, and `profiles`.
4. Add policies to allow authenticated users to manage their own data. Example policies:

### `stores`
- SELECT/INSERT/UPDATE/DELETE if `auth.uid() = owner_id`

### `products`
- SELECT/INSERT/UPDATE/DELETE if `auth.uid() = owner_id`

### `profiles`
- SELECT/UPDATE if `auth.uid() = id`

## Running locally
Open any HTML file in the browser, or serve the folder with a simple static server.

## Notes
- The front-end uses Supabase Auth for login and signup.
- The signup flow also inserts a `stores` row when the table exists.
- Product creation/deletion is backed by `products`.
