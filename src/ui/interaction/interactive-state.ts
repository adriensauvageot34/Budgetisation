export const interactiveStates = [
  "default",
  "hover",
  "focus",
  "pressed",
  "selected",
  "disabled",
  "loading",
] as const;

export type InteractiveState = (typeof interactiveStates)[number];

export type InteractiveStateInput = {
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
};

export function resolvePersistentInteractiveState(
  input: InteractiveStateInput,
): "default" | "selected" | "disabled" | "loading" {
  if (input.loading) return "loading";
  if (input.disabled) return "disabled";
  if (input.selected) return "selected";
  return "default";
}
