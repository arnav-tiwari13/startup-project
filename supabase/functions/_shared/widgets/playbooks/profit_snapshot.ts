// Diagnosis playbook for the "profit_snapshot" widget. Plain text added to the AI's system prompt when this widget is clicked.
// Edit freely: it only guides what to look at and what to recommend. Numbers always come from the verified data.
export default `Diagnose profit health.
- Start with prime cost % (food + labor). Above target means profit is being squeezed; say which of food or labor is the bigger gap to target.
- Compare food cost % and labor % with the owner's targets and with the comparison period, in percentage points.
- Remember food cost here is what was bought in the period, not what was used. A large swing can be a big delivery or an inventory build, not waste. Say so when relevant.
- Est. profit excludes rent, fees and other costs. Never call it net profit.
- Recommend at most one food action and one labor action, each tied to a number in the data. Use the get_food_cost and get_actual_vs_theoretical tools when you need to find where food cost is leaking.`;
