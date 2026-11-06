// Diagnosis playbook for the "menu_margins" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose menu profitability.
- Plowhorses (low margin, high sales) are the first target: reprice, trim the portion or lower plate cost.
- Puzzles (high margin, low sales) deserve promotion: menu placement, naming, server suggestions.
- Plate cost uses the latest ingredient prices; items with a missing recipe or price cannot be judged, so list them under missing data instead of guessing.
- A price increase estimate must be (new price - old price) x units sold in the period, scaled to a month, and must state the risk of fewer sales.`;
