import type { ReactNode } from "react";

export type NoDataStateProps = {
  readonly title?: string;
  readonly description?: ReactNode;
};

export function NoDataState({
  title = "Données indisponibles",
  description,
}: NoDataStateProps) {
  return (
    <section data-ui-feedback="no-data" aria-labelledby="ui-no-data-title">
      <h2 id="ui-no-data-title">{title}</h2>
      {description ? <div>{description}</div> : null}
    </section>
  );
}
