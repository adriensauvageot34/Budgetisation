"use client";

import type { MonthKey } from "@/domain/budget";
import { getEventIcon } from "@/domain/history-icons";
import { formatShortMonth } from "@/lib/format";

export type TimelineEventMarker = {
  id: string;
  event: string;
  label: string;
  title: string;
};

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
  eventsByMonth,
  onSelect,
  onEventSelect,
  onClear,
}: {
  months: MonthKey[];
  start?: MonthKey;
  end?: MonthKey;
  pendingStart?: MonthKey;
  eventsByMonth?: Partial<Record<MonthKey, TimelineEventMarker[]>>;
  onSelect: (month: MonthKey) => void;
  onEventSelect?: (month: MonthKey, event: TimelineEventMarker) => void;
  onClear: () => void;
}) {
  const selectionStart = pendingStart ?? start;
  return (
    <div className="card overflow-x-auto p-2">
      <div className="flex min-w-max items-center gap-1" aria-label="Sélection de la période">
        {months.map((month) => {
          const inRange = Boolean(start && end && month >= start && month <= end);
          const boundary = month === start || month === end || month === pendingStart;
          const monthEvents = eventsByMonth?.[month] ?? [];
          return (
            <div key={month} className="min-w-[88px] rounded-[0.8rem]">
              <button
                type="button"
                aria-pressed={inRange || month === pendingStart}
                onClick={() => onSelect(month)}
                className={`w-full rounded-[0.75rem] px-3 py-2.5 text-sm font-extrabold capitalize transition ${
                  boundary
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : inRange
                      ? "bg-[#dce8e3] text-[var(--color-primary-deep)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                }`}
              >
                {formatShortMonth(month)} {month.slice(0, 4)}
              </button>
              {monthEvents.length ? (
                <div className="mt-1 flex min-h-6 items-center justify-center gap-1">
                  {monthEvents.slice(0, 3).map((event) => {
                    const Icon = getEventIcon(event.event);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        title={event.title}
                        aria-label={`Explorer l’événement ${event.label}`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onEventSelect?.(month, event);
                        }}
                        className="rounded-md border border-[var(--color-border)] bg-white p-1 text-[var(--color-warning)] transition hover:-translate-y-0.5 hover:border-[var(--color-warning)] focus-visible:outline focus-visible:outline-2"
                      >
                        <Icon size={13} aria-hidden="true" />
                      </button>
                    );
                  })}
                  {monthEvents.length > 3 ? (
                    <span className="text-[10px] font-black text-[var(--color-muted)]">
                      +{monthEvents.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="min-h-7" />
              )}
            </div>
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

