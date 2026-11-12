import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

const CONTROL =
  "w-full rounded-md border border-slate-400 bg-white px-3 text-base text-slate-900 placeholder:text-slate-500 " +
  "focus:border-primary-700 disabled:bg-slate-100 aria-[invalid=true]:border-danger-700";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, hint, error, optional, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
        {optional && <span className="ml-2 font-normal text-slate-600">{optional}</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(CONTROL, "min-h-tap", className)} {...rest} />;
});

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(CONTROL, "min-h-tap pr-8", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, "min-h-[96px] py-2", className)} {...rest} />;
}

export function Checkbox({
  checked,
  onChange,
  children,
  describedBy,
  invalid,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="mt-0.5 h-6 w-6 shrink-0 accent-primary-700"
      />
      <span className="text-sm text-slate-800">{children}</span>
    </label>
  );
}
