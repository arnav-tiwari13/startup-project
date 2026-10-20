-- AI advisor: restaurants, who belongs to them, and chat logs.
-- Every table has row-level security on. Users can only see rows tied to them or their own restaurant.

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'employee')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index chat_conversations_user_idx on public.chat_conversations (user_id, created_at desc);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, id);
-- Rate limiting counts a user's recent messages.
create index chat_messages_rate_idx on public.chat_messages (user_id, created_at desc) where role = 'user';

create table public.chat_tool_calls (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_name text not null,
  input jsonb,
  ok boolean not null,
  error text,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);
create index chat_tool_calls_conversation_idx on public.chat_tool_calls (conversation_id, id);

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_tool_calls enable row level security;

-- Restaurants and memberships are read-only for users. An admin links users to restaurants (see supabase/sample-restaurants.sql).
create policy "members read their restaurant" on public.restaurants
  for select to authenticated
  using (id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid())));

create policy "users read their own memberships" on public.restaurant_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Conversations: own rows only, and only inside a restaurant the user belongs to.
create policy "users read own conversations" on public.chat_conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users create own conversations" on public.chat_conversations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and restaurant_id in (select restaurant_id from public.restaurant_members where user_id = (select auth.uid()))
  );

-- Messages and tool calls: own rows only, attached to the user's own conversation in the same restaurant.
create policy "users read own messages" on public.chat_messages
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users write own messages" on public.chat_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid()) and c.restaurant_id = chat_messages.restaurant_id
    )
  );

create policy "users read own tool calls" on public.chat_tool_calls
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users write own tool calls" on public.chat_tool_calls
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid()) and c.restaurant_id = chat_tool_calls.restaurant_id
    )
  );

-- No update or delete policies: logs can't be edited or removed by users.
-- Reviewing conversations across users is done as an admin (dashboard SQL editor or service role), which bypasses these policies.
grant select on public.restaurants, public.restaurant_members to authenticated;
grant select, insert on public.chat_conversations, public.chat_messages, public.chat_tool_calls to authenticated;
