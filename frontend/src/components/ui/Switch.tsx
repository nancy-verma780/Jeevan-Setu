import { cx } from "./cx";

export function Switch({
  checked,
  onChange,
  labelledBy,
  tone = "primary",
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy: string;
  tone?: "primary" | "warning";
  disabled?: boolean;
}) {
  const on = tone === "warning" ? "bg-warning-700 border-warning-700" : "bg-primary-700 border-primary-700";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-8 w-[52px] shrink-0 rounded-full border transition-colors disabled:opacity-50",
        checked ? on : "border-slate-400 bg-slate-200",
      )}
    >
      <span className={cx("absolute top-[3px] h-6 w-6 rounded-full bg-white transition-[left]", checked ? "left-[23px]" : "left-[3px]")} />
    </button>
  );
}
