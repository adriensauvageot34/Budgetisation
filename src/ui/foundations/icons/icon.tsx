import type { LucideIcon } from "lucide-react";
import { designTokens } from "../tokens/tokens";

export type IconSize = "sm" | "md" | "lg";

export type IconProps = {
  readonly icon: LucideIcon;
  readonly size?: IconSize;
  readonly className?: string;
} & (
  | { readonly decorative: true; readonly label?: never }
  | { readonly decorative?: false; readonly label: string }
);

export function Icon({
  icon: Glyph,
  size = "md",
  className,
  decorative = false,
  label,
}: IconProps) {
  return (
    <Glyph
      className={className}
      width={designTokens.icon.size[size]}
      height={designTokens.icon.size[size]}
      strokeWidth="var(--ui-icon-stroke)"
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
    />
  );
}
