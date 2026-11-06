-- Action list: recommendations from the AI that an owner chose to save and track.
-- Each row belongs to one user and one restaurant they are a member of. Row-level security is on:
-- users can only see, add and update their own rows, and can only add rows for a restaurant they belong to.

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  widget_id text not null check (char_length(widget_id) between 1 and 40),
  title text not null check (char_length(title) between 1 and 100),
  detail text not null check (char_length(detail) between 1 and 400),
  impact_cents bigint check (impact_cents between 0 and 1000000000),
  impact_basis text not null default '' check (char_length(impact_basis) <= 200),
  effort text not null check (effort in ('low', 'medium', 'high')),
  risk text not null check (char_length(risk) between 1 and 250),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index action_items_user_idx on public.action_items (user_id, status, created_at desc);

alter table public.action_items enable row level security;

create policy "users read own action items" on public.action_items
  for select to authenticated using (user_id = (select auth.uid()));

create policy "users add action items for their restaurant" on public.action_items
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'open'
    and restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid()))
    -- A cap per user stops runaway inserts from a buggy or hostile client.
    and (select count(*) from public.action_items a where a.user_id = (select auth.uid())) < 500
  );

create policy "users update own action items" on public.action_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "users delete own action items" on public.action_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- Only the status can change after saving; everything else stays as the AI recommended it.
grant select, insert, delete on public.action_items to authenticated;
grant update (status, updated_at) on public.action_items to authenticated;
