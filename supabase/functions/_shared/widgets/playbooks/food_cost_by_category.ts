// Diagnosis playbook for the "food_cost_by_category" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose where the food money goes.
- Rank categories (or vendors) by % of sales versus their target; the biggest overshoot in dollars comes first.
- Dollar overshoot is (actual % - target %) x sales. Show that arithmetic for the top item.
- Check whether the spend change versus the comparison is volume (more sales) or price. Use get_price_changes to find price-driven categories.
- Recommend ordering, par-level, vendor or substitution actions, with a dollar estimate per month.`;
