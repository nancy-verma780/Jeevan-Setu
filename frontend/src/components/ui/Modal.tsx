import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./useDialogFocus";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** A bottom sheet on phones and a centred dialog on wider screens. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(ref, open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 motion-safe:animate-fade-in sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-lg bg-white p-6 shadow-overlay sm:rounded-lg"
      >
        <h2 id={titleId} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <div className="text-base text-slate-700">{children}</div>
        {footer && <div className="grid grid-cols-2 gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
