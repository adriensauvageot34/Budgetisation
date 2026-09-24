"use client";

import type { KeyboardEvent, MutableRefObject } from "react";
import { nextRovingMonthIndex, shortMonthLabel, type AnnualMonthFocusState } from "./annual-month-focus";
import styles from "./background-rhythms.module.css";

export function AnnualMonthInteractionLayer({
  domain,
  months,
  state,
  buttonRefs,
  onPreview,
  onSelect,
  onMove,
  onClose,
}: {
  readonly domain: "food" | "car";
  readonly months: readonly string[];
  readonly state: AnnualMonthFocusState;
  readonly buttonRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  readonly onPreview: (month?: string) => void;
  readonly onSelect: (month: string, index: number) => void;
  readonly onMove: (index: number) => void;
  readonly onClose: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, month: string, index: number) => {
    const next = nextRovingMonthIndex(index, event.key, months.length);
    if (next !== undefined) {
      event.preventDefault();
      onMove(next);
      onPreview(months[next]);
      buttonRefs.current[next]?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(month, index);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return <div className={styles.monthInteractionLayer} data-domain={domain}>
    {months.map((month, index) => <button
      key={month}
      ref={(element) => { buttonRefs.current[index] = element; }}
      type="button"
      className={styles.monthAnchor}
      data-selected={state.selectedMonth === month}
      data-preview={state.previewMonth === month}
      aria-label={`${shortMonthLabel(month)}, ${state.selectedMonth === month ? "refermer le détail" : "afficher le détail"}`}
      aria-pressed={state.selectedMonth === month}
      tabIndex={state.rovingMonth === index ? 0 : -1}
      onMouseEnter={() => onPreview(month)}
      onMouseLeave={() => onPreview(undefined)}
      onFocus={() => { onMove(index); onPreview(month); }}
      onBlur={() => onPreview(undefined)}
      onClick={() => onSelect(month, index)}
      onKeyDown={(event) => handleKeyDown(event, month, index)}
    ><span>{shortMonthLabel(month)}</span></button>)}
  </div>;
}
