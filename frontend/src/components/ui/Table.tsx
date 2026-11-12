import type { ReactNode } from "react";
import { cx } from "./cx";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
  minWidth?: number;
}

/** Dense table with a sticky header that scrolls sideways inside its own box. */
export function Table<T>({ columns, rows, rowKey, rowClassName, caption, minWidth = 760 }: TableProps<T>) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-700",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={cx("hover:bg-slate-50", rowClassName?.(row))}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "border-b border-slate-200 px-4 py-3 align-middle text-slate-900",
                    column.align === "right" && "tabular text-right",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
