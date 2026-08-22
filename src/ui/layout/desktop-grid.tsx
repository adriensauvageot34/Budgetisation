import type { CSSProperties, ReactNode } from "react";

export type DesktopGridProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function DesktopGrid({ children, className }: DesktopGridProps) {
  return (
    <div className={["ui-desktop-grid", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
export type DesktopGridItemProps = {
  readonly children: ReactNode;
  readonly span?: number;
  readonly className?: string;
};

type GridStyle = CSSProperties & { readonly "--ui-grid-span"?: number };

export function DesktopGridItem({
  children,
  span = 12,
  className,
}: DesktopGridItemProps) {
  if (!Number.isInteger(span) || span < 1 || span > 12) {
    throw new RangeError("DesktopGridItem.span doit être compris entre 1 et 12.");
  }
  return (
    <div
      className={["ui-desktop-grid-item", className].filter(Boolean).join(" ")}
      style={{ "--ui-grid-span": span } as GridStyle}
    >
      {children}
    </div>
  );
}
