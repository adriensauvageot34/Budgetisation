export const statusBadgeStates = ["active", "inactive", "pending", "confirmed", "deduced"] as const;
export const qualityBadgeStates = [
  "partial",
  "conflict",
  "limited_support",
  "insufficient_support",
  "estimated",
  "incomplete",
] as const;
export const stabilityBadgeStates = ["stable", "variable", "insufficient_support"] as const;
export type StatusBadgeState = (typeof statusBadgeStates)[number];
export type QualityBadgeState = (typeof qualityBadgeStates)[number];
export type StabilityBadgeState = (typeof stabilityBadgeStates)[number];

const statusLabels: Readonly<Record<StatusBadgeState, string>> = {
  active: "Actif",
  inactive: "Inactif",
  pending: "En attente",
  confirmed: "Confirmé",
  deduced: "Déduit",
};
const qualityLabels: Readonly<Record<QualityBadgeState, string>> = {
  partial: "Partiel",
  conflict: "À vérifier",
  limited_support: "Support limité",
  insufficient_support: "Support insuffisant",
  estimated: "Estimé",
  incomplete: "Période incomplète",
};
const stabilityLabels: Readonly<Record<StabilityBadgeState, string>> = {
  stable: "Stable",
  variable: "Variable",
  insufficient_support: "Support insuffisant",
};

function Badge({ family, state, label }: { family: string; state: string; label: string }) {
  return <span className="ui-specialized-badge" data-family={family} data-state={state}>{label}</span>;
}

export function StatusBadge({ state }: { readonly state: StatusBadgeState }) {
  return <Badge family="status" state={state} label={statusLabels[state]} />;
}

export function QualityBadge({ state }: { readonly state: QualityBadgeState }) {
  return <Badge family="quality" state={state} label={qualityLabels[state]} />;
}

export function StabilityBadge({ state }: { readonly state: StabilityBadgeState }) {
  return <Badge family="stability" state={state} label={stabilityLabels[state]} />;
}
