export type RefreshIndicatorProps = {
  readonly message?: string;
  readonly failed?: boolean;
  readonly announce?: boolean;
};

export function RefreshIndicator({
  message,
  failed = false,
  announce = false,
}: RefreshIndicatorProps) {
  return (
    <span
      data-ui-refresh={failed ? "failed" : "refreshing"}
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
    >
      {message ?? (failed ? "Mise à jour impossible" : "Mise à jour en cours")}
    </span>
  );
}
