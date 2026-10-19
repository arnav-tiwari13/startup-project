# MVP Demo Spec: Done-For-You Food Cost Service

## Purpose

A clickable demo that shows a restaurant owner what they get from the service each week. It is a sales tool for owner conversations, not working software. Every number is sample data for a fictional restaurant.

The demo must work two ways:
- Walked through in person on a laptop or phone.
- Sent as a link the owner clicks through alone.

The message the demo should leave: "They do the data entry. I get a short report every week that tells me where I'm losing money on food and what to change."

## Constraints

- No login, no backend, no database, no real POS or invoice connections.
- All data lives in static JSON files under `src/data/`.
- Mobile-first. Many owners will open the link on a phone.
- A visible "Demo: sample data" label on every screen.
- Product name is not decided. Use `[Product Name]` in one config value so it can be changed in one place.

## Suggested stack

- Vite + React + TypeScript + Tailwind CSS.
- Static build that can be deployed to Vercel.
- No component library needed. Keep dependencies minimal.

## Sample restaurant

| Field | Value |
| --- | --- |
| Name | Cedar Lane Smokehouse (fictional) |
| Location | Austin, TX |
| Type | Counter-service barbecue with Tex-Mex specials |
| Locations | 1 |
| Annual sales | $1.2M (about $100K/month) |
| POS | Toast |
| Main vendors | Sysco, US Foods, a local produce vendor |
| Actual food cost (before) | 36.5% |
| Theoretical food cost | 33.0% |
| Target food cost | 33.0% |

## Screens

### 0. Home / overview

- Restaurant name and week (Week of Oct 12-18).
- One headline card: food cost this week vs target, and the estimated monthly savings.
- Links to the five screens below.
- Short line at the bottom: "Your contact: Arnav, texts answered same day."

### 1. Free audit result

What a prospect receives after the free one-week audit.

- Headline: "You're spending about 3.5 points more on food than your recipes say you should."
- Actual 36.5% vs theoretical 33.0%, shown as a simple bar or gauge.
- Estimated savings: about $1,500-2,000 per month (1.5-2 points on $100K monthly sales).
- Top 5 leaks, ranked by monthly dollars:

| # | Leak | Est. $/month |
| --- | --- | --- |
| 1 | Brisket price up 9% at Sysco over 6 weeks; plate price unchanged | $620 |
| 2 | Brisket plates averaging 9.2 oz vs the 8 oz spec | $540 |
| 3 | Unsold ribs thrown out at end of day, mostly Saturdays | $310 |
| 4 | Short deliveries and vendor credits never claimed | $180 |
| 5 | Cheddar price up 14% since August (mac and cheese) | $150 |
| | Total | $1,800 |

- Call to action: "Start Core: $500/month, cancel anytime."

### 2. Weekly report (phone text view)

The most important screen. Show it as a text message thread on a phone frame.

Message content:

> Cedar Lane, week of Oct 12-18
> Food cost: 35.8% (target 33.0%). Down from 36.5% last week.
>
> 3 things to do this week:
> 1. Brisket is up 9% at Sysco. Raise the brisket plate $1 (to $25) or hold portions to 8 oz. Either one saves about $600/month.
> 2. Brisket plates are averaging 9.2 oz. Put the scale back at the cutting station.
> 3. 14 racks of ribs went unsold Saturday. Smoke 50 racks instead of 60 this Saturday.
>
> Reply here with questions. - Arnav

Below the phone, a link: "See the full numbers," which goes to the Menu margins screen.

### 3. Menu margins

Which dishes make money and which lose it. Use net sales.

| Dish | Price | Cost per plate | Food cost % | Sold/week | Status |
| --- | --- | --- | --- | --- | --- |
| Brisket plate (8 oz + 2 sides) | $24.00 | $10.10 | 42.1% | 310 | Problem |
| Brisket sandwich | $15.00 | $5.85 | 39.0% | 220 | Watch |
| Ribs, half rack | $26.00 | $9.40 | 36.2% | 180 | Watch |
| Chopped brisket tacos | $14.00 | $4.60 | 32.9% | 150 | Good |
| Mac and cheese (side) | $5.00 | $1.45 | 29.0% | 400 | Good |
| Pulled pork plate | $18.00 | $5.20 | 28.9% | 190 | Good |
| Sausage plate | $17.00 | $4.90 | 28.8% | 140 | Good |
| Banana pudding | $6.00 | $1.10 | 18.3% | 260 | Good |

Status rules: above 38% = Problem, 34-38% = Watch, below 34% = Good.

- Sort by food cost %, highest first.
- Tapping a dish shows its recipe breakdown (ingredients, amounts, cost of each). Build at least the brisket plate breakdown; the others can be simpler.

### 4. Price alerts

Items whose price rose more than 5% week over week.

| Item | Vendor | Last week | This week | Change |
| --- | --- | --- | --- | --- |
| Limes (case) | Local produce | $24.00 | $27.00 | +12.5% |
| Brisket, whole packer (lb) | Sysco | $5.49 | $5.98 | +8.9% |
| Takeout containers (case) | US Foods | $48.00 | $51.36 | +7.0% |
| Cheddar, shredded (lb) | US Foods | $3.10 | $3.29 | +6.1% |

- Each alert shows which dishes it affects (brisket: brisket plate, sandwich, tacos).
- Each alert has one suggested action in plain language.

### 5. Invoice capture

Shows that the owner only takes a photo and a person checks the result.

- Left (or top on mobile): a mock photo of a Sysco invoice. Draw it in HTML/CSS or use a placeholder image; do not use a real Sysco logo.
- Right (or below): the extracted line items in a table (item, quantity, unit, unit price, total).
- One line flagged: "Ordered 2 cases of pork butt, received 1. Credit requested: $142.80."
- One line flagged as a price increase (brisket).
- A badge at the bottom: "Verified by Arnav, Oct 14."
- Three-step strip above it: "1. Snap a photo or forward the email  2. AI reads it  3. A person checks every line."

## Design notes

- Plain, confident and practical. It should look like a tool for a busy owner, not a tech startup pitch.
- Large numbers, short sentences, dollars before percentages where possible.
- Semantic colors only for status: green = good, amber = watch, red = problem.
- Works in light and dark mode.

## Out of scope for this demo

- Login, accounts, payments.
- Real Toast or Square connections.
- Real invoice reading.
- Labor, card fees, delivery apps and the other "Later" features.
- The weekly count form (add later if owners ask how counting works).

## Build order

1. Project setup, sample data JSON files, shared layout with the demo label.
2. Weekly report screen (most persuasive, build it first).
3. Menu margins, including the brisket plate breakdown.
4. Audit result.
5. Price alerts.
6. Invoice capture.
7. Home / overview tying it together.
8. Deploy to Vercel and check it on a phone.

## Done when

- Every screen loads from the JSON data, with no numbers hard-coded in components.
- The whole demo can be clicked through on a phone in under 3 minutes.
- The numbers agree across screens (for example, the brisket increase is 9% everywhere).
