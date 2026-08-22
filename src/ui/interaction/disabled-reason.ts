export type DisabledInteraction = {
  readonly disabled: true;
  readonly reason?: string;
};

export function hasConsultableDisabledReason(
  interaction: DisabledInteraction,
): interaction is DisabledInteraction & { readonly reason: string } {
  return typeof interaction.reason === "string" && interaction.reason.trim().length > 0;
}
