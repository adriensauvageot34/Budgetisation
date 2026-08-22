export type UiAction<NavigationIntent = never> =
  | { readonly kind: "callback"; readonly onAction: () => void }
  | {
      readonly kind: "navigation";
      readonly intent: NavigationIntent;
      readonly onNavigate: (intent: NavigationIntent) => void;
    }
  | { readonly kind: "disabled"; readonly reason?: string };

export function invokeUiAction<NavigationIntent>(
  action: Exclude<UiAction<NavigationIntent>, { readonly kind: "disabled" }>,
): void {
  if (action.kind === "callback") action.onAction();
  else action.onNavigate(action.intent);
}
