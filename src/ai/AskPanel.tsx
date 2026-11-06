import { useEffect, useRef, useState, type FormEvent } from "react";
import { ADVISOR_CONFIG } from "../../supabase/functions/_shared/advisor/config.ts";
import type { Answer } from "../../supabase/functions/_shared/advisor/answer.ts";
import type { Chip } from "../../supabase/functions/_shared/widgets/context.ts";
import { AdvisorRequestError, streamAdvisor } from "../advisor/client";
import AnswerCard from "./AnswerCard";
import { useAi } from "./AiContext";
import type { Asked } from "./ref";

type Msg = { id: number; role: "user"; text: string } | { id: number; role: "ai"; text: string; answer?: Answer; pending: boolean };

const ERROR_TEXT: Record<string, string> = {
  empty: "Type a question first.",
  too_long: `Messages can be up to ${ADVISOR_CONFIG.maxMessageChars} characters.`,
  no_restaurant: "Your account isn't linked to a business yet, so there's no data to analyse.",
  rate_limited: "You're sending messages too quickly. Please wait a moment and try again.",
  not_found: "That conversation wasn't found. Close the panel and click again.",
  conversation_full: "This conversation is full. Close the panel and click again to start a new one.",
  bad_context: "That part of the dashboard couldn't be found. Close the panel and click it again.",
  model_error: "The advisor ran into a problem. Please try again.",
};

/** Side panel chat about one clicked thing. The chip shows what the AI was given; follow-ups keep it until cleared. */
export default function AskPanel() {
  const { asked, clear } = useAi();
  if (!asked) return null;
  // A new click is a new conversation, so state resets by remounting.
  return <Panel key={JSON.stringify(asked.ref)} asked={asked} onClose={clear} />;
}

function Panel({ asked, onClose }: { asked: Asked; onClose: () => void }) {
  const [context, setContext] = useState<Asked["ref"] | undefined>(asked.ref); // cleared by the user -> general chat
  const [chip, setChip] = useState<Chip | null>(asked.chip);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const abort = useRef<AbortController | null>(null);
  const next = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); return () => abort.current?.abort(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages, error]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy || text.length > ADVISOR_CONFIG.maxMessageChars) return;
    setError(null);
    setInput("");
    setBusy(true);
    const replyId = next.current++;
    setMessages((m) => [...m, { id: next.current++, role: "user", text }, { id: replyId, role: "ai", text: "", pending: true }]);
    const patch = (fn: (m: Extract<Msg, { role: "ai" }>) => Extract<Msg, { role: "ai" }>) =>
      setMessages((all) => all.map((m) => (m.id === replyId && m.role === "ai" ? fn(m) : m)));
    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamAdvisor({
        message: text, conversationId, context, signal: controller.signal,
        onEvent: (e) => {
          if (e.type === "meta") setConversationId(e.conversationId);
          else if (e.type === "context") setChip(e.chip);
          else if (e.type === "text") patch((m) => ({ ...m, text: m.text + e.text }));
          else if (e.type === "answer") patch((m) => ({ ...m, answer: e.answer, text: "" }));
          else if (e.type === "error") setError(ERROR_TEXT[e.code] ?? e.message);
        },
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setError(err instanceof AdvisorRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setMessages((all) => all.filter((m) => !(m.id === replyId && m.role === "ai" && !m.text && !m.answer)).map((m) => (m.id === replyId && m.role === "ai" ? { ...m, pending: false } : m)));
      setBusy(false);
      abort.current = null;
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void send(input); };
  const tooLong = input.length > ADVISOR_CONFIG.maxMessageChars;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30 sm:hidden" onClick={onClose} aria-hidden />
      <aside role="complementary" aria-label="Ask AI" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-xl sm:w-[26rem]">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><span aria-hidden className="text-accent">✦</span> Ask AI</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close panel" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink">
            <span aria-hidden>{"✕"}</span>
          </button>
        </header>

        {context && chip ? (
          <div className="border-b border-line bg-bg px-4 py-3 text-xs" aria-label="What the AI is looking at">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{chip.widget}</p>
                <p className="text-muted">{chip.target}</p>
                <p className="text-muted">{chip.period} · {chip.comparison}</p>
                {chip.filters.length > 0 && <p className="text-muted">{chip.filters.join(" · ")}</p>}
              </div>
              <button type="button" onClick={() => setContext(undefined)} className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1 font-medium text-ink hover:border-accent hover:text-accent">Clear context</button>
            </div>
          </div>
        ) : (
          <p className="border-b border-line bg-bg px-4 py-2 text-xs text-muted">No dashboard context. Ask anything about your business.</p>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">{context ? "Pick a question, or type your own." : "Type a question below."}</p>
              {context && (
                <div className="flex flex-wrap gap-2">
                  {asked.questions.map((q) => (
                    <button key={q} type="button" onClick={() => void send(q)} disabled={busy} className="rounded-full border border-line bg-bg px-3.5 py-2 text-left text-sm hover:border-accent disabled:opacity-50">{q}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 text-sm font-medium text-bg">{m.text}</div>
            ) : m.answer ? (
              <AnswerCard key={m.id} answer={m.answer} widgetId={asked.ref.widget_id} />
            ) : m.pending && !m.text ? (
              <div key={m.id} role="status" className="space-y-2 rounded-2xl border border-line bg-bg p-3.5" aria-label="The AI is working">
                {[0, 1, 2].map((i) => <div key={i} className="h-3 animate-pulse rounded bg-line/70" style={{ width: `${90 - i * 20}%` }} />)}
              </div>
            ) : (
              <div key={m.id} className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line bg-bg px-3.5 py-3 text-sm">{m.text}</div>
            ),
          )}
          {error && <div role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">{error}</div>}
          <div ref={bottom} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-line px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)} rows={2} aria-label="Message" placeholder="Ask a follow-up…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              className="min-h-[3rem] flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold">Stop</button>
            ) : (
              <button type="submit" disabled={!input.trim() || tooLong} className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-bg disabled:opacity-40">Send</button>
            )}
          </div>
          <p className={`mt-1 text-right text-xs ${tooLong ? "font-semibold text-bad" : "text-muted"}`}>{input.length}/{ADVISOR_CONFIG.maxMessageChars}</p>
        </form>
      </aside>
    </>
  );
}
