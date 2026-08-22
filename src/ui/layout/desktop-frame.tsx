import type { ReactNode } from "react";

export type DesktopFrameProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label?: string;
};

export function DesktopFrame({ children, className, label }: DesktopFrameProps) {
  return (
    <main
      className={["ui-desktop-frame", className].filter(Boolean).join(" ")}
      aria-label={label}
      data-layout="desktop"
    >
      {children}
    </main>
  );
}
