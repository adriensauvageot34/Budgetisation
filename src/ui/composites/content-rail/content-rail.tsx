import type { ReactNode } from "react";

export type ContentRailItem = {
  readonly key: string;
  readonly content: ReactNode;
};

export type ContentRailProps = {
  readonly label: string;
  readonly items: readonly ContentRailItem[];
  readonly mode?: "row" | "rail";
};

export function ContentRail({ label, items, mode = "row" }: ContentRailProps) {
  if (items.length === 0) return null;
  const resolvedMode = items.length >= 4 && mode === "rail" ? "rail" : "row";
  return (
    <div
      className="ui-content-rail"
      data-mode={resolvedMode}
      data-count={items.length}
      aria-label={label}
    >
      {items.map((item) => <div key={item.key}>{item.content}</div>)}
    </div>
  );
}
