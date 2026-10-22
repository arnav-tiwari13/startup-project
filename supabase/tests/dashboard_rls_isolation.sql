-- Manual check of row-level security on the dashboard tables. NOT run automatically: paste into the
-- Supabase SQL editor after applying 20261021000000_dashboard_tables.sql.
-- It builds two users and two restaurants inside a transaction, then rolls everything back.
-- Every `select` below should return the stated count, and each commented insert must fail.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'rls-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'rls-b@example.test');
insert into public.restaurants (id, name) values
  ('a0000000-0000-4000-8000-000000000001', 'RLS Restaurant A'),
  ('b0000000-0000-4000-8000-000000000002', 'RLS Restaurant B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a'),
  ('b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b');

-- One row of every business table for each restaurant (A uses ...a1, B uses ...b1 ids).
insert into public.vendors (id, restaurant_id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A vendor'),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'B vendor');
insert into public.ingredients (id, restaurant_id, name, unit, vendor_id) values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A ingredient', 'lb', 'a1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'B ingredient', 'lb', 'b1000000-0000-4000-8000-000000000001');
insert into public.invoices (id, restaurant_id, vendor_id, invoice_date, total_cents) values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-10-01', 1000),
  ('b3000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', '2026-10-01', 1000);
insert into public.invoice_items (restaurant_id, invoice_id, ingredient_id, qty, unit_cost_cents, line_total_cents) values
  ('a0000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 10, 100, 1000),
  ('b0000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 10, 100, 1000);
insert into public.menu_items (id, restaurant_id, name, price_cents) values
  ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A dish', 1000),
  ('b4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'B dish', 1000);
insert into public.recipe_items (restaurant_id, menu_item_id, ingredient_id, qty) values
  ('a0000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 1),
  ('b0000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 1);
insert into public.sales_items (restaurant_id, sale_date, menu_item_id, units, sales_cents) values
  ('a0000000-0000-4000-8000-000000000001', '2026-10-01', 'a4000000-0000-4000-8000-000000000001', 1, 1000),
  ('b0000000-0000-4000-8000-000000000002', '2026-10-01', 'b4000000-0000-4000-8000-000000000001', 1, 1000);
insert into public.inventory_counts (restaurant_id, ingredient_id, count_date, qty) values
  ('a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', '2026-10-01', 5),
  ('b0000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', '2026-10-01', 5);
insert into public.labor_entries (restaurant_id, entry_date, labor_cents) values
  ('a0000000-0000-4000-8000-000000000001', '2026-10-01', 300),
  ('b0000000-0000-4000-8000-000000000002', '2026-10-01', 300);
insert into public.user_targets (user_id, restaurant_id, food_cost_pct) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 30),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 30);
insert into public.dashboard_views (user_id, name, config) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'A view', '{}'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'B view', '{}');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select 'vendors (expect 1)' as check, count(*) from public.vendors;
select 'ingredients (expect 1)' as check, count(*) from public.ingredients;
select 'invoices (expect 1)' as check, count(*) from public.invoices;
select 'invoice_items (expect 1)' as check, count(*) from public.invoice_items;
select 'menu_items (expect 1)' as check, count(*) from public.menu_items;
select 'recipe_items (expect 1)' as check, count(*) from public.recipe_items;
select 'sales_items (expect 1)' as check, count(*) from public.sales_items;
select 'inventory_counts (expect 1)' as check, count(*) from public.inventory_counts;
select 'labor_entries (expect 1)' as check, count(*) from public.labor_entries;
select 'user_targets (expect 1)' as check, count(*) from public.user_targets;
select 'dashboard_views (expect 1)' as check, count(*) from public.dashboard_views;
select 'B rows visible anywhere (expect 0)' as check,
  (select count(*) from public.vendors where name = 'B vendor')
  + (select count(*) from public.menu_items where name = 'B dish')
  + (select count(*) from public.dashboard_views where name = 'B view') as total;

-- Each of these must fail ("new row violates row-level security policy", or a permission error):
-- insert into public.labor_entries (restaurant_id, entry_date, labor_cents) values ('a0000000-0000-4000-8000-000000000001', '2026-10-02', 1);   -- business data is read-only
-- insert into public.user_targets (user_id, restaurant_id, food_cost_pct) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000002', 30);  -- not a member of B
-- insert into public.dashboard_views (user_id, name, config) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'forged', '{}');  -- someone else's user_id

-- And these must change zero rows (they are invisible to A):
update public.dashboard_views set name = 'hijacked' where name = 'B view';
delete from public.user_targets where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b';

rollback;
