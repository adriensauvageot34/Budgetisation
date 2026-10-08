import { isValidElement, useId, type CSSProperties, type ReactNode } from "react";
export type ClayIconProps = { size?: number; className?: string };
const materials = {
  ivory: ["#fffdf6", "#f5e8d9", "#c9ad96"], pearl: ["#fffaff", "#e6dcf3", "#bca5cf"],
  violet: ["#dcb8ff", "#a56bdd", "#6934af"], sage: ["#c5f2a9", "#62b865", "#287c50"],
  blue: ["#c3e5ff", "#74b4e5", "#376baa"], peach: ["#ffdbbd", "#f5ad82", "#cf785c"],
  gold: ["#ffe6a5", "#f6b648", "#ce7e23"], shadow: ["#d8c6df", "#a993bc", "#736788"],
  coral: ["#ffb4ac", "#f06b71", "#bb365b"], plum: ["#bf9adc", "#8456b9", "#4e357c"],
  coffee: ["#b98258", "#75452f", "#3e2623"],
} as const;
function usedMaterials(children: ReactNode): (keyof typeof materials)[] {
  const used = new Set<keyof typeof materials>();
  const visit = (node: ReactNode) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isValidElement(node)) return;
    const props = node.props as { fill?: unknown; stroke?: unknown; children?: ReactNode };
    for (const value of [props.fill, props.stroke]) {
      if (typeof value !== "string") continue;
      for (const match of value.matchAll(/var\(--sculpture-([a-z]+)\)/gu)) {
        if (match[1] in materials) used.add(match[1] as keyof typeof materials);
      }
    }
    visit(props.children);
  };
  visit(children);
  return [...used];
}
export function ClayFrame({ size = 52, className, children }: ClayIconProps & { children: ReactNode }) {
  const id = useId().replace(/:/gu, "");
  const palette = usedMaterials(children);
  const paints = Object.fromEntries(palette.map(key => [`--sculpture-${key}`, `url(#${id}-${key})`])) as CSSProperties;
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={paints} aria-hidden="true" focusable="false" fill="none" data-clay-icon data-clay-material="matte-sculpture">
    <defs>{palette.map(key => {
      const colors = materials[key];
      return <linearGradient key={key} id={`${id}-${key}`} x1=".15" y1="0" x2=".85" y2="1">
        <stop offset="0" stopColor={colors[0]} /><stop offset=".42" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} />
      </linearGradient>;
    })}</defs>
    <ellipse cx="33" cy="58" rx="22" ry="4" fill="#5a3d66" opacity=".15" />
    <ellipse cx="32" cy="57" rx="14" ry="2" fill="#3b2f50" opacity=".12" />
    <g strokeLinejoin="round" strokeLinecap="round">{children}</g>
  </svg>;
}
