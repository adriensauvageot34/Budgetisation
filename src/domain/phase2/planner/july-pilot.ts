export const julyPilotStatuses = ["confirmed", "pending", "planned", "undated"] as const;
export type JulyPilotStatus = typeof julyPilotStatuses[number];

export const julyPilotLabels: Readonly<Record<JulyPilotStatus, string>> = {
  confirmed: "Validé",
  pending: "Passé · à valider",
  planned: "Prévu",
  undated: "À dater",
};
