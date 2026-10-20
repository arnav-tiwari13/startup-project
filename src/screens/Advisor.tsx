import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ADVISOR_CONFIG } from "../../supabase/functions/_shared/advisor/config.ts";
import { AdvisorRequestError, streamAdvisor } from "../advisor/client";
import { parseBlocks, toolLabel, type Inline } from "../advisor/format";

interface Msg {
  id: number;
  role: "user" | "assistant";
  text: string;
  tools: string[];
}

const STARTERS = [
  "What was my food cost this week, and why?",
  "Which menu items have the worst margins?",
  "Which vendors raised prices recently?",
  "Where am I using more food than my recipes say I should?",
];

const ERROR_TEXT: Record<string, string> = {
  empty: "Type a question first.",
  too_long: `Messages can be up to ${ADVISOR_CONFIG.maxMessageChars} characters.`,
  no_restaurant: "Your account isn't linked to a business yet, so there's no data to analyse. Ask your admin to add you.",
  rate_limited: "You're sending messages too quickly. Please wait a moment and try again.",
  not_found: "That conversation wasn't found. Start a new chat.",
  conversation_full: "This conversation is full. Start a new chat to keep going.",
  model_error: "The advisor ran into a problem. Please try again.",
};

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
}

function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {parseBlocks(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}><InlineText parts={b.inline} /></p>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => <li key={j}><InlineText parts={it} /></li>)}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.items.map((it, j) => <li key={j}><InlineText parts={it} /></li>)}
          </ol>
        ),
      )}
    </div>
  );
}

export default function Advisor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, error]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const tooLong = input.length > ADVISOR_CONFIG.maxMessageChars;

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy || text.length > ADVISOR_CONFIG.maxMessageChars) return;
    setError(null);
    setInput("");
    setBusy(true);
    const userMsg: Msg = { id: nextId.current++, role: "user", text, tools: [] };
    const replyId = nextId.current++;
    setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", text: "", tools: [] }]);

    const controller = new AbortController();
    abortRef.current = controller;
    const patchReply = (fn: (m: Msg) => Msg) => setMessages((all) => all.map((m) => (m.id === replyId ? fn(m) : m)));

    try {
      await streamAdvisor({
        message: text,
        conversationId,
        signal: controller.signal,
        onEvent: (e) => {
          if (e.type === "meta") setConversationId(e.conversationId);
          else if (e.type === "text") patchReply((m) => ({ ...m, text: m.text + e.text }));
          else if (e.type === "tool") patchReply((m) => ({ ...m, tools: m.tools.includes(e.name) ? m.tools : [...m.tools, e.name] }));
          else if (e.type === "error") setError(ERROR_TEXT[e.code] ?? e.message);
        },
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof AdvisorRequestError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      // Drop an empty reply bubble (error before any text) so only the error banner shows.
      setMessages((all) => all.filter((m) => !(m.id === replyId && m.text === "")));
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setInput("");
  }

  const lastIsStreaming = busy && messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[26rem] lg:h-[calc(100dvh-13rem)] lg:min-h-[28rem] max-w-3xl flex-col rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
          AI advisor
        </div>
        <button type="button" onClick={newChat} disabled={messages.length === 0 && !busy} className="text-sm font-medium text-accent disabled:opacity-40">
          New chat
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-muted">
              Ask about your food cost, pricing, inventory, vendors and sales. The advisor answers from your own numbers.
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-line bg-bg px-3.5 py-2 text-left text-sm hover:border-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 font-medium text-bg">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[95%] space-y-2">
              {m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.tools.map((t) => (
                    <span key={t} className="rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">{toolLabel(t)}</span>
                  ))}
                </div>
              )}
              <div className="rounded-2xl rounded-bl-sm border border-line bg-bg px-3.5 py-3">
                {m.text ? <Answer text={m.text} /> : <span className="text-muted">Thinking…</span>}
              </div>
            </div>
          ),
        )}

        {error && (
          <div role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask about your business…"
            aria-label="Message"
            className="min-h-[3rem] flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-accent"
          />
          {lastIsStreaming ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-xl border border-line px-4 py-2.5 font-semibold">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={busy || !input.trim() || tooLong} className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-bg disabled:opacity-40">
              Send
            </button>
          )}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>Enter to send, Shift+Enter for a new line</span>
          <span className={tooLong ? "font-semibold text-bad" : ""}>
            {input.length}/{ADVISOR_CONFIG.maxMessageChars}
          </span>
        </div>
      </form>
    </div>
  );
}
