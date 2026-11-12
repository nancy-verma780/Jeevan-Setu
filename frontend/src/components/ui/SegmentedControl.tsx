import { Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Neutral options (like "Unknown") use grey instead of the action colour when chosen. */
  neutral?: boolean;
}

interface Props<T extends string> {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  labelledBy: string;
  size?: "sm" | "md";
}

/** A radio group drawn as joined buttons. Arrow keys move between options. */
export function SegmentedControl<T extends string>({ value, options, onChange, labelledBy, size = "md" }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (activeIndex + step + options.length) % options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="flex overflow-hidden rounded-md border border-slate-400"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              "flex flex-1 basis-0 items-center justify-center gap-1.5 font-semibold transition-colors",
              size === "md" ? "min-h-tap text-base" : "h-9 text-sm",
              index > 0 && "border-l border-slate-400",
              !selected && "bg-white text-slate-700 hover:bg-slate-50",
              selected && option.neutral && "bg-slate-200 text-slate-900",
              selected && !option.neutral && "bg-primary-700 text-white",
            )}
          >
            {selected && <Check className="h-4 w-4" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
