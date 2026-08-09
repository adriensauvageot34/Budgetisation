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
              {formatShortMonth(month)} {month.slice(0, 4)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthRangeTimeline({
  months,
  start,
  end,
  pendingStart,
  onSelect,
  onClear,
}: {
  months: MonthKey[];
  start?: MonthKey;
  end?: MonthKey;
  pendingStart?: MonthKey;
  onSelect: (month: MonthKey) => void;
  onClear: () => void;
}) {
  const selectionStart = pendingStart ?? start;
  return (
    <div className="card overflow-x-auto p-2">
      <div className="flex min-w-max items-center gap-1" aria-label="Sélection de la période">
        {months.map((month) => {
          const inRange = Boolean(start && end && month >= start && month <= end);
          const boundary = month === start || month === end || month === pendingStart;
          return (
            <button
              key={month}
              type="button"
              aria-pressed={inRange || month === pendingStart}
              onClick={() => onSelect(month)}
              className={`min-w-[82px] rounded-[0.75rem] px-4 py-2.5 text-sm font-extrabold capitalize transition ${
                boundary
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : inRange
                    ? "bg-[#dce8e3] text-[var(--color-primary-deep)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
              }`}
            >
              {formatShortMonth(month)} {month.slice(0, 4)}
            </button>
          );
        })}
        {selectionStart ? (
          <button type="button" className="button-ghost ml-2 text-xs" onClick={onClear}>
            Effacer la période
          </button>
        ) : null}
      </div>
    </div>
  );
}

