# AI advisor: setup and how it works

The advisor is a chat screen in the dashboard (**AI advisor** in the sidebar). The browser never talks to Anthropic.
It calls a Supabase Edge Function, which checks who you are, applies limits, fetches your numbers with tools, and streams Claude's answer back.

```
Browser (React)  ->  Edge Function "advisor"  ->  Anthropic API
  sign-in token        verifies user                (key lives only here)
                       limits + logging  ->  Supabase Postgres (row-level security)
                       tools  ->  RestaurantData (sample data today, your real data later)
```

## One-time setup (you do these)

Nothing here has been run against your Supabase project yet. The code and tests are in the repo; these steps deploy it.

1. **Install the Supabase CLI** and sign in:
   ```bash
   brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref pnouqpnadokuunxsmgsn
   ```
2. **Create the tables** (restaurants, memberships, chat logs, row-level security):
   ```bash
   supabase db push
   ```
3. **Add the sample restaurants and link yourself to one.** Open `supabase/sample-restaurants.sql`, replace `YOUR_EMAIL@example.com` with the Google account you sign in with, and run it in the Supabase SQL editor. (Optional: run `supabase/tests/rls_isolation.sql` there to check row-level security. It rolls back and changes nothing.)
4. **Add your Anthropic key as a secret** (never in code or the frontend):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
5. **Deploy the function:**
   ```bash
   supabase functions deploy advisor
   ```
6. Push to `main` (already deploys the site) and open **AI advisor** while signed in.

Optional secrets: `ANTHROPIC_MODEL` (default `claude-opus-5-5`; try `claude-sonnet-5-5` for lower cost), `ANTHROPIC_EFFORT` (`low`..`max`, default `medium`), `ANTHROPIC_FALLBACKS=off`.

## Where things are

| What | File |
| --- | --- |
| System prompt (edit this) | `supabase/functions/_shared/advisor/system-prompt.ts` |
| Model name, limits, effort | `supabase/functions/_shared/advisor/config.ts` |
| The five tools | `.../tools.ts` (definitions) and `.../dataset-data.ts` (math) |
| Where numbers come from | `.../data-source.ts` (sample data in `.../mock-data.ts`) |
| Per-request flow | `.../handler.ts` |
| Edge Function entry | `supabase/functions/advisor/index.ts` |
| Database tables and security | `supabase/migrations/20261020000000_advisor_chat.sql` |
| Chat screen | `src/screens/Advisor.tsx` |

## Swapping in real data

The tools only talk to the `RestaurantData` interface (`types.ts`). Today `createRestaurantData(restaurantId)` returns sample data. When real tables exist, change that one function to load the restaurant's invoices, recipes, sales and inventory counts into a `RestaurantDataset` (or implement `RestaurantData` directly). Tool schemas, the prompt and the screen do not change. A restaurant with no data already answers "no data" instead of guessing.

## How access is kept separate

- The user comes from the verified login token, never from the request body.
- The restaurant is looked up from that user (`restaurant_members`), never accepted from the browser.
- Tools take no restaurant id; a tool call that tries to pass one is rejected. Each data source is built for one restaurant.
- Conversations are only readable by their owner, and a user can't continue someone else's conversation.
- Postgres row-level security enforces the same rules again, and users have no update or delete rights on logs.
- Logs (conversations, messages, tool calls with their inputs) are written to `chat_*` tables. API keys and tokens are never logged. To review them across users, use the Supabase dashboard (admin access bypasses row-level security).

## Limits

Per user: 6 messages a minute, 100 a day. Messages up to 2000 characters. 40 messages per conversation. 6 tool round trips per question. All in `config.ts`.

## Tests

```bash
npm test                 # 59 fast tests, no network, free
npm run test:live        # 18 chat cases against the real model. Costs money; needs ANTHROPIC_API_KEY in your shell
```

The fast tests cover tool math (hand-checked numbers), isolation between two restaurants, rate limiting, length caps, the tool loop, error handling, and the chat UI's stream parser. The live cases cover on-topic questions, off-topic refusals, prompt-injection and prompt-extraction attempts, and missing-data questions. They use a canary line in the prompt to detect leaks.

## Known limits

- The sample data is fake and unrelated to the website demo's numbers.
- Users are linked to restaurants by hand (SQL). A user in several restaurants is treated as belonging to the first.
- Prompt wording alone is not a security boundary. The real protection is the server-side scoping above.
- The Edge Function and the SQL have not been run against a live Supabase project, and the model has not been called, in this repo's tests. The first real run may need small fixes.
