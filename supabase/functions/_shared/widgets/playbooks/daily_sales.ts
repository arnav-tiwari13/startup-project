// Diagnosis playbook for the "daily_sales" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose daily sales patterns.
- Look at the clicked day against the period average and the same weekday elsewhere in the period; weekday shape is normal, so compare like with like.
- A zero day can mean closed or missing data; say you cannot tell which and ask.
- Recommend staffing, prep or promotion changes only when the pattern is visible in the data; give a dollar estimate with its basis.
- Use get_sales_summary for top and slow sellers on or around that day.`;
