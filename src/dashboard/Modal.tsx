import { useEffect, useRef, type ReactNode } from "react";

/** A modal dialog on the native <dialog> element: focus is trapped, Escape closes it, and it announces itself to screen readers. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // a click on the backdrop closes it
      className="m-auto w-[min(94vw,34rem)] max-h-[90dvh] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink">
          <span aria-hidden>{"✕"}</span>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
