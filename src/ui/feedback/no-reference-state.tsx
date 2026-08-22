import type { ReactNode } from "react";

export type NoReferenceStateProps = {
  readonly value: ReactNode;
  readonly message?: string;
};

export function NoReferenceState({
  value,
  message = "Pas encore de référence historique",
}: NoReferenceStateProps) {
  return (
    <section data-ui-feedback="no-reference">
      <div data-ui-raw-value="">{value}</div>
      <p>{message}</p>
    </section>
  );
}
