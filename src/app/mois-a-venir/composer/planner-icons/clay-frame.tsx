import type { ReactNode } from "react";
export type ClayIconProps = { size?: number; className?: string };
export function ClayFrame({ size = 52, className, children }: ClayIconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none" data-clay-icon>
    <ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#d4cddd" opacity=".3" />
    <g strokeLinejoin="round" strokeLinecap="round">{children}</g>
  </svg>;
}
