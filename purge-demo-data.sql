-- Clear application records while keeping the schema and admin mapping intact.
-- Run only if you are ready to remove vendor/store/product/order/analytics data.

begin;

truncate table public.product_views restart identity cascade;
truncate table public.store_views restart identity cascade;
truncate table public.orders restart identity cascade;
truncate table public.products restart identity cascade;
truncate table public.withdrawal_requests restart identity cascade;
truncate table public.referral_signups restart identity cascade;
truncate table public.referral_codes restart identity cascade;
truncate table public.activation_codes restart identity cascade;
truncate table public.stores restart identity cascade;
truncate table public.profiles restart identity cascade;

commit;
