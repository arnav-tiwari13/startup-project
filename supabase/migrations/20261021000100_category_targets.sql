-- Per-category food cost targets (percent of sales), e.g. {"meat": 11, "produce": 4}.
-- Missing keys mean "not set". The app validates the keys and ranges; the database guards type and size.
alter table public.user_targets
  add column category_targets jsonb not null default '{}'::jsonb
  check (jsonb_typeof(category_targets) = 'object' and pg_column_size(category_targets) <= 2048);
