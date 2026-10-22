# Dashboard tables

The Overview tab is a set of customizable tables. This page covers how it fits together, how to run it, how to add a table, and what Phase 2 tables will need.

## How it works

```
browser                                   Supabase
-------                                   --------
TableCard ──POST /functions/v1/table-data──▶ table-data Edge Function
  ▲   (request: table, period, filters…)      │ verifies the user (auth.getUser)
  │                                           │ reads as that user (row-level security)
  │                                           ▼
  └──────────── rows + cells ◀──── supabase/functions/_shared/tables/
                                     run.ts → compute.ts → metrics/
```

- **Metrics** (`supabase/functions/_shared/metrics/`): every formula, once, in whole cents. Returns a value or a reason it is missing. Tables, CSV export and the AI advisor all use it. Don't write a formula anywhere else.
- **Tables** (`supabase/functions/_shared/tables/`): `definitions.ts` is the config (columns, tooltips, default sort, filters, groupings). `compute.ts` builds rows from data. `run.ts` filters, sorts and pages. `schema.ts` validates requests. `view.ts` validates saved layouts.
- **UI** (`src/dashboard/`, `src/screens/Home.tsx`): generated from the definitions. `controller.ts` owns saved views and autosave.
- **Saved data**: `dashboard_views` (a user's named layouts, one active), `user_targets` (targets per restaurant).

Each restaurant is one location. An owner with several locations belongs to several restaurants, and "group by location" groups by restaurant.

## Running it

```bash
supabase db push                                   # tables, row-level security, indexes
supabase functions deploy table-data --no-verify-jwt
SUPABASE_SERVICE_ROLE_KEY=... SEED_CONFIRM=sample-data npm run seed
npm run seed -- --dry-run                          # row counts only, no keys needed
npm test                                           # unit tests
```

The seed only touches the two sample restaurants (`...0001` Cedar Lane, `...0002` Rolling Tacos). It is never run by a build, migration or deploy. Link your user to a restaurant with `supabase/sample-restaurants.sql`.

To check isolation against the real database, paste `supabase/tests/dashboard_rls_isolation.sql` into the SQL editor. It rolls back, and every `select` states the count it should return.

### Indexes added

| Table | Index | Used for |
|---|---|---|
| `sales_items` | `(restaurant_id, sale_date) include (menu_item_id, units, sales_cents)` | period sales |
| `invoices` | `(restaurant_id, invoice_date)` | period spend |
| `invoice_items` | `(restaurant_id, ingredient_id)`, `(invoice_id)` | price history, joins |
| `inventory_counts` | `(restaurant_id, count_date)` | usage windows |
| `ingredients` | `(restaurant_id, category)` | category grouping |
| `recipe_items` | `(restaurant_id, ingredient_id)` | usage per ingredient |
| `labor_entries`, `inventory_counts` | unique `(restaurant_id, date…)` | lookups |
| `dashboard_views` | unique `(user_id) where is_active`, unique `(user_id, name)` | one active view |

## The AI advisor shares these numbers

The advisor's tools (`supabase/functions/_shared/advisor/table-data.ts`) read the same real tables as the dashboard, as the signed-in user, and run the dashboard's own table code (`tables/`, which calls `metrics/`). They only choose a date range ("last 7/14/28 days" ending today), pick a table, and convert cents to dollars at the tool boundary. So food cost %, price changes, menu margins and usage variance cannot differ between the dashboard and the advisor. `tests/advisor/table-data.test.ts` checks this on the seed data.

What changed for the advisor: food cost is now what was bought on invoices in the period (the dashboard definition), not counted usage, and price changes report the estimated monthly impact. The old in-memory sample data (`dataset-data.ts`, `mock-data.ts`) is kept for tests and offline evals only and is not wired into the Edge Function. Redeploy the `advisor` function to pick this up.

## Adding a table

1. **Definition**: add an entry to `TABLE_DEFS` in `_shared/tables/definitions.ts` and its id to `TABLE_IDS` in `types.ts`.
2. **Query**: write `myTable(ctx: Ctx): TableResult` in `compute.ts`. Use formulas from `metrics/`. Return a `missing` cell when data is missing.
3. **Register**: add it to `REGISTRY` in `run.ts` with the data it reads (`needs`).
4. **Test**: add a case in `tests/tables/tables.test.ts`. The isolation tests loop over `TABLE_IDS`, so the new table gets them automatically.

No UI change is needed. Saved layouts from before the table existed pick it up automatically (`loadViewConfig` appends new tables and columns).

## Phase 2 (designed for, not built)

Each fits the same config-plus-query shape. New tables need the data below; where a metric is new it goes in `metrics/` first.

| Table | Data needed | New schema |
|---|---|---|
| Sales and growth (day, daypart, average check, guests) | sales with timestamp, ticket id, guest count | `tickets` (restaurant, opened_at, guests, total_cents), keep `sales_items` for item mix |
| Labor detail | hours and pay by role and shift, schedule vs actual | `labor_shifts` (restaurant, date, role, hours, cost_cents); `labor_entries` becomes a rollup |
| Purchasing by vendor | already in invoices | none: group `invoice_items` by vendor, add on-time and price-trend metrics |
| Delivery-app and card fees | fee lines per platform and payment type | `fees` (restaurant, date, source, gross_cents, fee_cents) |
| Waste log | waste events: item, quantity, reason, cost | `waste_entries` (restaurant, date, ingredient_id, qty, reason) |
| Alerts list | thresholds and what fired | `alerts` (restaurant, kind, severity, created_at, resolved_at, payload); computed from the existing tables |

Targets for new metrics extend `user_targets` (a column or a jsonb key, as `category_targets` did).

## Known limits

- **Food cost** on the profit snapshot is what was bought (invoices dated in the period), not what was used. Actual vs. theoretical usage is the table that measures use.
- **Today** for the period presets is the UTC date. Restaurant time zones are not stored yet.
- **Usage windows** follow the inventory counts, not the exact period edges. The table notes the dates it used.
- **Targets** are per user. A user who belongs to several restaurants sets them per location; the "All locations" row averages them.
