// Diagnosis playbook for the "ingredient_price_changes" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose ingredient price moves.
- Lead with the ingredients whose monthly impact is largest, not the largest percent change.
- Each price is compared with the last price paid before the period; say that if the owner might misread it.
- For each big mover suggest: renegotiate or quote another vendor, change pack size, adjust a recipe, or raise the price of dishes that use it (use get_menu_margins to name the dishes).
- Estimated dollar impact is the monthly impact shown; do not invent savings percentages.`;
