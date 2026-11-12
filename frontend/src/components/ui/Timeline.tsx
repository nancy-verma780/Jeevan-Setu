import { cx } from "./cx";

export interface TimelineItem {
  id: string | number;
  time: string;
  title: string;
  detail?: string;
  tone?: "default" | "success" | "danger";
}

/** Newest first. The first item is drawn as the current step. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => {
        const current = index === 0;
        const last = index === items.length - 1;
        const dot =
          item.tone === "danger" ? "border-danger-700" : item.tone === "success" ? "border-success-700" : current ? "border-primary-700" : "border-slate-400";
        const fill =
          current && item.tone === "danger" ? "bg-danger-700" : current && item.tone === "success" ? "bg-success-700" : current ? "bg-primary-700" : "bg-white";
        return (
          <li key={item.id} className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
            <div className="flex flex-col items-center" aria-hidden>
              <span className={cx("mt-1 h-3 w-3 rounded-full border-2", dot, fill)} />
              {!last && <span className="w-0.5 flex-1 bg-slate-200" />}
            </div>
            <div className="flex flex-col gap-0.5 pb-4">
              <time className="tabular text-xs text-slate-600">{item.time}</time>
              <span className={cx("text-base", current ? "font-semibold text-slate-900" : "text-slate-700")}>{item.title}</span>
              {item.detail && <span className="text-sm text-slate-600">{item.detail}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
