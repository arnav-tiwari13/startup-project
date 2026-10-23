-- Removes the two sample restaurants (Cedar Lane Smokehouse and Rolling Tacos) and everything attached to them:
-- vendors, ingredients, invoices, recipes, menu, sales, inventory, labor, chats and the members linked to them.
-- It touches only these two ids. Paste into the Supabase SQL editor.

-- 1. Preview first: what will be deleted (run this on its own).
select r.id, r.name,
  (select count(*) from public.restaurant_members m where m.restaurant_id = r.id) as members,
  (select count(*) from public.restaurant_profiles p where p.restaurant_id = r.id) as profiles,
  (select count(*) from public.invoices i where i.restaurant_id = r.id) as invoices,
  (select count(*) from public.chat_conversations c where c.restaurant_id = r.id) as chats
from public.restaurants r
where r.id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

-- 2. Delete (run after checking the preview). Child tables are removed automatically (on delete cascade).
-- NOTE: if your own account owns a sample restaurant, your business profile and chats on it go too,
-- and you will be asked to set up your profile again at next sign-in.
delete from public.restaurants
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
