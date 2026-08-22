import type { ReactNode } from "react";

export type SectionLayoutProps = {
  readonly title: string;
  readonly children?: ReactNode;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
};

export function SectionLayout({
  title,
  children,
  description,
  actions,
  headingLevel = 2,
  className,
}: SectionLayoutProps) {
  if (children === null || children === undefined || children === false) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={["ui-section-layout", className].filter(Boolean).join(" ")}>
      <header className="ui-section-header">
        <div>
          <Heading>{title}</Heading>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="ui-section-actions">{actions}</div> : null}
      </header>
      <div className="ui-section-content">{children}</div>
    </section>
  );
}
