import type { AdvisorEvent } from "../../supabase/functions/_shared/advisor/handler.ts";

/** Incremental parser for server-sent events. Feed it text chunks; it calls back once per complete event. */
export function createSseParser(onEvent: (e: AdvisorEvent) => void) {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
        if (!data) continue;
        try {
          onEvent(JSON.parse(data) as AdvisorEvent);
        } catch {
          // Ignore a malformed event rather than breaking the whole answer.
        }
      }
    },
  };
}
