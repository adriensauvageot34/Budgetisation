export type RefreshIndicatorProps = {
  readonly message?: string;
  readonly failed?: boolean;
};

export function RefreshIndicator({
  message,
  failed = false,
}: RefreshIndicatorProps) {
  return (
    <span
      data-ui-refresh={failed ? "failed" : "refreshing"}
      role="status"
      aria-live="polite"
    >
      {message ?? (failed ? "Mise à jour impossible" : "Mise à jour en cours")}
    </span>
  );
}
