-- Run once in the Supabase SQL editor to try the advisor with the built-in sample data.
-- The two ids below must match SAMPLE_RESTAURANT_ID and SAMPLE_RESTAURANT_ID_2 in
-- supabase/functions/_shared/advisor/mock-data.ts.
insert into public.restaurants (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Cedar Lane Smokehouse (sample)'),
  ('00000000-0000-4000-8000-000000000002', 'Rolling Tacos (sample)')
on conflict (id) do nothing;

-- Link a user to a restaurant. Replace the email with the Google account you sign in with.
-- Use ...0001 for the full sample, ...0002 for the food truck that has no inventory counts.
insert into public.restaurant_members (restaurant_id, user_id, role)
select '00000000-0000-4000-8000-000000000001', id, 'owner'
from auth.users
where email = 'YOUR_EMAIL@example.com'
on conflict do nothing;
