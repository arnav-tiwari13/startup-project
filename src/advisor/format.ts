export type Inline = { text: string; bold: boolean };
export type Block =
  | { type: "p"; inline: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

/** Splits **bold** runs. Everything else stays plain text, so nothing from the model is ever treated as HTML. */
export function parseInline(text: string): Inline[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? { text: part.slice(2, -2), bold: true }
      : { text: part, bold: false },
  );
}

/** Minimal formatting for answers: paragraphs, "- " bullets, "1." numbered lists and **bold**. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flush();
      list ??= { type, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      const last = blocks[blocks.length - 1];
      // Consecutive plain lines belong to one paragraph.
      if (last && last.type === "p") last.inline.push({ text: " ", bold: false }, ...parseInline(line.trim()));
      else blocks.push({ type: "p", inline: parseInline(line.trim()) });
    }
  }
  flush();
  return blocks;
}

const TOOL_LABELS: Record<string, string> = {
  get_food_cost: "Checking food cost",
  get_price_changes: "Checking vendor price changes",
  get_menu_margins: "Checking menu margins",
  get_actual_vs_theoretical: "Comparing actual and expected usage",
  get_sales_summary: "Checking sales",
};
export const toolLabel = (name: string) => TOOL_LABELS[name] ?? "Looking up your data";
