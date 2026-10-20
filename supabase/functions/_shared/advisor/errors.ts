const redact = (s: string) =>
  s
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");

/**
 * A log-safe description of an error: its type, HTTP status and a short message, with anything that
 * looks like an API key or token removed. Enough to diagnose problems without leaking secrets.
 */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error";
  const status = (err as { status?: unknown }).status;
  const parts = [err.name];
  if (typeof status === "number") parts.push(`status ${status}`);
  parts.push(redact(err.message).slice(0, 300));
  return parts.join(" | ");
}
