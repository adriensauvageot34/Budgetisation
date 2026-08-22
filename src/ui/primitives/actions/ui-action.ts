export type UiAction<NavigationIntent = never> =
  | { readonly kind: "callback"; readonly onAction: () => void }
  | {
      readonly kind: "navigation";
      readonly intent: NavigationIntent;
      readonly onNavigate: (intent: NavigationIntent) => void;
    }
  | { readonly kind: "disabled"; readonly reason?: string }
  | { readonly kind: "loading"; readonly label?: string };

export function invokeUiAction<NavigationIntent>(
  action: Extract<UiAction<NavigationIntent>, { readonly kind: "callback" | "navigation" }>,
): void {
  if (action.kind === "callback") action.onAction();
  else action.onNavigate(action.intent);
}
