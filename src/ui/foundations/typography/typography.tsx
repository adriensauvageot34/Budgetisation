import type { ReactNode } from "react";

export type TypographyVariant =
  | "body"
  | "metadata"
  | "section_heading"
  | "page_heading"
  | "metric_value";

export type TypographyProps = {
  readonly variant: TypographyVariant;
  readonly children: ReactNode;
  readonly className?: string;
};

export function Typography({ variant, children, className }: TypographyProps) {
  const Tag =
    variant === "page_heading"
      ? "h1"
      : variant === "section_heading"
        ? "h2"
        : "span";
  return (
    <Tag className={className} data-ui-typography={variant}>
      {children}
    </Tag>
  );
}
