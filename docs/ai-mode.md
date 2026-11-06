# AI mode

A switch in the dashboard header. When it is on, every table and the daily sales chart can be clicked (the whole widget, a table row, a cell, or a chart bar). A side panel opens with a chip saying what was clicked, starter questions for that widget, and a chat. Follow-up messages keep the same context until the owner presses **Clear context**.

## How a click becomes an answer

1. The browser sends a **reference only**: `widget_id`, the target (`widget`, `row` + row key, `cell` + row key + column id, or `point` + date), the period, the comparison, the filters and the grouping. It never sends a number. The schema (`_shared/widgets/click.ts`) is strict, so an extra field is rejected.
2. The `advisor` function finds the user's restaurant from their membership (never from the request), validates the reference, and re-runs the shared table code (`tables/` -> `metrics/`) for exactly that slice (`_shared/widgets/context.ts`). A location filter or row key that is not the user's own gives the same generic `bad_context` error as a malformed request.
3. The system prompt is the base prompt, the widget's playbook, and the verified data. Only that widget's tools are offered, plus `submit_answer`.
4. The model must finish by calling `submit_answer`: summary, evidence, up to 4 actions (each with estimated dollars per month, the arithmetic behind it, effort and main risk) and `missing_data`. The panel shows it as a card. If data is missing the card says what is needed.
5. **Save to action list** stores one action in `action_items` (RLS: own rows only, only for a restaurant the user belongs to, 500 max). The **Action list** button in the header lets owners mark items done, dismiss, reopen or delete them.

Rate limiting is the advisor's existing per-user limit (6 a minute, 100 a day); clicks count as messages.

## Widget registry

`_shared/widgets/registry.ts` has one entry per widget: id (same as the table id), title, the metric formulas it uses, the tools the AI may call, starter questions per click kind, and the playbook. **Playbooks are plain text in their own files**, `_shared/widgets/playbooks/<widget_id>.ts`; edit them to change how the AI diagnoses that widget.

Adding a widget: add its table (see `dashboard-tables.md`), a playbook file and a registry entry. A test fails if a table has no registry entry, a tool name is wrong, or a listed metric does not exist in `metrics/`.

## What you need to configure

- Apply the migration: `supabase db push` (adds `action_items`).
- Redeploy the function: `supabase functions deploy advisor` (it now reads the click reference). `ANTHROPIC_API_KEY` must already be set as a secret; no new secrets.
- The new `daily_sales` chart is added to saved layouts automatically (missing widgets are appended).

## Known limits

- The panel's starter chip is built in the browser from labels already on screen; the server's own chip replaces it once the first reply starts, and only the server's numbers reach the AI.
- A context holds up to 25 rows of a clicked widget; a row, cell or point click holds just that row.
- The advisor answers for the user's first restaurant, as it always has; location filters naming another restaurant are refused.
