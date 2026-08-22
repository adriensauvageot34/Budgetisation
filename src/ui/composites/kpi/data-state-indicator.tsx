export type DataStateIndicatorState =
  | "partial"
  | "estimated"
  | "conflict"
  | "unknown"
  | "refreshing"
  | "refresh_failed";

const labels: Readonly<Record<DataStateIndicatorState, string>> = {
  partial: "Données partielles",
  estimated: "Valeur estimée",
  conflict: "À vérifier",
  unknown: "Non disponible",
  refreshing: "Mise à jour en cours",
  refresh_failed: "Mise à jour impossible",
};

export function DataStateIndicator({
  state,
}: {
  readonly state: DataStateIndicatorState;
}) {
  return (
    <span className="ui-data-state" data-state={state}>
      {labels[state]}
    </span>
  );
}
