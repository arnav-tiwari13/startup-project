-- Manual check of rename/delete on advisor conversations. NOT run automatically: paste into the Supabase SQL
-- editor after applying 20261023000100_chat_rename_delete.sql. Runs in a transaction and rolls back.
begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'chat-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-0000000000d1', 'chat-b@example.test');
insert into public.restaurants (id, name) values
  ('a0000000-0000-4000-8000-0000000000c1', 'Chat A'), ('b0000000-0000-4000-8000-0000000000d1', 'Chat B');
insert into public.restaurant_members (restaurant_id, user_id) values
  ('a0000000-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000c1'),
  ('b0000000-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-0000000000d1');
insert into public.chat_conversations (id, restaurant_id, user_id) values
  ('a1000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000c1'),
  ('b1000000-0000-4000-8000-0000000000d1', 'b0000000-0000-4000-8000-0000000000d1', 'bbbbbbbb-0000-4000-8000-0000000000d1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

-- A renames and soft-deletes their own conversation.
update public.chat_conversations set title = 'Renamed' where id = 'a1000000-0000-4000-8000-0000000000c1';
select 'A renamed own (expect Renamed)' as check, title from public.chat_conversations where id = 'a1000000-0000-4000-8000-0000000000c1';
update public.chat_conversations set deleted_at = now() where id = 'a1000000-0000-4000-8000-0000000000c1';
select 'A deleted own (expect 1 deleted)' as check, count(*) from public.chat_conversations where deleted_at is not null;

-- A cannot touch B's conversation (expect 0 rows updated: the select below should still show NULL title).
update public.chat_conversations set title = 'Hacked' where id = 'b1000000-0000-4000-8000-0000000000d1';

-- Each of these should error (column permission denied), so leave them commented and try one at a time:
-- update public.chat_conversations set user_id = 'bbbbbbbb-0000-4000-8000-0000000000d1' where id = 'a1000000-0000-4000-8000-0000000000c1';
-- delete from public.chat_conversations where id = 'a1000000-0000-4000-8000-0000000000c1';

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select 'B title untouched (expect null)' as check, title from public.chat_conversations where id = 'b1000000-0000-4000-8000-0000000000d1';

rollback;
