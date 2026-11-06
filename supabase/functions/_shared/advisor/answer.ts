// The structured answer the AI gives when the owner clicked something in AI mode. The model returns it by
// calling the submit_answer tool, so the shape is enforced instead of parsed out of free text.
import { z } from "zod";
import type { ToolDefinition } from "./tools.ts";

export const EFFORTS = ["low", "medium", "high"] as const;

export const actionSchema = z
  .object({
    title: z.string().trim().min(1).max(100).describe("The action, in one short sentence."),
    detail: z.string().trim().min(1).max(400).describe("What to do, concretely."),
    impact_dollars: z.number().min(0).max(10_000_000).nullable().describe("Estimated dollars per month saved or gained, or null if it cannot be estimated from the data."),
    impact_basis: z.string().trim().max(200).describe("The arithmetic behind the estimate, using numbers from the data."),
    effort: z.enum(EFFORTS).describe("How much work it is."),
    risk: z.string().trim().min(1).max(250).describe("The main risk of doing it."),
  })
  .strict();

export const answerSchema = z
  .object({
    summary: z.string().trim().min(1).max(600).describe("The answer in two or three sentences."),
    evidence: z.array(z.string().trim().min(1).max(300)).max(6).describe("Key figures from the data that support the summary."),
    actions: z.array(actionSchema).max(4).describe("Recommended actions, best first. Empty if the data does not support any."),
    missing_data: z.array(z.string().trim().min(1).max(200)).max(6).describe("Data that is missing and what is needed. Never guess around it."),
  })
  .strict();

export type Answer = z.infer<typeof answerSchema>;
export type AnswerAction = z.infer<typeof actionSchema>;

export const SUBMIT_ANSWER = "submit_answer";

const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(answerSchema) as Record<string, unknown>;
export const SUBMIT_ANSWER_TOOL: ToolDefinition = {
  name: SUBMIT_ANSWER,
  description: "Give the owner your final answer. Call this exactly once, after you have the data you need. Put the whole answer in it; do not write text outside it.",
  input_schema: jsonSchema as ToolDefinition["input_schema"],
};

/** Plain-text form, stored in the conversation history so follow-up questions can refer back to it. */
export function renderAnswerText(a: Answer): string {
  const lines = [a.summary];
  if (a.evidence.length) lines.push("", "Evidence:", ...a.evidence.map((e) => `- ${e}`));
  if (a.actions.length) {
    lines.push("", "Recommended actions:");
    a.actions.forEach((x, i) =>
      lines.push(`${i + 1}. ${x.title} (${x.impact_dollars === null ? "impact not estimated" : `about $${Math.round(x.impact_dollars)}/month`}, ${x.effort} effort). ${x.detail} Risk: ${x.risk}`));
  }
  if (a.missing_data.length) lines.push("", "Missing data:", ...a.missing_data.map((m) => `- ${m}`));
  return lines.join("\n");
}
