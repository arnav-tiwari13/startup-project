-- Let users rename and delete their own advisor conversations.
--
-- Rename: an optional title on the conversation (the app falls back to the first question).
-- Delete: a soft delete (deleted_at). The messages and tool calls stay in the database, because the
-- advisor's rate limit counts a user's recent messages and an admin may need to review conversations.
-- A hard delete would let anyone erase their message history to get around the limit.
-- Users can change only title and deleted_at, and only on their own conversations that are not deleted.

alter table public.chat_conversations
  add column title text check (char_length(title) between 1 and 100),
  add column deleted_at timestamptz;

create policy "users rename or delete own conversations" on public.chat_conversations
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

-- Column-level grant: user_id, restaurant_id and created_at stay unchangeable from the client.
grant update (title, deleted_at) on public.chat_conversations to authenticated;
