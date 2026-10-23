-- Manual check of restaurant profiles. NOT run automatically: paste into the Supabase SQL editor after applying
-- 20261023000000_restaurant_profiles.sql. Runs inside a transaction and rolls back. Each `select` states its expected result.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'profile-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'profile-b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

-- First save creates a restaurant, an owner membership and the profile.
select public.save_restaurant_profile('{
  "business_name": "Profile Test Grill", "concept": "full_service", "cuisine": "BBQ", "city": "Austin", "state": "TX",
  "owner_role": "owner", "locations_count": 2, "annual_revenue_cents": 120000000, "food_cost_pct": 35.8,
  "main_vendors": ["Sysco", "US Foods"], "challenges": ["food_cost"]
}'::jsonb) as restaurant_id;
select 'profiles visible to A (expect 1)' as check, count(*) from public.restaurant_profiles;
select 'A is owner (expect 1)' as check, count(*) from public.restaurant_members where role = 'owner';

-- A second save updates the same profile and does not create another restaurant.
select public.save_restaurant_profile('{
  "business_name": "Profile Test Grill 2", "concept": "full_service", "cuisine": "BBQ", "city": "Austin", "state": "TX",
  "owner_role": "owner", "annual_revenue_cents": 130000000
}'::jsonb);
select 'still one profile (expect 1)' as check, count(*) from public.restaurant_profiles;
select 'updated name (expect Profile Test Grill 2)' as check, business_name from public.restaurant_profiles;
select 'vendors cleared on update (expect 0)' as check, cardinality(main_vendors) from public.restaurant_profiles;

-- Bad values are rejected (each should error):
-- select public.save_restaurant_profile('{"business_name":"x","concept":"nope","cuisine":"x","city":"x","state":"x","owner_role":"owner","annual_revenue_cents":1}'::jsonb);
-- insert into public.restaurant_profiles (restaurant_id, business_name, concept, cuisine, city, state, owner_role, annual_revenue_cents) values (gen_random_uuid(), 'x','other','x','x','x','owner',1);

-- User B sees nothing of A's.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select 'profiles visible to B (expect 0)' as check, count(*) from public.restaurant_profiles;

rollback;
