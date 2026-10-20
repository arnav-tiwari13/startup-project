-- Manual check of row-level security. NOT run automatically: paste into the Supabase SQL editor.
-- It builds two users and two restaurants inside a transaction, then rolls everything back.
-- Every `select` at the bottom should return the stated result.
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
insert into public.chat_conversations (id, restaurant_id, user_id) values
  ('c0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a'),
  ('c0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b');
insert into public.chat_messages (conversation_id, restaurant_id, user_id, role, content) values
  ('c0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'user', 'A secret'),
  ('c0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-00000000000b', 'user', 'B secret');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select 'A sees only own restaurant (expect 1)' as check, count(*) from public.restaurants;
select 'A sees only own messages (expect 1)' as check, count(*) from public.chat_messages;
select 'A cannot see B messages (expect 0)' as check, count(*) from public.chat_messages where content = 'B secret';
select 'A sees only own conversations (expect 1)' as check, count(*) from public.chat_conversations;

-- Each of these must fail with "new row violates row-level security policy":
-- insert into public.chat_conversations (restaurant_id, user_id) values ('b0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-00000000000a');
-- insert into public.chat_messages (conversation_id, restaurant_id, user_id, role, content) values ('c0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-00000000000a', 'user', 'injected');

rollback;
