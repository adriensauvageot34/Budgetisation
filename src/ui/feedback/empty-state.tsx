import type { ReactNode } from "react";

export type EmptyStateProps = {
  readonly title?: string;
  readonly description?: ReactNode;
};

export function EmptyState({
  title = "Aucun élément",
  description,
}: EmptyStateProps) {
  return (
    <section data-ui-feedback="empty" aria-labelledby="ui-empty-title">
      <h2 id="ui-empty-title">{title}</h2>
      {description ? <div>{description}</div> : null}
    </section>
  );
}
