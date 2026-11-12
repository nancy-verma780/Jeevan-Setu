import { X } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "./useDialogFocus";

interface DrawerProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ open, title, subtitle, onClose, onKeyDown, children, footer }: DrawerProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogFocus(ref, open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-overlay motion-safe:animate-slide-in"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="tabular text-lg font-bold text-slate-900">
              {title}
            </h2>
            {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <footer className="border-t border-slate-200 px-6 py-4">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}
