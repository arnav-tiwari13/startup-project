-- Business profiles: what a user tells us about their restaurant right after they sign up.
--
-- One profile per restaurant (public.restaurants). Users can read profiles of restaurants they belong to
-- but cannot write the table directly: public.save_restaurant_profile() does the write as the user, creating
-- the restaurant and the owner membership on the first save, and updating the same profile on later saves.
-- Money is whole cents (bigint), percentages are numeric(5,2), same conventions as the dashboard tables.

create table public.restaurant_profiles (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 120),
  concept text not null check (concept in (
    'full_service', 'fast_casual', 'counter_service', 'food_truck', 'bar_pub', 'cafe_bakery', 'catering_ghost', 'other'
  )),
  cuisine text not null check (char_length(cuisine) between 1 and 80),
  city text not null check (char_length(city) between 1 and 80),
  state text not null check (char_length(state) between 1 and 80),
  owner_role text not null check (owner_role in ('owner', 'general_manager', 'chef', 'finance', 'other')),
  locations_count integer not null default 1 check (locations_count between 1 and 1000),
  opened_year integer check (opened_year between 1900 and 2100),
  seats integer check (seats between 0 and 10000),
  days_open_per_week integer check (days_open_per_week between 1 and 7),
  staff_count integer check (staff_count between 0 and 100000),
  pos_system text check (char_length(pos_system) <= 80),
  main_vendors text[] not null default '{}' check (cardinality(main_vendors) <= 20),
  annual_revenue_cents bigint not null check (annual_revenue_cents >= 0),
  avg_check_cents bigint check (avg_check_cents >= 0),
  weekly_covers integer check (weekly_covers >= 0),
  monthly_food_purchases_cents bigint check (monthly_food_purchases_cents >= 0),
  food_cost_pct numeric(5, 2) check (food_cost_pct between 0 and 100),
  target_food_cost_pct numeric(5, 2) check (target_food_cost_pct between 0 and 100),
  labor_cost_pct numeric(5, 2) check (labor_cost_pct between 0 and 100),
  challenges text[] not null default '{}' check (cardinality(challenges) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_profiles enable row level security;

create policy "members read their restaurant profile" on public.restaurant_profiles
  for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));

-- No insert, update or delete policy: writes go through save_restaurant_profile().
grant select on public.restaurant_profiles to authenticated;

-- Saves the signed-in user's profile and returns the restaurant id. `p` is a JSON object with the column names above.
-- Picks the restaurant to write to: one the user owns that already has a profile, else one they own without a profile
-- (for example a sample restaurant an admin linked them to), else it creates a new restaurant with them as owner.
create function public.save_restaurant_profile(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
  had_profile boolean := false;
  created boolean := false;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select m.restaurant_id, (pr.restaurant_id is not null)
    into rid, had_profile
  from public.restaurant_members m
  left join public.restaurant_profiles pr on pr.restaurant_id = m.restaurant_id
  where m.user_id = uid and m.role = 'owner'
  order by (pr.restaurant_id is not null) desc, m.created_at
  limit 1;

  if rid is null then
    insert into public.restaurants (name) values (left(trim(p ->> 'business_name'), 120)) returning id into rid;
    insert into public.restaurant_members (restaurant_id, user_id, role) values (rid, uid, 'owner');
    created := true;
  end if;

  insert into public.restaurant_profiles (
    restaurant_id, business_name, concept, cuisine, city, state, owner_role, locations_count, opened_year, seats,
    days_open_per_week, staff_count, pos_system, main_vendors, annual_revenue_cents, avg_check_cents, weekly_covers,
    monthly_food_purchases_cents, food_cost_pct, target_food_cost_pct, labor_cost_pct, challenges
  ) values (
    rid,
    left(trim(p ->> 'business_name'), 120),
    p ->> 'concept',
    left(trim(p ->> 'cuisine'), 80),
    left(trim(p ->> 'city'), 80),
    left(trim(p ->> 'state'), 80),
    p ->> 'owner_role',
    coalesce((p ->> 'locations_count')::integer, 1),
    (p ->> 'opened_year')::integer,
    (p ->> 'seats')::integer,
    (p ->> 'days_open_per_week')::integer,
    (p ->> 'staff_count')::integer,
    nullif(left(trim(p ->> 'pos_system'), 80), ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'main_vendors')), '{}'),
    (p ->> 'annual_revenue_cents')::bigint,
    (p ->> 'avg_check_cents')::bigint,
    (p ->> 'weekly_covers')::integer,
    (p ->> 'monthly_food_purchases_cents')::bigint,
    (p ->> 'food_cost_pct')::numeric,
    (p ->> 'target_food_cost_pct')::numeric,
    (p ->> 'labor_cost_pct')::numeric,
    coalesce(array(select jsonb_array_elements_text(p -> 'challenges')), '{}')
  )
  on conflict (restaurant_id) do update set
    business_name = excluded.business_name,
    concept = excluded.concept,
    cuisine = excluded.cuisine,
    city = excluded.city,
    state = excluded.state,
    owner_role = excluded.owner_role,
    locations_count = excluded.locations_count,
    opened_year = excluded.opened_year,
    seats = excluded.seats,
    days_open_per_week = excluded.days_open_per_week,
    staff_count = excluded.staff_count,
    pos_system = excluded.pos_system,
    main_vendors = excluded.main_vendors,
    annual_revenue_cents = excluded.annual_revenue_cents,
    avg_check_cents = excluded.avg_check_cents,
    weekly_covers = excluded.weekly_covers,
    monthly_food_purchases_cents = excluded.monthly_food_purchases_cents,
    food_cost_pct = excluded.food_cost_pct,
    target_food_cost_pct = excluded.target_food_cost_pct,
    labor_cost_pct = excluded.labor_cost_pct,
    challenges = excluded.challenges,
    updated_at = now();

  -- Keep the restaurant's display name in step with the profile, except for a restaurant that already existed
  -- before the user's first profile save (e.g. a sample restaurant the advisor's test data depends on).
  if created or had_profile then
    update public.restaurants set name = left(trim(p ->> 'business_name'), 120) where id = rid;
  end if;

  return rid;
end;
$$;

revoke all on function public.save_restaurant_profile(jsonb) from public, anon;
grant execute on function public.save_restaurant_profile(jsonb) to authenticated;
