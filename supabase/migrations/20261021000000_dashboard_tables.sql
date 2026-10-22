-- Dashboard tables: vendors, ingredients, invoices, recipes, menu, sales, inventory counts, labor,
-- plus per-user targets and saved dashboard views.
--
-- Reuses public.restaurants and public.restaurant_members from the advisor migration. Each restaurant is
-- one location: an owner with several locations is a member of several restaurants, and "group by
-- location" means group by restaurant.
--
-- Money is whole cents (bigint). Unit prices are cents per unit as numeric(12,4), because real unit
-- prices (cost per ounce) are fractional; line totals are rounded to whole cents.
-- Row-level security is on for every table. Users can read rows of their own restaurants only.
-- Business data is read-only for users (loaded by an admin, the seed script, or later an import).

-- ---- Business data ---------------------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  unique (id, restaurant_id),
  unique (restaurant_id, name)
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  unit text not null,
  category text not null default 'other'
    check (category in ('meat', 'produce', 'dairy', 'dry_goods', 'beverage', 'other')),
  vendor_id uuid,
  unique (id, restaurant_id),
  unique (restaurant_id, name),
  foreign key (vendor_id, restaurant_id) references public.vendors (id, restaurant_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  vendor_id uuid not null,
  invoice_date date not null,
  total_cents bigint not null check (total_cents >= 0),
  unique (id, restaurant_id),
  foreign key (vendor_id, restaurant_id) references public.vendors (id, restaurant_id)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  invoice_id uuid not null,
  ingredient_id uuid not null,
  qty numeric(12, 3) not null check (qty >= 0),
  unit_cost_cents numeric(12, 4) not null check (unit_cost_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  foreign key (invoice_id, restaurant_id) references public.invoices (id, restaurant_id) on delete cascade,
  foreign key (ingredient_id, restaurant_id) references public.ingredients (id, restaurant_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  unique (id, restaurant_id),
  unique (restaurant_id, name)
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid not null,
  ingredient_id uuid not null,
  qty numeric(12, 4) not null check (qty > 0),
  unique (menu_item_id, ingredient_id),
  foreign key (menu_item_id, restaurant_id) references public.menu_items (id, restaurant_id) on delete cascade,
  foreign key (ingredient_id, restaurant_id) references public.ingredients (id, restaurant_id)
);

-- One row per menu item per day.
create table public.sales_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sale_date date not null,
  menu_item_id uuid not null,
  units integer not null check (units >= 0),
  sales_cents bigint not null check (sales_cents >= 0),
  unique (restaurant_id, sale_date, menu_item_id),
  foreign key (menu_item_id, restaurant_id) references public.menu_items (id, restaurant_id) on delete cascade
);

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id uuid not null,
  count_date date not null,
  qty numeric(12, 3) not null check (qty >= 0),
  unique (restaurant_id, ingredient_id, count_date),
  foreign key (ingredient_id, restaurant_id) references public.ingredients (id, restaurant_id) on delete cascade
);

create table public.labor_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  entry_date date not null,
  labor_cents bigint not null check (labor_cents >= 0),
  unique (restaurant_id, entry_date)
);

-- ---- Per-user settings -----------------------------------------------------------------------

-- Targets are per user and restaurant. A null target means "not set": rows show as uncolored, never green.
create table public.user_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  food_cost_pct numeric(5, 2) check (food_cost_pct between 0 and 100),
  labor_pct numeric(5, 2) check (labor_pct between 0 and 100),
  prime_cost_pct numeric(5, 2) check (prime_cost_pct between 0 and 100),
  margin_pct numeric(5, 2) check (margin_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

-- Named dashboard views. `config` holds table order/visibility, columns, sort, filters, period and
-- comparison. The app validates it with a schema; the database only guards type and size.
create table public.dashboard_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 32768),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
-- At most one active view per user.
create unique index dashboard_views_one_active_idx on public.dashboard_views (user_id) where is_active;
-- A user can keep up to 25 views (enforced by the trigger below).
create function public.limit_dashboard_views() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.dashboard_views where user_id = new.user_id) >= 25 then
    raise exception 'too many saved views';
  end if;
  return new;
end $$;
create trigger dashboard_views_limit before insert on public.dashboard_views
  for each row execute function public.limit_dashboard_views();

-- ---- Indexes (beyond the unique constraints above) -------------------------------------------

create index ingredients_category_idx on public.ingredients (restaurant_id, category);
create index invoices_date_idx on public.invoices (restaurant_id, invoice_date);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
-- Price history and category spend are looked up per ingredient.
create index invoice_items_ingredient_idx on public.invoice_items (restaurant_id, ingredient_id);
create index recipe_items_ingredient_idx on public.recipe_items (restaurant_id, ingredient_id);
create index sales_items_date_idx on public.sales_items (restaurant_id, sale_date) include (menu_item_id, units, sales_cents);
create index inventory_counts_date_idx on public.inventory_counts (restaurant_id, count_date);
create index vendors_restaurant_idx on public.vendors (restaurant_id);
create index menu_items_restaurant_idx on public.menu_items (restaurant_id);
create index user_targets_restaurant_idx on public.user_targets (restaurant_id);

-- ---- Row-level security ----------------------------------------------------------------------

alter table public.vendors enable row level security;
alter table public.ingredients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.menu_items enable row level security;
alter table public.recipe_items enable row level security;
alter table public.sales_items enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.labor_entries enable row level security;
alter table public.user_targets enable row level security;
alter table public.dashboard_views enable row level security;

-- Business data: members read their own restaurants' rows. No insert, update or delete for users.
create policy "members read vendors" on public.vendors for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read ingredients" on public.ingredients for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read invoices" on public.invoices for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read invoice items" on public.invoice_items for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read menu items" on public.menu_items for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read recipe items" on public.recipe_items for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read sales items" on public.sales_items for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read inventory counts" on public.inventory_counts for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));
create policy "members read labor entries" on public.labor_entries for select to authenticated
  using (restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));

-- Targets: a user manages only their own, and only for restaurants they belong to.
create policy "users read own targets" on public.user_targets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users create own targets" on public.user_targets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid()))
  );
create policy "users update own targets" on public.user_targets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid()))
  );
create policy "users delete own targets" on public.user_targets for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saved views: own rows only.
create policy "users read own views" on public.dashboard_views for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users create own views" on public.dashboard_views for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "users update own views" on public.dashboard_views for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users delete own views" on public.dashboard_views for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on
  public.vendors, public.ingredients, public.invoices, public.invoice_items, public.menu_items,
  public.recipe_items, public.sales_items, public.inventory_counts, public.labor_entries
to authenticated;
grant select, insert, update, delete on public.user_targets, public.dashboard_views to authenticated;
