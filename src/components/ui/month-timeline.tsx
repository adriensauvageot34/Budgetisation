"use client";

import type { MonthKey } from "@/domain/budget";
import { formatShortMonth } from "@/lib/format";

export function MonthTimeline({
  months,
  selected,
  onChange,
}: {
  months: MonthKey[];
  selected: MonthKey;
  onChange: (month: MonthKey) => void;
}) {
  return (
    <div className="card overflow-x-auto p-2">
      <div className="flex min-w-max items-center gap-1" role="tablist" aria-label="Mois">
        {months.map((month) => {
          const active = month === selected;
          return (
            <button
              key={month}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(month)}
              className={`min-w-[76px] rounded-[0.75rem] px-4 py-2.5 text-sm font-extrabold capitalize transition ${
                active
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
              }`}
            >
              {formatShortMonth(month)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
