import { useId, type CSSProperties, type ReactNode } from "react";
export type ClayIconProps = { size?: number; className?: string };
const materials = {
  ivory: ["#fffaf0", "#e9dfd0", "#bdad96"], pearl: ["#f9f7ff", "#ded8ec", "#a9a0bd"],
  violet: ["#e6d9fc", "#baa0da", "#8974b0"], sage: ["#e1efd5", "#acc495", "#7d9e6d"],
  blue: ["#dce9f7", "#a3bed6", "#7895b7"], peach: ["#ffe4d0", "#e4bc9f", "#bc8f79"],
  gold: ["#ffefd0", "#e9c681", "#bf995b"], shadow: ["#c4bdce", "#a6a0b5", "#817993"]
} as const;
export function ClayFrame({ size = 52, className, children }: ClayIconProps & { children: ReactNode }) {
  const id = useId().replace(/:/gu, "");
  const paints = Object.fromEntries(Object.keys(materials).map(key => [`--sculpture-${key}`, `url(#${id}-${key})`])) as CSSProperties;
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={paints} aria-hidden="true" focusable="false" fill="none" data-clay-icon data-clay-material="matte-sculpture">
    <defs>{Object.entries(materials).map(([key, colors]) => <linearGradient key={key} id={`${id}-${key}`} x1=".15" y1="0" x2=".85" y2="1">
      <stop offset="0" stopColor={colors[0]} /><stop offset=".42" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} />
    </linearGradient>)}</defs>
    <ellipse cx="33" cy="57" rx="20" ry="3.5" fill="#776884" opacity=".12" />
    <ellipse cx="32" cy="56" rx="14" ry="2" fill="#5f526d" opacity=".10" />
    <g strokeLinejoin="round" strokeLinecap="round">{children}</g>
  </svg>;
}
