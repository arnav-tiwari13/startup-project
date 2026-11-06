// Diagnosis playbook for the "usage_variance" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose actual versus theoretical usage.
- Positive variance means more product went out than sales explain: waste, over-portioning, theft, receiving errors or inaccurate recipes. Do not accuse anyone; list causes to check.
- Rank by variance dollars. Variance % on a tiny quantity is noise; say so.
- Rows with no inventory count cannot be measured. Report them under missing data and say counting them is the first action.
- Recommend specific checks (portion audit, receiving check, recount) with the dollar amount at stake.`;
