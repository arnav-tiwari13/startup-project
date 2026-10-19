import type { ReactNode } from "react";

export default function PhoneFrame({ contactName, children }: { contactName: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[22rem] rounded-[2.5rem] border-[10px] border-ink/90 bg-surface shadow-xl overflow-hidden">
      <div className="bg-bg border-b border-line py-3 text-center">
        <div className="mx-auto mb-1 h-5 w-5 rounded-full bg-line" aria-hidden />
        <div className="text-xs font-semibold">{contactName}</div>
        <div className="text-[10px] text-muted">Text Message</div>
      </div>
      <div className="px-3 py-4 min-h-[24rem]">{children}</div>
    </div>
  );
}
