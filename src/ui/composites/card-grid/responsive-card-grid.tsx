import type { ReactNode } from "react";

export function ResponsiveCardGrid({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <div className="ui-responsive-card-grid" data-layout="desktop-adaptive" aria-label={label}>
      {children}
    </div>
  );
}
