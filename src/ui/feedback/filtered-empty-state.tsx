"use client";

import type { ReactNode } from "react";

export type FilteredEmptyStateProps = {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly onEditFilters?: () => void;
  readonly onClearFilters?: () => void;
};

export function FilteredEmptyState({
  title = "Aucun résultat avec ces filtres",
  description,
  onEditFilters,
  onClearFilters,
}: FilteredEmptyStateProps) {
  return (
    <section data-ui-feedback="filtered-empty" aria-labelledby="ui-filtered-empty-title">
      <h2 id="ui-filtered-empty-title">{title}</h2>
      {description ? <div>{description}</div> : null}
      {onEditFilters ? (
        <button type="button" onClick={onEditFilters}>Modifier les filtres</button>
      ) : null}
      {onClearFilters ? (
        <button type="button" onClick={onClearFilters}>Effacer les filtres</button>
      ) : null}
    </section>
  );
}
